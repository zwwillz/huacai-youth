import { inArray } from "drizzle-orm";
import { getDb, getSqlClient } from "./index";
import { eventDocuments, publications } from "./schema";
import { parseMasterScheduleSnapshot, SCHEDULE_GROUPS, type MasterScheduleStage, type ScheduleGroup } from "./schedule-publish";
import { parseRegulationSnapshot, type RegulationSnapshot } from "./regulation-snapshot-policy.mjs";

export type PublicGuideBlock =
  | { id: string; type: "paragraph"; text: string }
  | { id: string; type: "image"; imageUrl: string; caption: string }
  | { id: string; type: "columns"; left: string; right: string };

export type PublicContentState = {
  stationId: string;
  eventId: string;
  shortTitle: string;
  publishedModules: string[];
  regulation: RegulationSnapshot | null;
  ruleStandard: string;
  masterSchedule?: {
    groups: Record<ScheduleGroup, {
      published: boolean;
      stages: MasterScheduleStage[];
    }>;
  };
  guides: Array<{ id: string; title: string; guideType: string; blocks: PublicGuideBlock[] }>;
  documents: {
    regulation: { url: string; published: boolean };
    referee_list: { url: string; published: boolean };
  };
};

type GuideSummaryRow = {
  id: string;
  event_id: string;
  guide_type: string;
  title: string;
  sort_order: number;
  content_json: unknown;
  body: string | null;
};

function publicGuideBlocks(value: unknown, body: string | null): PublicGuideBlock[] {
  const blocks: PublicGuideBlock[] = [];
  if (Array.isArray(value)) {
    value.forEach((raw, index) => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return;
      const row = raw as Record<string, unknown>;
      const id = String(row.id || `guide-block-${index + 1}`);
      if (row.type === "paragraph") {
        blocks.push({ id, type: "paragraph", text: String(row.text || "") });
        return;
      }
      if (row.type === "image") {
        blocks.push({ id, type: "image", imageUrl: String(row.imageUrl || ""), caption: String(row.caption || "") });
        return;
      }
      if (row.type === "columns") {
        blocks.push({ id, type: "columns", left: String(row.left || ""), right: String(row.right || "") });
      }
    });
  }
  if (blocks.length) return blocks;
  const text = String(body || "").replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n").trim();
  return text ? [{ id: "legacy-body", type: "paragraph", text }] : [];
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
      select id, event_id, guide_type, title, sort_order, content_json, body
      from public.event_guides
      where event_id = any(${eventIds}::text[]) and publish_status = 'published'
      order by event_id, sort_order asc, created_at asc
    `,
  ]);

  return stations.map((station) => {
    const eventPublications = publicationRows.filter((row) => row.eventId === station.eventId);
    const regulationPublication = eventPublications.find((row) => row.moduleType === "regulation");
    const regulation = parseRegulationSnapshot(regulationPublication?.snapshotJson ?? null, regulationPublication?.status === "published");
    const modules = eventPublications
      .filter((row) => row.status === "published" && (row.moduleType !== "regulation" || Boolean(regulation)))
      .map((row) => row.moduleType);
    const masterPublication = eventPublications.find((row) => row.moduleType === "master_schedule");
    const masterSnapshot = parseMasterScheduleSnapshot(masterPublication?.snapshotJson ?? null, masterPublication?.status === "published");
    const document = (type: "regulation" | "referee_list") => {
      const row = documentRows.find((item) => item.eventId === station.eventId && item.documentType === type);
      return { url: row?.externalUrl || row?.fileKey || "", published: Boolean(row?.isPublished) && modules.includes("documents") };
    };
    const groups = {} as NonNullable<PublicContentState["masterSchedule"]>["groups"];
    for (const group of SCHEDULE_GROUPS) {
      groups[group] = {
        published: Boolean(masterSnapshot?.groups[group].published),
        stages: masterSnapshot?.groups[group].published ? masterSnapshot.groups[group].stages : [],
      };
    }
    return {
      stationId: station.id,
      eventId: station.eventId,
      shortTitle: station.title,
      publishedModules: modules,
      regulation,
      ruleStandard: regulation?.ruleStandard ?? "",
      masterSchedule: { groups },
      guides: guideRows
        .filter((row) => row.event_id === station.eventId)
        .map((row) => ({
          id: row.id,
          title: row.title,
          guideType: row.guide_type,
          blocks: publicGuideBlocks(row.content_json, row.body),
        })),
      documents: {
        regulation: document("regulation"),
        referee_list: document("referee_list"),
      },
    };
  });
}