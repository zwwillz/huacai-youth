import { getSqlClient } from "./index";
import { getCurrentCompetitionEvents, type PublicCompetitionEvent, type PublicLiveMatch } from "./public-competition-live";

type MatchSnapshot = { eventId: string; matches: Array<Pick<PublicLiveMatch, "id" | "playerAId" | "playerA" | "playerBId" | "playerB" | "scoreA" | "scoreB" | "resultType" | "resultStatus" | "status" | "winnerPlayerId" | "winnerPlayerName">> };
type PublicationRow = { eventId: string; moduleType: "schedule" | "matches"; status: string; snapshotJson: string | null };

function emptyEvent(eventId: string): PublicCompetitionEvent {
  return { eventId, phaseSummaries: [], matches: [], qualificationEntries: [], mainRoster: [] };
}
function sanitizeSchedule(event: PublicCompetitionEvent): PublicCompetitionEvent {
  return {
    ...event,
    matches: event.matches.map((match) => match.status === "auto_advanced" ? match : {
      ...match,
      scoreA: null,
      scoreB: null,
      resultType: null,
      resultStatus: "pending",
      status: match.status === "void" ? "void" : "pending",
      winnerPlayerId: null,
      winnerPlayerName: null,
    }),
  };
}
function currentResults(event: PublicCompetitionEvent): MatchSnapshot {
  return {
    eventId: event.eventId,
    matches: event.matches.map((match) => ({
      id: match.id,
      playerAId: match.playerAId,
      playerA: match.playerA,
      playerBId: match.playerBId,
      playerB: match.playerB,
      scoreA: match.scoreA,
      scoreB: match.scoreB,
      resultType: match.resultType,
      resultStatus: match.resultStatus,
      status: match.status,
      winnerPlayerId: match.winnerPlayerId,
      winnerPlayerName: match.winnerPlayerName,
    })),
  };
}
function parseSchedule(value: string | null, eventId: string) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<PublicCompetitionEvent>;
    if (parsed.eventId !== eventId || !Array.isArray(parsed.phaseSummaries) || !Array.isArray(parsed.matches) || !Array.isArray(parsed.qualificationEntries) || !Array.isArray(parsed.mainRoster)) return null;
    return parsed as PublicCompetitionEvent;
  } catch { return null; }
}
function parseMatches(value: string | null, eventId: string) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<MatchSnapshot>;
    if (parsed.eventId !== eventId || !Array.isArray(parsed.matches)) return null;
    return parsed as MatchSnapshot;
  } catch { return null; }
}
function overlay(base: PublicCompetitionEvent, result: MatchSnapshot | null) {
  if (!result) return base;
  const map = new Map(result.matches.map((match) => [match.id, match]));
  return { ...base, matches: base.matches.map((match) => ({ ...match, ...(map.get(match.id) ?? {}) })) };
}

export async function getPublishedCompetitionEvents(eventIds: string[]): Promise<PublicCompetitionEvent[]> {
  if (!eventIds.length) return [];
  const sql = getSqlClient();
  const rows = await sql<PublicationRow[]>`
    select event_id as "eventId",module_type as "moduleType",status,snapshot_json as "snapshotJson"
    from public.publications
    where event_id=any(${eventIds}::text[]) and module_type in ('schedule','matches')
  `;
  const publications = new Map(rows.map((row) => [`${row.eventId}|${row.moduleType}`, row]));
  const fallbackIds = eventIds.filter((eventId) => {
    const schedule = publications.get(`${eventId}|schedule`);
    const matches = publications.get(`${eventId}|matches`);
    return (schedule?.status === "published" && !parseSchedule(schedule.snapshotJson, eventId)) || (matches?.status === "published" && !parseMatches(matches.snapshotJson, eventId));
  });
  const fallbackRows = fallbackIds.length ? await getCurrentCompetitionEvents(fallbackIds) : [];
  const fallbackMap = new Map(fallbackRows.map((event) => [event.eventId, event]));

  return eventIds.map((eventId) => {
    const schedule = publications.get(`${eventId}|schedule`);
    const matches = publications.get(`${eventId}|matches`);
    if (schedule?.status !== "published") return emptyEvent(eventId);
    const current = fallbackMap.get(eventId) ?? emptyEvent(eventId);
    const base = parseSchedule(schedule.snapshotJson, eventId) ?? sanitizeSchedule(current);
    if (matches?.status !== "published") return base;
    const result = parseMatches(matches.snapshotJson, eventId) ?? currentResults(current);
    return overlay(base, result);
  });
}


export async function getCompetitionPublicationVersion(eventId: string) {
  const sql = getSqlClient();
  const rows = await sql<Array<{ moduleType: string; versionNo: number; status: string; updatedAt: string }>>`
    select module_type as "moduleType", version_no as "versionNo", status, updated_at as "updatedAt"
    from public.publications
    where event_id=${eventId} and module_type in ('schedule','matches','rankings')
    order by module_type
  `;
  return rows.map((row) => `${row.moduleType}:${row.status}:${row.versionNo}:${row.updatedAt}`).join("|");
}
