import { desc } from "drizzle-orm";
import { getDb } from "./index";
import { events, publications } from "./schema";
import { getAdminNavigationEvents } from "./admin-ui";

export async function getEventIndexData(username: string) {
  const db = getDb();
  const [eventRows, publicationRows] = await Promise.all([
    getAdminNavigationEvents(username),
    db.select({ eventId: publications.eventId, status: publications.status }).from(publications),
  ]);
  const publishedCounts = new Map<string, number>();
  for (const row of publicationRows) {
    if (row.status !== "published") continue;
    publishedCounts.set(row.eventId, (publishedCounts.get(row.eventId) ?? 0) + 1);
  }
  return eventRows.map((event) => ({ ...event, publicationCount: publishedCounts.get(event.id) ?? 0 }));
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
