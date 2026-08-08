import { getSqlClient } from "./index";
import { prepareFinalRankingDraft } from "./final-ranking-engine";
import { assertAdminRole, resolveAdminPrincipal, type AdminPrincipalInput } from "./permissions";
import type { FinalRankingRow, FinalRankingWorkspaceData, FinalRankingWorkspaceGroup } from "./final-ranking-engine";

type ReadinessRow = {
  groupId: string;
  hasBatch: boolean;
  mainOneTotal: number;
  mainOneCompleted: number;
  mainTwoTotal: number;
  mainTwoCompleted: number;
};
type WorkspaceGroup = {
  groupId: string;
  groupName: string;
  mainOneTotal: number;
  mainOneCompleted: number;
  mainTwoTotal: number;
  mainTwoCompleted: number;
  batch: null | { id: string; status: string; confirmedAt: string | null; publishedAt: string | null };
  rows: FinalRankingRow[] | null;
};
type WorkspaceRow = { id: string; shortTitle: string; groups: WorkspaceGroup[] | null };

async function ensureFinalRankingDraftsFast(principal: Awaited<ReturnType<typeof resolveAdminPrincipal>>, eventId: string) {
  const sql = getSqlClient();
  const readiness = await sql<ReadinessRow[]>`
    with accessible_event as (
      select e.id from public.events e
      where e.id=${eventId}
        and (${principal.role}='system_admin' or exists (
          select 1 from public.event_members em where em.event_id=e.id and em.user_id=${principal.id} and em.status='active'
        ))
      limit 1
    ), groups as (
      select id from public.event_groups where event_id=(select id from accessible_event) and status='active'
    ), latest_sessions as (
      select distinct on (ds.group_id,ds.phase_code) ds.group_id,ds.phase_code,ds.id
      from public.draw_sessions ds
      where ds.event_id=(select id from accessible_event) and ds.phase_code in ('main-one','main-two') and ds.status='confirmed'
      order by ds.group_id,ds.phase_code,ds.version_no desc
    ), counts as (
      select ls.group_id,ls.phase_code,
        count(bm.id)::int as total,
        count(bm.id) filter(where bm.result_status='confirmed')::int as completed
      from latest_sessions ls
      left join public.competition_bracket_matches bm on bm.draw_session_id=ls.id
        and ((ls.phase_code='main-two' and bm.match_type in ('main_single','third_place'))
          or (ls.phase_code='main-one' and bm.round_name in ('败部第一轮','败部晋级轮')))
      group by ls.group_id,ls.phase_code
    )
    select g.id as "groupId",
      exists(select 1 from public.competition_final_ranking_batches b where b.event_id=${eventId} and b.group_id=g.id) as "hasBatch",
      coalesce((select total from counts c where c.group_id=g.id and c.phase_code='main-one'),0)::int as "mainOneTotal",
      coalesce((select completed from counts c where c.group_id=g.id and c.phase_code='main-one'),0)::int as "mainOneCompleted",
      coalesce((select total from counts c where c.group_id=g.id and c.phase_code='main-two'),0)::int as "mainTwoTotal",
      coalesce((select completed from counts c where c.group_id=g.id and c.phase_code='main-two'),0)::int as "mainTwoCompleted"
    from groups g
  `;
  if (!readiness.length) {
    const access = await sql<Array<{ ok: number }>>`
      select 1 as ok from public.events e
      where e.id=${eventId}
        and (${principal.role}='system_admin' or exists (
          select 1 from public.event_members em where em.event_id=e.id and em.user_id=${principal.id} and em.status='active'
        ))
      limit 1
    `;
    if (!access[0]) throw new Error("没有找到这场赛事，或当前账号未被分配到本站。");
  }
  for (const group of readiness) {
    if (group.hasBatch) continue;
    if (Number(group.mainOneTotal) !== 32 || Number(group.mainOneCompleted) !== 32 || Number(group.mainTwoTotal) !== 32 || Number(group.mainTwoCompleted) !== 32) continue;
    try { await prepareFinalRankingDraft(eventId, group.groupId); } catch { /* 保持原行为：尚不满足完整生成条件时仍展示等待状态 */ }
  }
}

/** Normal final-ranking page reads become one readiness precheck + one workspace bundle. */
export async function getFinalRankingWorkspaceDataFast(input: AdminPrincipalInput, eventId: string): Promise<FinalRankingWorkspaceData> {
  const principal = await resolveAdminPrincipal(input);
  assertAdminRole(principal, ["system_admin", "committee", "referee"], "当前账号没有查看最终排名的权限。");
  if (!eventId) throw new Error("缺少赛事ID。");
  await ensureFinalRankingDraftsFast(principal, eventId);
  const sql = getSqlClient();
  const rows = await sql<WorkspaceRow[]>`
    with accessible_event as (
      select e.id,e.short_title
      from public.events e
      where e.id=${eventId}
        and (${principal.role}='system_admin' or exists (
          select 1 from public.event_members em where em.event_id=e.id and em.user_id=${principal.id} and em.status='active'
        ))
      limit 1
    ), groups as (
      select id,name,code from public.event_groups where event_id=(select id from accessible_event) and status='active'
    ), latest_sessions as (
      select distinct on (ds.group_id,ds.phase_code) ds.group_id,ds.phase_code,ds.id
      from public.draw_sessions ds
      where ds.event_id=(select id from accessible_event) and ds.phase_code in ('main-one','main-two') and ds.status='confirmed'
      order by ds.group_id,ds.phase_code,ds.version_no desc
    ), counts as (
      select ls.group_id,ls.phase_code,
        count(bm.id)::int as total,
        count(bm.id) filter(where bm.result_status='confirmed')::int as completed
      from latest_sessions ls
      left join public.competition_bracket_matches bm on bm.draw_session_id=ls.id
        and ((ls.phase_code='main-two' and bm.match_type in ('main_single','third_place'))
          or (ls.phase_code='main-one' and bm.round_name in ('败部第一轮','败部晋级轮')))
      group by ls.group_id,ls.phase_code
    )
    select e.id,e.short_title as "shortTitle",
      coalesce((select jsonb_agg(jsonb_build_object(
        'groupId',g.id,'groupName',g.name,
        'mainOneTotal',coalesce((select total from counts c where c.group_id=g.id and c.phase_code='main-one'),0),
        'mainOneCompleted',coalesce((select completed from counts c where c.group_id=g.id and c.phase_code='main-one'),0),
        'mainTwoTotal',coalesce((select total from counts c where c.group_id=g.id and c.phase_code='main-two'),0),
        'mainTwoCompleted',coalesce((select completed from counts c where c.group_id=g.id and c.phase_code='main-two'),0),
        'batch',(select jsonb_build_object('id',b.id,'status',b.status,'confirmedAt',b.confirmed_at,'publishedAt',b.published_at)
          from public.competition_final_ranking_batches b where b.event_id=e.id and b.group_id=g.id order by b.created_at desc limit 1),
        'rows',coalesce((select jsonb_agg(jsonb_build_object(
          'displayOrder',r.display_order,'placementLabel',r.placement_label,'playerId',r.player_id,'playerName',r.player_name,
          'prizeDisplay',coalesce(r.prize_display,''),'isExactPlace',r.is_exact_place
        ) order by r.display_order) from public.event_rankings r where r.event_id=e.id and r.group_id=g.id and r.status in ('draft','confirmed','published')),'[]'::jsonb)
      ) order by g.code) from groups g),'[]'::jsonb) as groups
    from accessible_event e
  `;
  const row = rows[0];
  if (!row) throw new Error("没有找到这场赛事，或当前账号未被分配到本站。");
  const groups: FinalRankingWorkspaceGroup[] = (row.groups ?? []).map((group) => ({
    groupId: group.groupId,
    groupName: group.groupName,
    sourceReady: Number(group.mainTwoTotal) === 32 && Number(group.mainTwoCompleted) === 32 && Number(group.mainOneTotal) === 32 && Number(group.mainOneCompleted) === 32,
    completedMatchCount: Number(group.mainTwoCompleted),
    requiredMatchCount: 32,
    mainOneEliminationCount: Number(group.mainOneCompleted),
    batch: group.batch,
    rows: group.rows ?? [],
  }));
  return { viewerRole: principal.role, event: { id: row.id, shortTitle: row.shortTitle }, groups };
}
