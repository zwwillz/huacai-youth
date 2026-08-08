import { randomUUID } from "node:crypto";
import { getSqlClient } from "./index";
import { assertAdminRole, resolveAdminPrincipal, type AdminPrincipalInput } from "./permissions";
import { markCompetitionModuleDirty } from "./competition-context";
import type { FinalRankingRow } from "./final-ranking-engine";

function now() { return new Date().toISOString(); }
function newId(prefix: string) { return `${prefix}_${randomUUID().replaceAll("-", "")}`; }
function labelFor(order: number) {
  if (order === 1) return { label: "冠军", exact: true };
  if (order === 2) return { label: "亚军", exact: true };
  if (order === 3) return { label: "季军", exact: true };
  if (order === 4) return { label: "殿军", exact: true };
  if (order <= 8) return { label: "8强", exact: false };
  if (order <= 16) return { label: "16强", exact: false };
  if (order <= 32) return { label: "32强", exact: false };
  return { label: "64强", exact: false };
}
function parsePrizeAmount(value: string) { const digits = value.replace(/[^0-9]/g, ""); return digits ? Number(digits) * 100 : 0; }

type BatchForWrite = {
  eventId: string;
  groupId: string;
  status: string;
  groupName: string;
  prizes: unknown;
};

async function loadBatchForWrite(principal: Awaited<ReturnType<typeof resolveAdminPrincipal>>, batchId: string) {
  const sql = getSqlClient();
  const rows = await sql<BatchForWrite[]>`
    select b.event_id as "eventId",b.group_id as "groupId",b.status,g.name as "groupName",d.prizes
    from public.competition_final_ranking_batches b
    join public.event_groups g on g.id=b.group_id
    left join public.event_details d on d.event_id=b.event_id
    where b.id=${batchId}
      and (${principal.role}='system_admin' or exists (
        select 1 from public.event_members em where em.event_id=b.event_id and em.user_id=${principal.id} and em.status='active'
      ))
    limit 1
  `;
  const batch = rows[0];
  if (!batch) throw new Error("没有找到最终排名批次，或当前账号未被分配到本站。");
  return batch;
}

export async function saveFinalRankingManualOrderFast(inputPrincipal: AdminPrincipalInput, batchId: string, orderedPlayerIds: string[], reason: string) {
  const viewer = await resolveAdminPrincipal(inputPrincipal);
  assertAdminRole(viewer, ["system_admin", "committee"], "人工调整最终排名需要系统管理员或组委会权限。");
  const batch = await loadBatchForWrite(viewer, batchId);
  if (batch.status !== "draft") throw new Error("只有尚未确认的排名草稿可以人工调整。已确认或已发布排名请走正式更正流程。");
  if (orderedPlayerIds.length !== 64 || new Set(orderedPlayerIds).size !== 64) throw new Error("人工调整必须保留完整64名球员，且不能重复。");

  const sql = getSqlClient();
  const rows = await sql<Array<{ playerId: string; playerName: string }>>`
    select player_id as "playerId",player_name as "playerName" from public.event_rankings
    where event_id=${batch.eventId} and group_id=${batch.groupId} and status='draft'
  `;
  if (rows.length !== 64) throw new Error("当前排名草稿不是完整64人，暂时不能人工调整。");
  const playerMap = new Map(rows.map((row) => [row.playerId, row.playerName]));
  if (orderedPlayerIds.some((id) => !playerMap.has(id))) throw new Error("人工调整名单中包含不属于当前排名草稿的球员。");

  const prizeObject = batch.prizes && typeof batch.prizes === "object" ? batch.prizes as Record<string, unknown> : {};
  const prizeList = Array.isArray(prizeObject[batch.groupName]) ? prizeObject[batch.groupName] as Array<[string,string]> : [];
  const prizeMap = new Map(prizeList.map(([label, amount]) => [String(label), String(amount)]));
  const ranking: FinalRankingRow[] = orderedPlayerIds.map((playerId, index) => {
    const displayOrder = index + 1;
    const tier = labelFor(displayOrder);
    return { displayOrder, placementLabel: tier.label, playerId, playerName: playerMap.get(playerId)!, prizeDisplay: prizeMap.get(tier.label) || "", isExactPlace: tier.exact };
  });
  const updateRows = ranking.map((row) => ({
    player_id: row.playerId,
    display_order: row.displayOrder,
    placement_label: row.placementLabel,
    prize_display: row.prizeDisplay,
    prize_amount_cents: parsePrizeAmount(row.prizeDisplay),
    is_exact_place: row.isExactPlace,
  }));
  const timestamp = now();
  const note = String(reason || "").trim() || "组委会人工调整";
  await sql.begin(async (tx) => {
    const updated = await tx<Array<{ playerId: string }>>`
      with input_rows as (
        select * from jsonb_to_recordset(${JSON.stringify(updateRows)}::jsonb)
        as x(player_id text,display_order int,placement_label text,prize_display text,prize_amount_cents int,is_exact_place boolean)
      )
      update public.event_rankings r
      set display_order=x.display_order,placement_label=x.placement_label,prize_display=x.prize_display,prize_amount_cents=x.prize_amount_cents,
        is_exact_place=x.is_exact_place,ranking_basis='manual_adjustment',source='competition_engine_manual',note=${note},updated_at=${timestamp}
      from input_rows x
      where r.event_id=${batch.eventId} and r.group_id=${batch.groupId} and r.player_id=x.player_id and r.status='draft'
      returning r.player_id as "playerId"
    `;
    if (updated.length !== 64) throw new Error("排名草稿在保存过程中发生变化，请刷新后重试。");
    await tx`update public.competition_final_ranking_batches set ranking_json=${JSON.stringify(ranking)}::jsonb,updated_at=${timestamp} where id=${batchId} and status='draft'`;
    await tx`insert into public.audit_logs (id,actor_user_id,event_id,module_type,target_type,target_id,action,after_json,created_at)
      values (${newId("log")},${viewer.id},${batch.eventId},'competition','final_ranking',${batchId},'manual_adjust_final_ranking',${JSON.stringify({ reason: String(reason || "").trim() || null, orderedPlayerIds })},${timestamp})`;
  });
  await markCompetitionModuleDirty(batch.eventId, "rankings");
  return { ok: true, rows: ranking };
}

export async function confirmFinalRankingFast(inputPrincipal: AdminPrincipalInput, batchId: string) {
  const viewer = await resolveAdminPrincipal(inputPrincipal);
  assertAdminRole(viewer, ["system_admin", "committee"], "最终排名确认和发布需要系统管理员或组委会权限。");
  const batch = await loadBatchForWrite(viewer, batchId);
  if (batch.status === "published" || batch.status === "confirmed") return { ok: true };
  if (batch.status !== "draft") throw new Error("当前最终排名状态不能确认。");
  const timestamp = now();
  const sql = getSqlClient();
  await sql.begin(async (tx) => {
    await tx`update public.event_rankings set status='confirmed',updated_at=${timestamp} where event_id=${batch.eventId} and group_id=${batch.groupId} and status='draft'`;
    const updated = await tx<Array<{ id: string }>>`update public.competition_final_ranking_batches set status='confirmed',confirmed_by=${viewer.id},confirmed_at=${timestamp},updated_at=${timestamp} where id=${batchId} and status='draft' returning id`;
    if (!updated.length) throw new Error("最终排名状态已被其他人修改，请刷新后查看。");
    await tx`insert into public.audit_logs (id,actor_user_id,event_id,module_type,target_type,target_id,action,created_at)
      values (${newId("log")},${viewer.id},${batch.eventId},'competition','final_ranking',${batchId},'confirm_final_ranking',${timestamp})`;
  });
  return { ok: true };
}

export async function publishFinalRankingFast(inputPrincipal: AdminPrincipalInput, batchId: string) {
  const viewer = await resolveAdminPrincipal(inputPrincipal);
  assertAdminRole(viewer, ["system_admin", "committee"], "最终排名确认和发布需要系统管理员或组委会权限。");
  const batch = await loadBatchForWrite(viewer, batchId);
  if (batch.status !== "confirmed" && batch.status !== "published") throw new Error("请先确认最终排名，再进行发布。");
  if (batch.status === "published") return { ok: true };
  const timestamp = now();
  const sql = getSqlClient();
  await sql.begin(async (tx) => {
    await tx`update public.event_rankings set status='published',updated_at=${timestamp} where event_id=${batch.eventId} and group_id=${batch.groupId} and status='confirmed'`;
    const updated = await tx<Array<{ id: string }>>`update public.competition_final_ranking_batches set status='published',published_by=${viewer.id},published_at=${timestamp},updated_at=${timestamp} where id=${batchId} and status='confirmed' returning id`;
    if (!updated.length) throw new Error("最终排名状态已被其他人修改，请刷新后查看。");
    await tx`update public.publications set status='published',published_by=${viewer.id},published_at=coalesce(published_at,${timestamp}),has_unpublished_changes=false,draft_updated_at=null,updated_at=${timestamp} where event_id=${batch.eventId} and module_type='rankings'`;
    await tx`insert into public.audit_logs (id,actor_user_id,event_id,module_type,target_type,target_id,action,created_at)
      values (${newId("log")},${viewer.id},${batch.eventId},'competition','final_ranking',${batchId},'publish_final_ranking',${timestamp})`;
  });
  await sql`
    update public.events e set status='finished',updated_at=${timestamp},updated_by=${viewer.id}
    where e.id=${batch.eventId}
      and exists(select 1 from public.event_groups g where g.event_id=e.id and g.status='active')
      and not exists(
        select 1 from public.event_groups g
        where g.event_id=e.id and g.status='active'
          and (select count(*) from public.event_rankings r where r.event_id=e.id and r.group_id=g.id and r.status='published') < 64
      )
  `;
  return { ok: true };
}
