import { unstable_cache } from "next/cache";
import { getPublishedCompetitionEvents } from "@/db/public-competition-published";
import { getPublishedEventIds } from "@/db/public";
import { getPublicRankings } from "@/db/rankings";
import type { PublicCompetitionEvent, PublicLiveMatch } from "@/db/public-competition-live";

export type PublicDisplayMatch = Pick<PublicLiveMatch,
  "id" | "group" | "phaseId" | "divisionNo" | "roundNo" | "roundName" | "matchCode" |
  "playerA" | "playerB" | "scoreA" | "scoreB" | "resultStatus" | "status" |
  "winnerPlayerName" | "date" | "time" | "table" | "isTv"
>;

export type PublicCompetitionDisplayEvent = Omit<PublicCompetitionEvent, "matches"> & { matches: PublicDisplayMatch[] };

function compactEvent(event: PublicCompetitionEvent): PublicCompetitionDisplayEvent {
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

export function getCachedCompetitionEvent(eventId: string) {
  return unstable_cache(async () => {
    const events = await getPublishedCompetitionEvents([eventId]);
    return compactEvent(events[0] ?? { eventId, phaseSummaries: [], matches: [], qualificationEntries: [], mainRoster: [] });
  }, ["public-competition-event-v4", eventId], {
    revalidate: 300,
    tags: [`public-competition-${eventId}`],
  })();
}

export function getCachedCompetitionSummary(eventId: string) {
  return unstable_cache(async () => {
    const event = await getCachedCompetitionEvent(eventId);
    return { ...event, matches: [] } satisfies PublicCompetitionDisplayEvent;
  }, ["public-competition-summary-v1", eventId], {
    revalidate: 300,
    tags: [`public-competition-${eventId}`],
  })();
}

export function getCachedCompetitionRankings(eventId: string) {
  return unstable_cache(
    () => getPublicRankings(eventId),
    ["public-competition-rankings-v1", eventId],
    { revalidate: 300, tags: [`public-competition-${eventId}`] },
  )();
}

export async function competitionStaticParams() {
  const useCiBuildFallback = process.env.GITHUB_ACTIONS === "true"
    && (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (useCiBuildFallback) return [];
  const eventIds = await getPublishedEventIds();
  return eventIds.map((eventId) => ({ eventId }));
}
