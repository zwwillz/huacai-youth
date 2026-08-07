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
  scoreA: number | null;
  scoreB: number | null;
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

type MatchRow = Omit<PublicLiveMatch, "group" | "phaseId"> & {
  groupName: string;
  phaseCode: string;
};

type QualificationRow = Omit<PublicQualificationEntry, "group" | "phaseId"> & {
  groupName: string;
  phaseCode: string;
};

type MainRosterRow = Omit<PublicMainRosterEntry, "group"> & { groupName: string };

const phaseIds = new Set<PhaseId>(["qualifier-one", "qualifier-two", "main-one", "main-two"]);
function asPhaseId(value: string): PhaseId | null {
  return phaseIds.has(value as PhaseId) ? value as PhaseId : null;
}
function asGroup(value: string): Group | null {
  return value === "少年组" || value === "青年组" ? value : null;
}

export async function getPublicCompetitionEvents(eventIds: string[]): Promise<PublicCompetitionEvent[]> {
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
      bm.player_b_id as "playerBId", bm.player_b_name as "playerB", bm.score_a as "scoreA", bm.score_b as "scoreB",
      bm.result_type as "resultType", bm.result_status as "resultStatus", bm.status,
      bm.winner_player_id as "winnerPlayerId", bm.winner_player_name as "winnerPlayerName",
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
    order by pe.event_id,pe.group_id,pe.sort_order,pe.player_name
  `;

  const events = new Map<string, PublicCompetitionEvent>();
  const ensure = (eventId: string) => {
    let value = events.get(eventId);
    if (!value) {
      value = { eventId, phaseSummaries: [], matches: [], qualificationEntries: [], mainRoster: [] };
      events.set(eventId, value);
    }
    return value;
  };

  for (const summary of latestByKey.values()) ensure(summary.eventId).phaseSummaries.push(summary);
  for (const row of matchRows) {
    if (!latestSessionIds.has(row.drawSessionId)) continue;
    const group = asGroup(row.groupName);
    const phaseId = asPhaseId(row.phaseCode);
    if (!group || !phaseId) continue;
    ensure(row.eventId).matches.push({ ...row, group, phaseId });
  }
  for (const row of qualificationRows) {
    if (!latestSessionIds.has(row.drawSessionId)) continue;
    const group = asGroup(row.groupName);
    const phaseId = asPhaseId(row.phaseCode);
    if (!group || !phaseId) continue;
    ensure(row.eventId).qualificationEntries.push({ ...row, group, phaseId });
  }
  for (const row of mainRosterRows) {
    const group = asGroup(row.groupName);
    if (!group) continue;
    ensure(row.eventId).mainRoster.push({ ...row, group });
  }

  return [...events.values()];
}
