import { inArray } from "drizzle-orm";
import { getDb, getSqlClient } from "./index";
import { eventDocuments, publications } from "./schema";
import { parseMasterScheduleSnapshot, type MasterScheduleStage } from "./schedule-publish";

export type PublicContentState = {
  stationId: string;
  eventId: string;
  shortTitle: string;
  publishedModules: string[];
  masterSchedule?: {
    published: boolean;
    detailedScheduleReady: boolean;
    stages: MasterScheduleStage[];
  };
  guides: Array<{ id: string; title: string; guideType: string }>;
  documents: {
    regulation: { url: string; published: boolean };
    referee_list: { url: string; published: boolean };
  };
};

type GuideSummaryRow = { id: string; event_id: string; guide_type: string; title: string; sort_order: number };

function detailedScheduleReady(snapshot: string | null | undefined) {
  if (!snapshot) return false;
  try {
    const parsed = JSON.parse(snapshot) as { matches?: unknown[] };
    return Array.isArray(parsed.matches) && parsed.matches.length > 0;
  } catch {
    return false;
  }
}

export async function getPublicContentState(stations: Array<{ id: string; eventId: string; title: string }>): Promise<PublicContentState[]> {
  if (!stations.length) return [];
  const db = getDb();
  const sql = getSqlClient();
  const eventIds = stations.map((station) => station.eventId);
  const [publicationRows, documentRows, guideRows] = await Promise.all([
    db.select({
      eventId: publications.eventId,
      moduleType: publications.moduleType,
      status: publications.status,
      snapshotJson: publications.snapshotJson,
    }).from(publications).where(inArray(publications.eventId, eventIds)),
    db.select().from(eventDocuments).where(inArray(eventDocuments.eventId, eventIds)),
    sql<GuideSummaryRow[]>`
      select id, event_id, guide_type, title, sort_order
      from public.event_guides
      where event_id = any(${eventIds}::text[]) and publish_status = 'published'
      order by event_id, sort_order asc, created_at asc
    `,
  ]);

  return stations.map((station) => {
    const eventPublications = publicationRows.filter((row) => row.eventId === station.eventId);
    const modules = eventPublications.filter((row) => row.status === "published").map((row) => row.moduleType);
    const masterPublication = eventPublications.find((row) => row.moduleType === "master_schedule");
    const detailedPublication = eventPublications.find((row) => row.moduleType === "schedule");
    const masterSnapshot = parseMasterScheduleSnapshot(masterPublication?.snapshotJson ?? null);
    const document = (type: "regulation" | "referee_list") => {
      const row = documentRows.find((item) => item.eventId === station.eventId && item.documentType === type);
      return { url: row?.externalUrl || row?.fileKey || "", published: Boolean(row?.isPublished) && modules.includes("documents") };
    };
    return {
      stationId: station.id,
      eventId: station.eventId,
      shortTitle: station.title,
      publishedModules: modules,
      masterSchedule: {
        published: masterPublication?.status === "published" && Boolean(masterSnapshot?.stages.length),
        detailedScheduleReady: detailedPublication?.status === "published" && detailedScheduleReady(detailedPublication.snapshotJson),
        stages: masterPublication?.status === "published" ? (masterSnapshot?.stages ?? []) : [],
      },
      guides: guideRows.filter((row) => row.event_id === station.eventId).map((row) => ({ id: row.id, title: row.title, guideType: row.guide_type })),
      documents: {
        regulation: document("regulation"),
        referee_list: document("referee_list"),
      },
    };
  });
}
