import { getSqlClient } from "./index";
import type { PublicCompetitionEvent, PublicLiveMatch } from "./public-competition-live";
import { getCompetitionMatches, type CompetitionMatch } from "./competition-matches";

type MatchSnapshot = { eventId: string; matches: Array<Pick<PublicLiveMatch, "id" | "playerAId" | "playerA" | "playerBId" | "playerB" | "scoreA" | "scoreB" | "resultType" | "resultStatus" | "status" | "winnerPlayerId" | "winnerPlayerName">> };
type PublicationRow = { eventId: string; moduleType: "schedule" | "matches"; status: string; snapshotJson: string | null };
type LegacyEventRow = { eventId: string };

function emptyEvent(eventId: string): PublicCompetitionEvent {
  return { eventId, phaseSummaries: [], matches: [], qualificationEntries: [], mainRoster: [] };
}
function hasCompetitionData(event: PublicCompetitionEvent | null) {
  return Boolean(event && (event.matches.length || event.phaseSummaries.length || event.mainRoster.length));
}
function legacyRoundNo(match: CompetitionMatch) {
  if (match.phaseId?.startsWith("qualifier")) return /附加赛|N进512/.test(`${match.round} ${match.progress}`) ? 0 : /256进128/.test(match.progress) ? 2 : /128进64/.test(match.progress) ? 3 : /64进32/.test(match.progress) ? 4 : /32进16/.test(match.progress) ? 5 : 1;
  if (match.phaseId === "main-one") return /晋级轮/.test(match.round) ? 2 : 1;
  if (match.phaseId === "main-two") return /32进16/.test(match.round) ? 1 : /16进8/.test(match.round) ? 2 : /8进4/.test(match.round) ? 3 : /半决赛/.test(match.round) ? 4 : 5;
  return 1;
}
function legacyWinner(match: CompetitionMatch) {
  if (match.statsScoreA == null || match.statsScoreB == null || match.statsScoreA === match.statsScoreB) return { id: null, name: null };
  return match.statsScoreA > match.statsScoreB ? { id: match.playerAId, name: match.playerA } : { id: match.playerBId, name: match.playerB };
}
function legacyCompetitionEvent(eventId: string, rows: CompetitionMatch[]): PublicCompetitionEvent {
  const ordered = rows.filter((row) => row.phaseId).sort((a, b) => a.group.localeCompare(b.group, "zh-CN") || String(a.phaseId).localeCompare(String(b.phaseId)) || a.order - b.order || a.id.localeCompare(b.id));
  const phaseIndexes = new Map<string, number>();
  const matches: PublicLiveMatch[] = ordered.map((row) => {
    const phaseId = row.phaseId!;
    const key = `${row.group}|${phaseId}`;
    const roundNo = legacyRoundNo(row);
    const index = phaseIndexes.get(key) ?? 0;
    if (roundNo > 0) phaseIndexes.set(key, index + 1);
    const groupLetter = row.matchCode.match(/^([A-H])/)?.[1];
    const divisionNo = phaseId.startsWith("qualifier")
      ? (roundNo === 0 ? null : Math.min(16, Math.floor(index / 16) + 1))
      : phaseId === "main-one" && groupLetter ? groupLetter.charCodeAt(0) - 64 : null;
    const localIndex = phaseId.startsWith("qualifier") ? index % 16 + 1 : index + 1;
    const isThird = phaseId === "main-two" && /三[、,，]?四名|季军/.test(row.round);
    const matchCode = phaseId.startsWith("qualifier")
      ? (roundNo === 0 ? `Q1-P${index + 1}` : `Q1-D${divisionNo}-R${roundNo}-M${localIndex}`)
      : isThird ? "M2-3RD" : phaseId === "main-two" ? `M2-R${roundNo}-M${localIndex}` : row.matchCode || `M1-${localIndex}`;
    const winner = legacyWinner(row);
    const confirmed = row.scoreA != null && row.scoreB != null;
    return {
      id: row.id,
      eventId,
      drawSessionId: `legacy:${eventId}:${row.group}:${phaseId}`,
      groupId: `legacy:${row.group}`,
      group: row.group,
      phaseId,
      divisionNo,
      roundNo,
      roundName: phaseId === "main-one" ? row.round.replace(/^[A-H]组\s*·\s*/, "") : row.round,
      matchCode,
      sourceAType: "legacy_database",
      sourceARef: null,
      sourceBType: "legacy_database",
      sourceBRef: null,
      playerAId: row.playerAId,
      playerA: row.playerA,
      playerBId: row.playerBId,
      playerB: row.playerB,
      scoreA: row.scoreA,
      scoreB: row.scoreB,
      resultType: row.resultType,
      resultStatus: confirmed ? "confirmed" : "pending",
      status: confirmed ? "completed" : "pending",
      winnerPlayerId: winner.id,
      winnerPlayerName: winner.name,
      date: row.date,
      time: row.time,
      table: row.table,
      isTv: row.isTv,
      sortOrder: row.order,
    };
  });

  const phaseSummaries = [...new Set(matches.map((match) => `${match.group}|${match.phaseId}`))].map((key) => {
    const [group, phaseId] = key.split("|") as [PublicLiveMatch["group"], PublicLiveMatch["phaseId"]];
    const scoped = matches.filter((match) => match.group === group && match.phaseId === phaseId);
    const players = new Set(scoped.flatMap((match) => [match.playerA, match.playerB]).filter((name) => name && !/^(BYE|轮空|待定)$/.test(name)));
    const qualifier = phaseId.startsWith("qualifier");
    return {
      eventId,
      drawSessionId: `legacy:${eventId}:${group}:${phaseId}`,
      groupId: `legacy:${group}`,
      group,
      phaseId,
      versionNo: 1,
      entrantCount: players.size,
      bracketSize: qualifier ? 512 : phaseId === "main-one" ? 64 : 32,
      divisionSize: qualifier ? 32 : phaseId === "main-one" ? 8 : 32,
      divisionCount: qualifier ? 16 : phaseId === "main-one" ? 8 : 1,
      directQualifierCount: qualifier ? 16 : 0,
      rateQualifierCount: qualifier ? 8 : 0,
      totalQualifierCount: qualifier ? 24 : phaseId === "main-one" ? 32 : 1,
      playoffMatchCount: scoped.filter((match) => match.roundNo === 0).length,
      byeCount: qualifier ? Math.max(0, 512 - players.size) : 0,
    };
  });
  return { eventId, phaseSummaries, matches, qualificationEntries: [], mainRoster: [] };
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

async function loadExplicitLegacyEventIds(eventIds: string[]) {
  if (!eventIds.length) return new Set<string>();
  const sql = getSqlClient();
  const rows = await sql<LegacyEventRow[]>`
    select e.id as "eventId"
    from public.events e
    where e.id=any(${eventIds}::text[])
      and not exists (select 1 from public.competition_brackets b where b.event_id=e.id)
      and exists (
        select 1 from public.matches m
        where m.event_id=e.id
          and (m.source like 'static_%' or m.source like 'pdf_static_%')
      )
  `;
  return new Set(rows.map((row) => row.eventId));
}

/**
 * New database-driven events are snapshot-only on the public side.
 * Legacy fallback is restricted to events that are explicitly backed by imported/static match sources
 * and have no Competition-engine bracket data (for example the migrated Langfang event).
 */
export async function getPublishedCompetitionEvents(eventIds: string[]): Promise<PublicCompetitionEvent[]> {
  if (!eventIds.length) return [];
  const sql = getSqlClient();
  const [rows, legacyIds] = await Promise.all([
    sql<PublicationRow[]>`
      select event_id as "eventId",module_type as "moduleType",status,snapshot_json as "snapshotJson"
      from public.publications
      where event_id=any(${eventIds}::text[]) and module_type in ('schedule','matches')
    `,
    loadExplicitLegacyEventIds(eventIds),
  ]);
  const publications = new Map(rows.map((row) => [`${row.eventId}|${row.moduleType}`, row]));
  const legacyEvents = await Promise.all([...legacyIds].map(async (eventId) => legacyCompetitionEvent(eventId, await getCompetitionMatches(eventId))));
  const legacyMap = new Map(legacyEvents.map((event) => [event.eventId, event]));

  return eventIds.map((eventId) => {
    const schedule = publications.get(`${eventId}|schedule`);
    const matches = publications.get(`${eventId}|matches`);
    if (schedule?.status !== "published") return emptyEvent(eventId);

    const parsedSchedule = parseSchedule(schedule.snapshotJson, eventId);
    const legacy = legacyMap.get(eventId) ?? null;
    let base: PublicCompetitionEvent;
    if (parsedSchedule) {
      base = sanitizeSchedule(parsedSchedule);
      if (legacy && !hasCompetitionData(base) && hasCompetitionData(legacy)) base = sanitizeSchedule(legacy);
    } else if (legacy) {
      base = sanitizeSchedule(legacy);
    } else {
      return emptyEvent(eventId);
    }

    if (matches?.status !== "published") return base;
    const parsedResult = parseMatches(matches.snapshotJson, eventId);
    if (parsedResult) return overlay(base, parsedResult);
    if (legacy) return overlay(base, currentResults(legacy));
    // Never read live Competition-engine results for a new database event when its published snapshot is absent/invalid.
    return base;
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
