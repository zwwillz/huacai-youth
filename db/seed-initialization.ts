import { randomUUID } from "node:crypto";
import { getSqlClient } from "./index";
import { requireEventAccess, type AdminPrincipalInput } from "./permissions";

export const NO_SEED_SOURCE_MESSAGE = "暂无可用上一站正式排名，请手动确认种子来源或录入种子。";

function now() { return new Date().toISOString(); }
function newId(prefix: string) { return `${prefix}_${randomUUID().replaceAll("-", "")}`; }
function evaluateEligibility(birthDate: string | null, from: string | null, to: string | null) {
  if (!from && !to) return { status: "unknown", note: "当前组别尚未配置明确出生日期范围，请组委会人工核验。" };
  if (!birthDate) return { status: "unknown", note: "球员档案缺少出生日期，请组委会人工核验。" };
  if (from && birthDate < from) return { status: "ineligible", note: `出生日期早于本组允许范围 ${from}。` };
  if (to && birthDate > to) return { status: "ineligible", note: `出生日期晚于本组允许范围 ${to}。` };
  return { status: "eligible", note: "年龄条件符合本组设置。" };
}

export async function findEligiblePreviousSeedEvent(eventId: string, groupName?: string | null) {
  const sql = getSqlClient();
  const rows = await sql<Array<{ id: string; shortTitle: string; stationNo: number }>>`
    with current as (
      select id,series_id,year,station_no from public.events where id=${eventId} limit 1
    ), target_groups as (
      select name from public.event_groups where event_id=${eventId} and status='active' and (${groupName ?? ""}='' or name=${groupName ?? ""})
    )
    select e.id,e.short_title as "shortTitle",e.station_no as "stationNo"
    from public.events e,current c
    where e.series_id=c.series_id
      and e.year=c.year
      and e.station_no<c.station_no
      and e.status in ('finished','archived')
      and e.publish_status='published'
      and coalesce(e.is_test,false)=false
      and not exists (
        select 1 from target_groups tg
        where not exists (
          select 1
          from public.event_groups peg
          where peg.event_id=e.id and peg.name=tg.name
            and (
              select count(*)
              from public.event_rankings er
              where er.event_id=e.id and er.group_id=peg.id and er.status='published'
                and er.player_id is not null and er.display_order between 1 and 16
            )=16
            and (
              select count(distinct er.display_order)
              from public.event_rankings er
              where er.event_id=e.id and er.group_id=peg.id and er.status='published'
                and er.player_id is not null and er.display_order between 1 and 16
            )=16
        )
      )
    order by e.station_no desc
    limit 1
  `;
  return rows[0] ?? null;
}

export async function initializeSeedsFromEligiblePreviousStation(inputPrincipal: AdminPrincipalInput, eventId: string, groupId: string) {
  const actor = await requireEventAccess(inputPrincipal, eventId, {
    write: true,
    allowedRoles: ["system_admin", "committee"],
    deniedMessage: "该操作需要系统管理员或组委会权限。",
  });
  const sql = getSqlClient();
  const groupRows = await sql<Array<{ name: string; birthDateFrom: string | null; birthDateTo: string | null }>>`
    select name,birth_date_from as "birthDateFrom",birth_date_to as "birthDateTo"
    from public.event_groups where id=${groupId} and event_id=${eventId} and status='active' limit 1
  `;
  const group = groupRows[0];
  if (!group) throw new Error("没有找到当前组别。");

  const [activeDraw, existing, previous] = await Promise.all([
    sql<Array<{ count: number }>>`
      select count(*)::int as count from public.draw_sessions
      where event_id=${eventId} and group_id=${groupId} and phase_code='main-one' and status in ('draft','confirmed')
    `,
    sql<Array<{ count: number }>>`
      select count(*)::int as count from public.competition_seed_entries
      where event_id=${eventId} and group_id=${groupId} and status='active'
    `,
    findEligiblePreviousSeedEvent(eventId, group.name),
  ]);
  if ((activeDraw[0]?.count ?? 0) > 0) throw new Error("正赛第一阶段已经抽签，不能重建种子名单。请先作废抽签。");
  if ((existing[0]?.count ?? 0) > 0) throw new Error("当前已经有种子候选名单。如需重建，请先处理现有名单。");
  if (!previous) throw new Error(NO_SEED_SOURCE_MESSAGE);

  const rows = await sql<Array<{ playerId: string | null; playerName: string; displayOrder: number; placementLabel: string; birthDate: string | null }>>`
    select er.player_id as "playerId",er.player_name as "playerName",er.display_order as "displayOrder",er.placement_label as "placementLabel",p.birth_date as "birthDate"
    from public.event_rankings er
    join public.event_groups peg on peg.id=er.group_id
    left join public.players p on p.id=er.player_id
    where er.event_id=${previous.id} and er.status='published' and peg.name=${group.name} and er.display_order between 1 and 16
    order by er.display_order
  `;
  if (rows.length !== 16 || rows.some((row) => !row.playerId) || new Set(rows.map((row) => row.displayOrder)).size !== 16) {
    throw new Error(NO_SEED_SOURCE_MESSAGE);
  }

  const timestamp = now();
  const inserts = rows.map((row, index) => {
    const eligibility = evaluateEligibility(row.birthDate, group.birthDateFrom, group.birthDateTo);
    return {
      id: newId("seed"), event_id: eventId, group_id: groupId, player_id: row.playerId!, player_name: row.playerName, seed_no: index + 1,
      attendance_status: eligibility.status === "ineligible" ? "ineligible" : "pending", status: "active", source_event_id: previous.id,
      source_display_order: row.displayOrder, source_placement_label: row.placementLabel, source_type: "previous_station_top16",
      eligibility_status: eligibility.status, eligibility_note: eligibility.note, created_at: timestamp, updated_at: timestamp,
    };
  });
  await sql.begin(async (tx) => {
    await tx`insert into public.competition_seed_entries
      (id,event_id,group_id,player_id,player_name,seed_no,attendance_status,status,source_event_id,source_display_order,source_placement_label,source_type,eligibility_status,eligibility_note,created_at,updated_at)
      select x.id,x.event_id,x.group_id,x.player_id,x.player_name,x.seed_no,x.attendance_status,x.status,x.source_event_id,x.source_display_order,x.source_placement_label,x.source_type,x.eligibility_status,x.eligibility_note,x.created_at,x.updated_at
      from jsonb_to_recordset(${JSON.stringify(inserts)}::jsonb) as x(id text,event_id text,group_id text,player_id text,player_name text,seed_no int,attendance_status text,status text,source_event_id text,source_display_order int,source_placement_label text,source_type text,eligibility_status text,eligibility_note text,created_at text,updated_at text)`;
    await tx`insert into public.audit_logs (id,actor_user_id,event_id,module_type,target_type,target_id,action,after_json,created_at)
      values (${newId("log")},${actor.id},${eventId},'competition','seed_roster',${groupId},'initialize_seeds_from_previous_station',${JSON.stringify({ previousEventId: previous.id, count: inserts.length })},${timestamp})`;
  });
  return { ok: true, count: inserts.length, sourceEvent: previous };
}
