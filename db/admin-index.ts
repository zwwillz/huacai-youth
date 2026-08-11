import { desc } from "drizzle-orm";
import { getDb, getSqlClient } from "./index";
import { events } from "./schema";
import { getAdminNavigationEvents } from "./admin-ui";
import { getAdminNavigationEventsForPrincipal } from "./admin-principal-ui";
import { getEventWorkflowSummaries } from "./event-workflow";
import { resolveAdminPrincipal, type AdminPrincipalInput } from "./permissions";

type EventIndexMetaRow = { id: string; year: number; fullTitle: string; isHidden: boolean; groupNames: string };

export async function getEventIndexData(input: AdminPrincipalInput) {
  const principal = await resolveAdminPrincipal(input);
  const [navEvents, workflows] = await Promise.all([
    getAdminNavigationEventsForPrincipal(principal),
    getEventWorkflowSummaries(principal),
  ]);
  if (!navEvents.length) return [];

  const sql = getSqlClient();
  const metaRows = await sql<EventIndexMetaRow[]>`
    select e.id,e.year,e.full_title as "fullTitle",coalesce(e.is_hidden,false) as "isHidden",
      coalesce((select string_agg(g.name,' · ' order by g.code) from public.event_groups g where g.event_id=e.id and g.status='active'),'') as "groupNames"
    from public.events e
  `;
  const metaById = new Map(metaRows.map((row) => [row.id, row]));
  const workflowById = new Map(workflows.map((workflow) => [workflow.event.id, workflow]));

  return navEvents.map((event) => {
    const meta = metaById.get(event.id);
    const workflow = workflowById.get(event.id);
    const action = workflow?.nextAction;
    return {
      ...event,
      year: meta?.year ?? new Date(event.startDate).getFullYear(),
      fullTitle: meta?.fullTitle || event.shortTitle,
      isHidden: Boolean(meta?.isHidden),
      groupNames: meta?.groupNames || "",
      continueHref: action?.kind === "link" && action.href ? action.href : `/admin?event=${encodeURIComponent(event.id)}`,
      continueLabel: action?.title || (event.status === "archived" ? "查看赛事" : "继续处理"),
    };
  });
}

export async function getNewEventDefaults(username: string) {
  const db = getDb();
  const [navEvents, yearRows] = await Promise.all([
    getAdminNavigationEvents(username),
    db.select({ year: events.year, stationNo: events.stationNo }).from(events).orderBy(desc(events.year), desc(events.stationNo)),
  ]);
  const currentYear = new Date().getFullYear();
  const latestYear = Math.max(currentYear, ...yearRows.map((row) => Number(row.year) || 0));
  const maxStation = yearRows.filter((row) => Number(row.year) === latestYear).reduce((max, row) => Math.max(max, Number(row.stationNo) || 0), 0);
  return { navEvents, latestYear, nextStationNo: maxStation + 1 };
}
