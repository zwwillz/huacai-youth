import { unstable_cache } from "next/cache";
import { getCompetitionPublicationVersion, getPublishedCompetitionEvents } from "@/db/public-competition-published";
import { getPublicRankings } from "@/db/rankings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getCachedPayload(eventId: string, version: string) {
  return unstable_cache(async () => {
    const [events, rankings] = await Promise.all([
      getPublishedCompetitionEvents([eventId]),
      getPublicRankings(eventId),
    ]);
    return {
      version,
      event: events[0] ?? { eventId, phaseSummaries: [], matches: [], qualificationEntries: [], mainRoster: [] },
      rankings,
    };
  }, ["public-competition-payload-v2", eventId, version], { revalidate: 300 })();
}

export async function GET(request: Request, context: { params: Promise<{ eventId: string }> }) {
  try {
    const { eventId } = await context.params;
    if (!eventId) return Response.json({ error: "缺少赛事ID。" }, { status: 400 });
    const version = await getCompetitionPublicationVersion(eventId);
    const url = new URL(request.url);
    if (url.searchParams.get("versionOnly") === "1") {
      return Response.json({ data: { version } }, { headers: { "cache-control": "no-store" } });
    }
    const data = await getCachedPayload(eventId, version);
    return Response.json({ data }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "赛事数据读取失败。" }, { status: 500 });
  }
}
