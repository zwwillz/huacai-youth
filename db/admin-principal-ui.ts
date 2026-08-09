import { cache } from "react";
import { getSqlClient } from "./index";
import { resolveAdminPrincipal, type AdminPrincipalInput, type BackendRole } from "./permissions";
import type { AdminNavEvent } from "./admin-ui";

const loadNavigationEvents = cache(async (principalId: string, role: BackendRole): Promise<AdminNavEvent[]> => {
  const sql = getSqlClient();
  const rows = await sql<Array<AdminNavEvent & { venueName: string | null }>>`
    select e.id,e.short_title as "shortTitle",e.station_no as "stationNo",e.status,
      e.start_date as "startDate",e.end_date as "endDate",e.city,
      v.name as "venueName",e.publish_status as "publishStatus"
    from public.events e
    left join public.venues v on v.id=e.venue_id
    where ${role}='system_admin'
      or exists (
        select 1 from public.event_members em
        where em.event_id=e.id and em.user_id=${principalId} and em.status='active'
      )
    order by e.year desc,e.station_no desc
  `;
  return rows.map((row) => ({ ...row, venueName: row.venueName ?? "" }));
});

/**
 * Fast path for callers that already authenticated the admin session.
 * The primitive-keyed React cache also deduplicates layout + page navigation
 * reads during the same server render without persisting authenticated data.
 */
export async function getAdminNavigationEventsForPrincipal(input: AdminPrincipalInput): Promise<AdminNavEvent[]> {
  const principal = await resolveAdminPrincipal(input);
  return loadNavigationEvents(principal.id, principal.role);
}
