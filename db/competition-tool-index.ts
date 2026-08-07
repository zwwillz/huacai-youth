import { getSqlClient } from "./index";
import { competitionPhaseLabel } from "./competition-labels";

export type CompetitionBracketIndexItem = {
  drawSessionId: string;
  bracketId: string;
  eventId: string;
  groupId: string;
  groupName: string;
  phaseCode: string;
  phaseTitle: string;
  drawVersion: number;
  bracketStatus: string;
  playableMatchCount: number;
  generatedAt: string;
  scheduleId: string | null;
  scheduleStatus: string | null;
  scheduledCount: number;
};

type Viewer = { id: string; role: string };

async function requireViewer(username: string) {
  const sql = getSqlClient();
  const rows = await sql<Viewer[]>`select id,role from public.users where username=${username} and status='active' limit 1`;
  const viewer = rows[0];
  if (!viewer || !["system_admin","committee","referee"].includes(viewer.role)) throw new Error("当前账号没有竞赛执行权限。");
  return viewer;
}

export async function getCompetitionBracketIndex(username: string, eventId: string, filters: { groupId?: string; phaseCode?: string } = {}) {
  await requireViewer(username);
  const sql = getSqlClient();
  const rows = await sql<CompetitionBracketIndexItem[]>`
    select ds.id as "drawSessionId",b.id as "bracketId",b.event_id as "eventId",b.group_id as "groupId",eg.name as "groupName",
      b.phase_code as "phaseCode",coalesce(ep.title,b.phase_code) as "phaseTitle",ds.version_no as "drawVersion",
      b.status as "bracketStatus",b.playable_match_count as "playableMatchCount",b.generated_at as "generatedAt",
      s.id as "scheduleId",s.status as "scheduleStatus",coalesce(count(ms.id),0)::int as "scheduledCount"
    from public.competition_brackets b
    join public.draw_sessions ds on ds.id=b.draw_session_id
    join public.event_groups eg on eg.id=b.group_id
    left join public.event_phases ep on ep.event_id=b.event_id and ep.code=b.phase_code
    left join public.competition_schedules s on s.bracket_id=b.id
    left join public.competition_match_schedules ms on ms.schedule_id=s.id
    where b.event_id=${eventId}
      and (${filters.groupId || ""}='' or b.group_id=${filters.groupId || ""})
      and (${filters.phaseCode || ""}='' or b.phase_code=${filters.phaseCode || ""})
    group by ds.id,b.id,eg.name,eg.code,ep.title,s.id
    order by eg.code,case b.phase_code when 'qualifier-one' then 1 when 'qualifier-two' then 2 when 'main-one' then 3 when 'main-two' then 4 else 99 end,ds.version_no desc
  `;
  return rows.map((item) => ({ ...item, phaseTitle: competitionPhaseLabel(item.phaseCode, item.phaseTitle) }));
}
