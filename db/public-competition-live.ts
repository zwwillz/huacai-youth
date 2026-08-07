import { getSqlClient } from "./index";
import type { Group, PhaseId } from "@/app/public-types";

export type PublicLiveMatch = {
  id: string;
  eventId: string;
  drawSessionId: string;
  groupId: string;
  group: Group;
  phaseId: PhaseId;
  divisionNo: number | null;
  roundNo: number;
  roundName: string;
  matchCode: string;
  sourceAType: string;
  sourceARef: string | null;
  sourceBType: string;
  sourceBRef: string | null;
  playerAId: string | null;
  playerA: string | null;
  playerBId: string | null;
  playerB: string | null;
  scoreA: number | string | null;
  scoreB: number | string | null;
  resultType: string | null;
  resultStatus: string;
  status: string;
  winnerPlayerId: string | null;
  winnerPlayerName: string | null;
  date: string | null;
  time: string | null;
  table: string | null;
  isTv: boolean;
  sortOrder: number;
};

export type PublicPhaseSummary = {
  eventId: string;
  drawSessionId: string;
  groupId: string;
  group: Group;
  phaseId: PhaseId;
  versionNo: number;
  entrantCount: number;
  bracketSize: number;
  divisionSize: number;
  divisionCount: number;
  directQualifierCount: number;
  rateQualifierCount: number;
  totalQualifierCount: number;
  playoffMatchCount: number;
  byeCount: number;
};

export type PublicQualificationEntry = {
  eventId: string;
  drawSessionId: string;
  groupId: string;
  group: Group;
  phaseId: PhaseId;
  playerId: string;
  playerName: string;
  entryType: string;
  selected: boolean;
  rankNo: number | null;
  divisionNo: number | null;
  gamesWon: number;
  gamesLost: number;
  gameWinRateBp: number;
  netGames: number;
};

export type PublicMainRosterEntry = {
  eventId: string;
  groupId: string;
  group: Group;
  playerId: string;
  playerName: string;
  sourceType: string;
  sortOrder: number;
};

export type PublicCompetitionEvent = {
  eventId: string;
  phaseSummaries: PublicPhaseSummary[];
  matches: PublicLiveMatch[];
  qualificationEntries: PublicQualificationEntry[];
  mainRoster: PublicMainRosterEntry[];
};

type SessionRow = PublicPhaseSummary;
type MatchRow = Omit<PublicLiveMatch, "group" | "phaseId"> & { groupName: string; phaseCode: string };
type QualificationRow = Omit<PublicQualificationEntry, "group" | "phaseId"> & { groupName: string; phaseCode: string };
type MainRosterRow = Omit<PublicMainRosterEntry, "group"> & { groupName: string };
type MatchPublicationSnapshot = { eventId: string; matches: Array<Pick<PublicLiveMatch, "id" | "playerAId" | "playerA" | "playerBId" | "playerB" | "scoreA" | "scoreB" | "resultType" | "resultStatus" | "status" | "winnerPlayerId" | "winnerPlayerName">> };

const phaseIds = new Set<PhaseId>(["qualifier-one", "qualifier-two", "main-one", "main-two"]);
function asPhaseId(value: string): PhaseId | null { return phaseIds.has(value as PhaseId) ? value as PhaseId : null; }
function asGroup(value: string): Group | null { return value === "少年组" || value === "青年组" ? value : null; }
function emptyEvent(eventId: string): PublicCompetitionEvent { return { eventId, phaseSummaries: [], matches: [], qualificationEntries: [], mainRoster: [] }; }

function scheduleSafeMatch(match: PublicLiveMatch): PublicLiveMatch {
  if (match.status === "auto_advanced") return match;
  return { ...match, scoreA: null, scoreB: null, resultType: null, resultStatus: "pending", status: match.status === "void" ? "void" : "pending", winnerPlayerId: null, winnerPlayerName: null };
}
function scheduleSnapshot(event: PublicCompetitionEvent): PublicCompetitionEvent {
  return { ...event, matches: event.matches.map(scheduleSafeMatch) };
}
function resultSnapshot(event: PublicCompetitionEvent): MatchPublicationSnapshot {
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
function parseScheduleSnapshot(value: string | null, eventId: string): PublicCompetitionEvent | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<PublicCompetitionEvent>;
    if (parsed.eventId !== eventId || !Array.isArray(parsed.phaseSummaries) || !Array.isArray(parsed.matches) || !Array.isArray(parsed.qualificationEntries) || !Array.isArray(parsed.mainRoster)) return null;
    return parsed as PublicCompetitionEvent;
  } catch { return null; }
}
function parseMatchSnapshot(value: string | null, eventId: string): MatchPublicationSnapshot | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<MatchPublicationSnapshot>;
    if (parsed.eventId !== eventId || !Array.isArray(parsed.matches)) return null;
    return parsed as MatchPublicationSnapshot;
  } catch { return null; }
}
function overlayResults(base: PublicCompetitionEvent, overlay: MatchPublicationSnapshot | null): PublicCompetitionEvent {
  if (!overlay) return base;
  const byId = new Map(overlay.matches.map((match) => [match.id, match]));
  return {
    ...base,
    matches: base.matches.map((match) => {
      const result = byId.get(match.id);
      return result ? { ...match, ...result } : match;
    }),
  };
}

/** Current confirmed backend state. Never call this directly from a public page; it is also used when creating a new publication snapshot. */
export async function getCurrentCompetitionEvents(eventIds: string[]): Promise<PublicCompetitionEvent[]> {
  if (!eventIds.length) return [];
  const sql = getSqlClient();
  const sessionRows = await sql<Array<SessionRow & { groupName: string; phaseCode: string }>>`
    select ds.event_id as "eventId", ds.id as "drawSessionId", ds.group_id as "groupId", eg.name as "groupName",
      ds.phase_code as "phaseCode", ds.version_no as "versionNo", ds.entrant_count as "entrantCount",
      ds.bracket_size as "bracketSize", ds.division_size as "divisionSize", ds.division_count as "divisionCount",
      ds.direct_qualifier_count as "directQualifierCount", ds.rate_qualifier_count as "rateQualifierCount",
      ds.total_qualifier_count as "totalQualifierCount", ds.playoff_match_count as "playoffMatchCount", ds.bye_count as "byeCount"
    from public.draw_sessions ds
    join public.event_groups eg on eg.id=ds.group_id
    where ds.event_id = any(${eventIds}::text[]) and ds.status='confirmed'
    order by ds.event_id, ds.group_id, ds.phase_code, ds.version_no desc
  `;
  const latestByKey = new Map<string, SessionRow>();
  for (const row of sessionRows) {
    const group = asGroup(row.groupName);
    const phaseId = asPhaseId(row.phaseCode);
    if (!group || !phaseId) continue;
    const key = `${row.eventId}|${row.groupId}|${phaseId}`;
    if (!latestByKey.has(key)) latestByKey.set(key, { ...row, group, phaseId });
  }
  const latestSessionIds = new Set([...latestByKey.values()].map((row) => row.drawSessionId));

  const matchRows = await sql<MatchRow[]>`
    select bm.id, bm.event_id as "eventId", bm.draw_session_id as "drawSessionId", bm.group_id as "groupId", eg.name as "groupName",
      bm.phase_code as "phaseCode", bm.division_no as "divisionNo", bm.round_no as "roundNo", bm.round_name as "roundName",
      bm.match_code as "matchCode", bm.source_a_type as "sourceAType", bm.source_a_ref as "sourceARef",
      bm.source_b_type as "sourceBType", bm.source_b_ref as "sourceBRef", bm.player_a_id as "playerAId", bm.player_a_name as "playerA",
      bm.player_b_id as "playerBId", bm.player_b_name as "playerB",
      case when bm.result_status='confirmed' or bm.status='auto_advanced' then bm.score_a else null end as "scoreA",
      case when bm.result_status='confirmed' or bm.status='auto_advanced' then bm.score_b else null end as "scoreB",
      case when bm.result_status='confirmed' or bm.status='auto_advanced' then bm.result_type else null end as "resultType",
      case when bm.result_status='confirmed' then 'confirmed' else 'pending' end as "resultStatus",
      case when bm.result_status='confirmed' then 'completed' else bm.status end as status,
      case when bm.result_status='confirmed' or bm.status='auto_advanced' then bm.winner_player_id else null end as "winnerPlayerId",
      case when bm.result_status='confirmed' or bm.status='auto_advanced' then bm.winner_player_name else null end as "winnerPlayerName",
      ts.match_date as date, ts.start_time as time, cet.display_name as "table", coalesce(cet.is_tv,false) as "isTv",
      bm.sort_order as "sortOrder"
    from public.competition_bracket_matches bm
    join public.event_groups eg on eg.id=bm.group_id
    left join public.competition_match_schedules cms on cms.bracket_match_id=bm.id
    left join public.competition_time_slots ts on ts.id=cms.time_slot_id
    left join public.competition_event_tables cet on cet.id=cms.table_id
    where bm.event_id = any(${eventIds}::text[])
    order by bm.event_id,bm.group_id,bm.phase_code,bm.sort_order,bm.id
  `;

  const qualificationRows = await sql<QualificationRow[]>`
    select qb.event_id as "eventId", qb.draw_session_id as "drawSessionId", qb.group_id as "groupId", eg.name as "groupName",
      qb.phase_code as "phaseCode", qe.player_id as "playerId", qe.player_name as "playerName", qe.entry_type as "entryType",
      qe.selected, qe.rank_no as "rankNo", qe.division_no as "divisionNo", qe.games_won as "gamesWon", qe.games_lost as "gamesLost",
      qe.game_win_rate_bp as "gameWinRateBp", qe.net_games as "netGames"
    from public.competition_qualification_batches qb
    join public.competition_qualification_entries qe on qe.batch_id=qb.id
    join public.event_groups eg on eg.id=qb.group_id
    where qb.event_id = any(${eventIds}::text[]) and qb.status='confirmed'
    order by qb.event_id,qb.group_id,qb.phase_code,case when qe.entry_type='direct' then 0 else 1 end,coalesce(qe.rank_no,999),qe.division_no
  `;

  const mainRosterRows = await sql<MainRosterRow[]>`
    select pe.event_id as "eventId", pe.group_id as "groupId", eg.name as "groupName", pe.player_id as "playerId", pe.player_name as "playerName",
      pe.source_type as "sourceType", pe.sort_order as "sortOrder"
    from public.competition_phase_entries pe
    join public.event_groups eg on eg.id=pe.group_id
    where pe.event_id = any(${eventIds}::text[]) and pe.phase_code='main-one' and pe.status='active'
      and exists (select 1 from public.competition_main_roster_locks ml where ml.event_id=pe.event_id and ml.group_id=pe.group_id and ml.status='locked')
    order by pe.event_id,pe.group_id,pe.sort_order,pe.player_name
  `;

  const events = new Map<string, PublicCompetitionEvent>();
  const ensure = (eventId: string) => { let value = events.get(eventId); if (!value) { value = emptyEvent(eventId); events.set(eventId, value); } return value; };
  for (const summary of latestByKey.values()) ensure(summary.eventId).phaseSummaries.push(summary);
  for (const row of matchRows) {
    if (!latestSessionIds.has(row.drawSessionId)) continue;
    const group = asGroup(row.groupName); const phaseId = asPhaseId(row.phaseCode);
    if (group && phaseId) ensure(row.eventId).matches.push({ ...row, group, phaseId });
  }
  for (const row of qualificationRows) {
    if (!latestSessionIds.has(row.drawSessionId)) continue;
    const group = asGroup(row.groupName); const phaseId = asPhaseId(row.phaseCode);
    if (group && phaseId) ensure(row.eventId).qualificationEntries.push({ ...row, group, phaseId });
  }
  for (const row of mainRosterRows) { const group = asGroup(row.groupName); if (group) ensure(row.eventId).mainRoster.push({ ...row, group }); }
  return [...events.values()];
}

export async function buildCompetitionPublicationSnapshot(eventId: string, moduleType: "schedule" | "matches") {
  const current = (await getCurrentCompetitionEvents([eventId]))[0] ?? emptyEvent(eventId);
  return moduleType === "schedule" ? scheduleSnapshot(current) : resultSnapshot(current);
}

/** Public state = last explicitly published schedule snapshot + last explicitly published result snapshot. */
export async function getPublicCompetitionEvents(eventIds: string[]): Promise<PublicCompetitionEvent[]> {
  if (!eventIds.length) return [];
  const sql = getSqlClient();
  const publicationRows = await sql<Array<{ eventId: string; moduleType: "schedule" | "matches"; status: string; snapshotJson: string | null }>>`
    select event_id as "eventId",module_type as "moduleType",status,snapshot_json as "snapshotJson"
    from public.publications
    where event_id=any(${eventIds}::text[]) and module_type in ('schedule','matches')
  `;
  const fallbackRows = await getCurrentCompetitionEvents(eventIds);
  const fallbackMap = new Map(fallbackRows.map((event) => [event.eventId, event]));
  const byPublication = new Map(publicationRows.map((row) => [`${row.eventId}|${row.moduleType}`, row]));

  return eventIds.map((eventId) => {
    const schedulePublication = byPublication.get(`${eventId}|schedule`);
    const matchPublication = byPublication.get(`${eventId}|matches`);
    if (schedulePublication?.status !== "published") return emptyEvent(eventId);

    const fallback = fallbackMap.get(eventId) ?? emptyEvent(eventId);
    const base = parseScheduleSnapshot(schedulePublication.snapshotJson, eventId) ?? scheduleSnapshot(fallback);
    if (matchPublication?.status !== "published") return base;
    const results = parseMatchSnapshot(matchPublication.snapshotJson, eventId) ?? resultSnapshot(fallback);
    return overlayResults(base, results);
  });
}
