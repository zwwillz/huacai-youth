import { getSqlClient } from "./index";
import { getAdminNavigationEvents } from "./admin-ui";
import type { DrawPhaseCode } from "./draw-engine";

export type CompetitionDashboardData = {
  events: Awaited<ReturnType<typeof getAdminNavigationEvents>>;
  selectedEventId: string;
  groups: Array<{
    id: string;
    name: string;
    code: string;
    approvedCount: number;
    draws: Partial<Record<DrawPhaseCode, { id: string; versionNo: number; status: string; entrantCount: number; playoffMatchCount: number; byeCount: number }>>;
  }>;
};

export async function getCompetitionDashboardData(username: string, requestedEventId?: string): Promise<CompetitionDashboardData> {
  const events = await getAdminNavigationEvents(username);
  const selectedEventId = events.some((event) => event.id === requestedEventId) ? String(requestedEventId) : events[0]?.id || "";
  if (!selectedEventId) return { events, selectedEventId: "", groups: [] };

  const sql = getSqlClient();
  const [groupRows, drawRows] = await Promise.all([
    sql<Array<{ id: string; name: string; code: string; approvedCount: number }>>`
      select g.id, g.name, g.code, count(r.id)::int as "approvedCount"
      from public.event_groups g
      left join public.registrations r on r.event_id=g.event_id and r.group_id=g.id and r.status='approved'
      where g.event_id=${selectedEventId} and g.status='active'
      group by g.id,g.name,g.code
      order by g.code
    `,
    sql<Array<{ id: string; groupId: string; phaseCode: DrawPhaseCode; versionNo: number; status: string; entrantCount: number; playoffMatchCount: number; byeCount: number }>>`
      select distinct on (group_id,phase_code)
        id, group_id as "groupId", phase_code as "phaseCode", version_no as "versionNo", status,
        entrant_count as "entrantCount", playoff_match_count as "playoffMatchCount", bye_count as "byeCount"
      from public.draw_sessions
      where event_id=${selectedEventId}
      order by group_id,phase_code,version_no desc
    `,
  ]);

  const drawMap = new Map<string, CompetitionDashboardData["groups"][number]["draws"]>();
  for (const row of drawRows) {
    const current = drawMap.get(row.groupId) ?? {};
    current[row.phaseCode] = { id: row.id, versionNo: row.versionNo, status: row.status, entrantCount: row.entrantCount, playoffMatchCount: row.playoffMatchCount, byeCount: row.byeCount };
    drawMap.set(row.groupId, current);
  }

  return {
    events,
    selectedEventId,
    groups: groupRows.map((group) => ({ ...group, draws: drawMap.get(group.id) ?? {} })),
  };
}
