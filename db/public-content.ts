import { inArray } from "drizzle-orm";
import { getDb, getSqlClient } from "./index";
import { eventDocuments, publications } from "./schema";

export type PublicContentState = {
  stationId: string;
  eventId: string;
  shortTitle: string;
  publishedModules: string[];
  guides: Array<{ id: string; title: string; guideType: string }>;
  documents: {
    regulation: { url: string; published: boolean };
    referee_list: { url: string; published: boolean };
  };
};

type GuideSummaryRow = { id: string; event_id: string; guide_type: string; title: string; sort_order: number };

export async function getPublicContentState(stations: Array<{ id: string; eventId: string; title: string }>): Promise<PublicContentState[]> {
  if (!stations.length) return [];
  const db = getDb();
  const sql = getSqlClient();
  const eventIds = stations.map((station) => station.eventId);
  const [publicationRows, documentRows, guideRows] = await Promise.all([
    db.select().from(publications).where(inArray(publications.eventId, eventIds)),
    db.select().from(eventDocuments).where(inArray(eventDocuments.eventId, eventIds)),
    sql<GuideSummaryRow[]>`
      select id, event_id, guide_type, title, sort_order
      from public.event_guides
      where event_id = any(${eventIds}::text[]) and publish_status = 'published'
      order by event_id, sort_order asc, created_at asc
    `,
  ]);

  return stations.map((station) => {
    const modules = publicationRows.filter((row) => row.eventId === station.eventId && row.status === "published").map((row) => row.moduleType);
    const document = (type: "regulation" | "referee_list") => {
      const row = documentRows.find((item) => item.eventId === station.eventId && item.documentType === type);
      return { url: row?.externalUrl || row?.fileKey || "", published: Boolean(row?.isPublished) && modules.includes("documents") };
    };
    return {
      stationId: station.id,
      eventId: station.eventId,
      shortTitle: station.title,
      publishedModules: modules,
      guides: guideRows.filter((row) => row.event_id === station.eventId).map((row) => ({ id: row.id, title: row.title, guideType: row.guide_type })),
      documents: {
        regulation: document("regulation"),
        referee_list: document("referee_list"),
      },
    };
  });
}
