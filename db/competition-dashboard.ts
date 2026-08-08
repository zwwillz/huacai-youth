import { getSqlClient } from "./index";
import { getAdminNavigationEventsForPrincipal } from "./admin-principal-ui";
import { resolveAdminPrincipal, type AdminPrincipalInput } from "./permissions";
import type { DrawPhaseCode } from "./draw-engine";

export type CompetitionDashboardData = {
  events: Awaited<ReturnType<typeof getAdminNavigationEventsForPrincipal>>;
  selectedEventId: string;
  groups: Array<{
    id: string;
    name: string;
    code: string;
    approvedCount: number;
    draws: Partial<Record<DrawPhaseCode, { id: string; versionNo: number; status: string; entrantCount: number; playoffMatchCount: number; byeCount: number }>>;
  }>;
};

type DashboardGroupRow = {
  id: string;
  name: string;
  code: string;
  approvedCount: number;
  draws: Partial<Record<DrawPhaseCode, { id: string; versionNo: number; status: string; entrantCount: number; playoffMatchCount: number; byeCount: number }>> | null;
};

export async function getCompetitionDashboardData(input: AdminPrincipalInput, requestedEventId?: string): Promise<CompetitionDashboardData> {
  const principal = await resolveAdminPrincipal(input);
  const events = await getAdminNavigationEventsForPrincipal(principal);
  const selectedEventId = events.some((event) => event.id === requestedEventId) ? String(requestedEventId) : events[0]?.id || "";
  if (!selectedEventId) return { events, selectedEventId: "", groups: [] };

  const sql = getSqlClient();
  const rows = await sql<DashboardGroupRow[]>`
    select g.id,g.name,g.code,count(r.id)::int as "approvedCount",
      coalesce((
        select jsonb_object_agg(latest.phase_code,jsonb_build_object(
          'id',latest.id,'versionNo',latest.version_no,'status',latest.status,'entrantCount',latest.entrant_count,
          'playoffMatchCount',latest.playoff_match_count,'byeCount',latest.bye_count
        ))
        from (
          select distinct on (ds.phase_code) ds.id,ds.phase_code,ds.version_no,ds.status,ds.entrant_count,ds.playoff_match_count,ds.bye_count
          from public.draw_sessions ds
          where ds.event_id=${selectedEventId} and ds.group_id=g.id
          order by ds.phase_code,ds.version_no desc
        ) latest
      ),'{}'::jsonb) as draws
    from public.event_groups g
    left join public.registrations r on r.event_id=g.event_id and r.group_id=g.id and r.status='approved'
    where g.event_id=${selectedEventId} and g.status='active'
    group by g.id,g.name,g.code
    order by g.code
  `;

  return {
    events,
    selectedEventId,
    groups: rows.map((row) => ({ ...row, approvedCount: Number(row.approvedCount), draws: row.draws ?? {} })),
  };
}
