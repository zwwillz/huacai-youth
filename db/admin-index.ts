import { getDb } from "./index";
import { publications } from "./schema";
import { getAdminNavigationEvents } from "./admin-ui";

export async function getEventIndexData(username: string) {
  const db = getDb();
  const [events, publicationRows] = await Promise.all([
    getAdminNavigationEvents(username),
    db.select({ eventId: publications.eventId, status: publications.status }).from(publications),
  ]);
  const publishedCounts = new Map<string, number>();
  for (const row of publicationRows) {
    if (row.status !== "published") continue;
    publishedCounts.set(row.eventId, (publishedCounts.get(row.eventId) ?? 0) + 1);
  }
  return events.map((event) => ({ ...event, publicationCount: publishedCounts.get(event.id) ?? 0 }));
}
