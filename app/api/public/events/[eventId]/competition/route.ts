import { unstable_cache } from "next/cache";
import { getCompetitionPublicationVersion, getPublishedCompetitionEvents } from "@/db/public-competition-published";
import { getPublicRankings } from "@/db/rankings";
import type { PublicCompetitionEvent, PublicLiveMatch } from "@/db/public-competition-live";
import { publicJson } from "../../../response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PublicDisplayMatch = Pick<PublicLiveMatch,
  "id" | "group" | "phaseId" | "divisionNo" | "roundNo" | "roundName" | "matchCode" |
  "playerA" | "playerB" | "scoreA" | "scoreB" | "resultStatus" | "status" |
  "winnerPlayerName" | "date" | "time" | "table" | "isTv"
>;

function compactEvent(event: PublicCompetitionEvent) {
  const matches: PublicDisplayMatch[] = event.matches.map((match) => ({
    id: match.id,
    group: match.group,
    phaseId: match.phaseId,
    divisionNo: match.divisionNo,
    roundNo: match.roundNo,
    roundName: match.roundName,
    matchCode: match.matchCode,
    playerA: match.playerA,
    playerB: match.playerB,
    scoreA: match.scoreA,
    scoreB: match.scoreB,
    resultStatus: match.resultStatus,
    status: match.status,
    winnerPlayerName: match.winnerPlayerName,
    date: match.date,
    time: match.time,
    table: match.table,
    isTv: match.isTv,
  }));
  return { ...event, matches };
}

function getCachedPayload(eventId: string) {
  return unstable_cache(async () => {
    const [events, rankings] = await Promise.all([
      getPublishedCompetitionEvents([eventId]),
      getPublicRankings(eventId),
    ]);
    return {
      event: compactEvent(events[0] ?? { eventId, phaseSummaries: [], matches: [], qualificationEntries: [], mainRoster: [] }),
      rankings,
    };
  }, ["public-competition-payload-v3", eventId], { revalidate: 300, tags: [`public-competition-${eventId}`] })();
}

export async function GET(request: Request, context: { params: Promise<{ eventId: string }> }) {
  const startedAt = performance.now();
  try {
    const { eventId } = await context.params;
    if (!eventId) return publicJson(request, { error: "缺少赛事ID。" }, { status: 400, cache: false });
    const url = new URL(request.url);
    if (url.searchParams.get("versionOnly") === "1") {
      const version = await getCompetitionPublicationVersion(eventId);
      return publicJson(request, { data: { version } }, { cache: false, durationMs: performance.now() - startedAt });
    }
    const [version, payload] = await Promise.all([
      getCompetitionPublicationVersion(eventId),
      getCachedPayload(eventId),
    ]);
    return publicJson(request, { data: { version, ...payload } }, { durationMs: performance.now() - startedAt });
  } catch (error) {
    return publicJson(request, { error: error instanceof Error ? error.message : "赛事数据读取失败。" }, { status: 500, cache: false, durationMs: performance.now() - startedAt });
  }
}
