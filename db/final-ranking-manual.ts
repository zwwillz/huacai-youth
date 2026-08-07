import { randomUUID } from "node:crypto";
import { getSqlClient } from "./index";
import { requireEventAccess } from "./permissions";
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

export async function saveFinalRankingManualOrder(username: string, batchId: string, orderedPlayerIds: string[], reason: string) {
  const sql = getSqlClient();
  const viewerRows = await sql<Array<{ id: string; role: string }>>`select id,role from public.users where username=${username} and status='active' limit 1`;
  const viewer = viewerRows[0];
  if (!viewer || !["system_admin","committee"].includes(viewer.role)) throw new Error("人工调整最终排名需要系统管理员或组委会权限。");
  const batches = await sql<Array<{ eventId: string; groupId: string; status: string }>>`
    select event_id as "eventId",group_id as "groupId",status from public.competition_final_ranking_batches where id=${batchId} limit 1
  `;
  const batch = batches[0];
  if (!batch) throw new Error("没有找到最终排名草稿。");
  await requireEventAccess(username, batch.eventId, { write: true, allowedRoles: ["system_admin", "committee"] });
  if (batch.status !== "draft") throw new Error("只有尚未确认的排名草稿可以人工调整。已确认或已发布排名请走正式更正流程。");
  if (orderedPlayerIds.length !== 64 || new Set(orderedPlayerIds).size !== 64) throw new Error("人工调整必须保留完整64名球员，且不能重复。");
  const rows = await sql<Array<{ playerId: string; playerName: string }>>`
    select player_id as "playerId",player_name as "playerName" from public.event_rankings
    where event_id=${batch.eventId} and group_id=${batch.groupId} and status='draft'
  `;
  if (rows.length !== 64) throw new Error("当前排名草稿不是完整64人，暂时不能人工调整。");
  const playerMap = new Map(rows.map((row) => [row.playerId, row.playerName]));
  if (orderedPlayerIds.some((id) => !playerMap.has(id))) throw new Error("人工调整名单中包含不属于当前排名草稿的球员。");
  const groupRows = await sql<Array<{ groupName: string }>>`select name as "groupName" from public.event_groups where id=${batch.groupId} limit 1`;
  const detailRows = await sql<Array<{ prizes: unknown }>>`select prizes from public.event_details where event_id=${batch.eventId} limit 1`;
  const prizeObject = detailRows[0]?.prizes && typeof detailRows[0].prizes === "object" ? detailRows[0].prizes as Record<string, unknown> : {};
  const prizeList = Array.isArray(prizeObject[groupRows[0]?.groupName || ""]) ? prizeObject[groupRows[0]?.groupName || ""] as Array<[string,string]> : [];
  const prizeMap = new Map(prizeList.map(([label, amount]) => [String(label), String(amount)]));
  const ranking: FinalRankingRow[] = orderedPlayerIds.map((playerId, index) => {
    const displayOrder = index + 1;
    const tier = labelFor(displayOrder);
    return { displayOrder, placementLabel: tier.label, playerId, playerName: playerMap.get(playerId)!, prizeDisplay: prizeMap.get(tier.label) || "", isExactPlace: tier.exact };
  });
  const timestamp = now();
  await sql.begin(async (tx) => {
    for (const row of ranking) {
      await tx`update public.event_rankings set display_order=${row.displayOrder},placement_label=${row.placementLabel},prize_display=${row.prizeDisplay},prize_amount_cents=${parsePrizeAmount(row.prizeDisplay)},is_exact_place=${row.isExactPlace},ranking_basis='manual_adjustment',source='competition_engine_manual',note=${String(reason || "").trim() || '组委会人工调整'},updated_at=${timestamp}
        where event_id=${batch.eventId} and group_id=${batch.groupId} and player_id=${row.playerId} and status='draft'`;
    }
    await tx`update public.competition_final_ranking_batches set ranking_json=${JSON.stringify(ranking)}::jsonb,updated_at=${timestamp} where id=${batchId}`;
    await tx`insert into public.audit_logs (id,actor_user_id,event_id,module_type,target_type,target_id,action,after_json,created_at)
      values (${newId("log")},${viewer.id},${batch.eventId},'competition','final_ranking',${batchId},'manual_adjust_final_ranking',${JSON.stringify({ reason: String(reason || "").trim() || null, orderedPlayerIds })},${timestamp})`;
  });
  await markCompetitionModuleDirty(batch.eventId, "rankings");
  return { ok: true, rows: ranking };
}

export async function clearFinalRankingPublicationDirty(batchId: string) {
  const sql = getSqlClient();
  const rows = await sql<Array<{ eventId: string }>>`select event_id as "eventId" from public.competition_final_ranking_batches where id=${batchId} limit 1`;
  const eventId = rows[0]?.eventId;
  if (!eventId) return;
  await sql`update public.publications set has_unpublished_changes=false,draft_updated_at=null where event_id=${eventId} and module_type='rankings' and status='published'`;
}
