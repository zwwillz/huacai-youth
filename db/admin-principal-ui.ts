import { getSqlClient } from "./index";
import { resolveAdminPrincipal, type AdminPrincipalInput } from "./permissions";
import type { AdminNavEvent } from "./admin-ui";

/**
 * Fast path for callers that already authenticated the admin session.
 * Avoids re-reading public.users and avoids a separate event_members lookup.
 */
export async function getAdminNavigationEventsForPrincipal(input: AdminPrincipalInput): Promise<AdminNavEvent[]> {
  const principal = await resolveAdminPrincipal(input);
  const sql = getSqlClient();
  const rows = await sql<Array<AdminNavEvent & { venueName: string | null }>>`
    select e.id,e.short_title as "shortTitle",e.station_no as "stationNo",e.status,
      e.start_date as "startDate",e.end_date as "endDate",e.city,
      v.name as "venueName",e.publish_status as "publishStatus"
    from public.events e
    left join public.venues v on v.id=e.venue_id
    where ${principal.role}='system_admin'
      or exists (
        select 1 from public.event_members em
        where em.event_id=e.id and em.user_id=${principal.id} and em.status='active'
      )
    order by e.year desc,e.station_no desc
  `;
  return rows.map((row) => ({ ...row, venueName: row.venueName ?? "" }));
}
