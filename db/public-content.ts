import { inArray } from "drizzle-orm";
import { getDb } from "./index";
import { eventDocuments, eventGuides, publications } from "./schema";

export type PublicContentState = {
  stationId: string;
  eventId: string;
  shortTitle: string;
  publishedModules: string[];
  guides: {
    transport: { title: string; body: string; published: boolean };
    clothing: { title: string; body: string; published: boolean };
  };
  documents: {
    regulation: { url: string; published: boolean };
    referee_list: { url: string; published: boolean };
  };
};

export async function getPublicContentState(stations: Array<{ id: string; eventId: string; title: string }>): Promise<PublicContentState[]> {
  if (!stations.length) return [];
  const db = getDb();
  const eventIds = stations.map((station) => station.eventId);
  const [publicationRows, guideRows, documentRows] = await Promise.all([
    db.select().from(publications).where(inArray(publications.eventId, eventIds)),
    db.select().from(eventGuides).where(inArray(eventGuides.eventId, eventIds)),
    db.select().from(eventDocuments).where(inArray(eventDocuments.eventId, eventIds)),
  ]);

  return stations.map((station) => {
    const modules = publicationRows.filter((row) => row.eventId === station.eventId && row.status === "published").map((row) => row.moduleType);
    const guide = (type: "transport" | "clothing", fallback: string) => {
      const row = guideRows.find((item) => item.eventId === station.eventId && item.guideType === type);
      return { title: row?.title ?? fallback, body: row?.body ?? "", published: row?.publishStatus === "published" };
    };
    const document = (type: "regulation" | "referee_list") => {
      const row = documentRows.find((item) => item.eventId === station.eventId && item.documentType === type);
      return { url: row?.externalUrl || row?.fileKey || "", published: Boolean(row?.isPublished) && modules.includes("documents") };
    };
    return {
      stationId: station.id,
      eventId: station.eventId,
      shortTitle: station.title,
      publishedModules: modules,
      guides: {
        transport: guide("transport", "交通住宿攻略"),
        clothing: guide("clothing", "服装要求"),
      },
      documents: {
        regulation: document("regulation"),
        referee_list: document("referee_list"),
      },
    };
  });
}
