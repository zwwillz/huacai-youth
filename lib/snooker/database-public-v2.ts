import type { SnookerDatabaseView } from "./database-public";
import { loadSnookerDatabaseView } from "./database-public";
import type {
  SnookerEvent,
  SnookerHeadToHead,
  SnookerHeadToHeadMeeting,
  SnookerMatchPlayerStatistics,
  SnookerPrizeRow,
  SnookerSeasonStatistics,
} from "./domain";

const DEFAULT_SUPABASE_URL = "https://rtlvncsmbueatdzqvhbn.supabase.co";
const DEFAULT_PUBLISHABLE_KEY = "sb_publishable_SR0NVsqpSBGBMP3xg9utvQ_jywPEUNP";
const SUPABASE_URL = process.env.SNOOKER_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const SUPABASE_KEY = process.env.SNOOKER_SUPABASE_PUBLISHABLE_KEY || DEFAULT_PUBLISHABLE_KEY;
const REST_URL = `${SUPABASE_URL}/rest/v1`;

type DbEventMeta = {
  id: string;
  slug: string;
  previous_champion_name_zh: string | null;
  previous_champion_year: number | null;
  expected_match_count: number | null;
};

type DbPrize = {
  event_id: string;
  prize_key: string;
  label_zh: string;
  label_en: string | null;
  amount: number;
  currency: string;
  sort_order: number;
  is_total: boolean;
};

type DbPlayerKey = { id: string; slug: string };

type Numeric = number | string | null;

type DbSeasonStat = {
  player_id: string;
  season_start_year: number;
  season_label: string;
  ranking: number | null;
  tournaments_won: number | null;
  points_scored: number | null;
  matches_played: number | null;
  matches_won: number | null;
  match_win_rate: Numeric;
  average_shot_time: Numeric;
  breaks_50_plus: number | null;
  breaks_100_plus: number | null;
  highest_break: number | null;
  season_147s: number | null;
  average_break: Numeric;
};

type DbMatchStat = {
  match_id: string;
  player_id: string;
  total_points: number | null;
  average_shot_time_seconds: number | null;
  pot_rate: number | null;
  breaks_50_plus: number | null;
  breaks_100_plus: number | null;
  highest_break: number | null;
  average_break: number | null;
  shots_taken: number | null;
  time_on_table_pct: number | null;
};

type DbHeadToHead = {
  match_id: string;
  meetings_before: number;
  player1_wins: number;
  player2_wins: number;
  player1_frames: number;
  player2_frames: number;
  recent_meetings: SnookerHeadToHeadMeeting[] | null;
  source_updated_at: string | null;
};

async function rest<T>(path: string, revalidate = 30): Promise<T> {
  const response = await fetch(`${REST_URL}/${path}`, {
    headers: { apikey: SUPABASE_KEY, Accept: "application/json" },
    next: { revalidate },
  });
  if (!response.ok) throw new Error(`SNOOKER_DB_V2_HTTP_${response.status}`);
  return response.json() as Promise<T>;
}

function inFilter(ids: string[]) {
  return encodeURIComponent(`(${ids.join(",")})`);
}

function dbEventUuid(event: SnookerEvent) {
  return event.id.startsWith("db-event-") ? event.id.slice("db-event-".length) : null;
}

function dbMatchUuid(matchId: string) {
  return matchId.startsWith("db-") ? matchId.slice(3) : null;
}

function finite(value: number | string | null | undefined) {
  return value === null || value === undefined || !Number.isFinite(Number(value)) ? undefined : Number(value);
}

function mapStat(row: DbMatchStat, playerId: string): SnookerMatchPlayerStatistics {
  return {
    playerId,
    ...(finite(row.total_points) !== undefined ? { totalPoints: finite(row.total_points) } : {}),
    ...(finite(row.average_shot_time_seconds) !== undefined ? { averageShotTimeSeconds: finite(row.average_shot_time_seconds) } : {}),
    ...(finite(row.pot_rate) !== undefined ? { potRate: finite(row.pot_rate) } : {}),
    ...(finite(row.breaks_50_plus) !== undefined ? { breaks50Plus: finite(row.breaks_50_plus) } : {}),
    ...(finite(row.breaks_100_plus) !== undefined ? { breaks100Plus: finite(row.breaks_100_plus) } : {}),
    ...(finite(row.highest_break) !== undefined ? { highestBreak: finite(row.highest_break) } : {}),
    ...(finite(row.average_break) !== undefined ? { averageBreak: finite(row.average_break) } : {}),
    ...(finite(row.shots_taken) !== undefined ? { shotsTaken: finite(row.shots_taken) } : {}),
    ...(finite(row.time_on_table_pct) !== undefined ? { timeOnTablePct: finite(row.time_on_table_pct) } : {}),
  };
}

function mapSeason(row: DbSeasonStat): SnookerSeasonStatistics {
  return {
    seasonStartYear: row.season_start_year,
    seasonLabel: row.season_label,
    ...(finite(row.ranking) !== undefined ? { ranking: finite(row.ranking) } : {}),
    ...(finite(row.tournaments_won) !== undefined ? { tournamentsWon: finite(row.tournaments_won) } : {}),
    ...(finite(row.points_scored) !== undefined ? { pointsScored: finite(row.points_scored) } : {}),
    ...(finite(row.matches_played) !== undefined ? { matchesPlayed: finite(row.matches_played) } : {}),
    ...(finite(row.matches_won) !== undefined ? { matchesWon: finite(row.matches_won) } : {}),
    ...(finite(row.match_win_rate) !== undefined ? { matchWinRate: finite(row.match_win_rate) } : {}),
    ...(finite(row.average_shot_time) !== undefined ? { averageShotTimeSeconds: finite(row.average_shot_time) } : {}),
    ...(finite(row.breaks_50_plus) !== undefined ? { breaks50Plus: finite(row.breaks_50_plus) } : {}),
    ...(finite(row.breaks_100_plus) !== undefined ? { breaks100Plus: finite(row.breaks_100_plus) } : {}),
    ...(finite(row.highest_break) !== undefined ? { highestBreak: finite(row.highest_break) } : {}),
    ...(finite(row.season_147s) !== undefined ? { season147s: finite(row.season_147s) } : {}),
    ...(finite(row.average_break) !== undefined ? { averageBreak: finite(row.average_break) } : {}),
  };
}

function enrichEvent(
  event: SnookerEvent,
  metaByUuid: Map<string, DbEventMeta>,
  prizesByEvent: Map<string, SnookerPrizeRow[]>,
  statsByMatch: Map<string, SnookerMatchPlayerStatistics[]>,
  h2hByMatch: Map<string, SnookerHeadToHead>,
) {
  const eventUuid = dbEventUuid(event);
  const meta = eventUuid ? metaByUuid.get(eventUuid) : undefined;
  let publishedMatchCount = 0;
  const rounds = event.rounds.map((round) => ({
    ...round,
    matches: round.matches.map((match) => {
      publishedMatchCount += 1;
      const matchUuid = dbMatchUuid(match.id);
      return {
        ...match,
        ...(matchUuid && statsByMatch.has(matchUuid) ? { statistics: statsByMatch.get(matchUuid) } : {}),
        ...(matchUuid && h2hByMatch.has(matchUuid) ? { headToHead: h2hByMatch.get(matchUuid) } : {}),
      };
    }),
  }));
  const expected = meta?.expected_match_count ?? null;
  return {
    ...event,
    rounds,
    ...(meta?.previous_champion_name_zh ? { previousChampionZh: meta.previous_champion_name_zh } : {}),
    ...(meta?.previous_champion_year ? { previousChampionYear: meta.previous_champion_year } : {}),
    ...(eventUuid && prizesByEvent.has(eventUuid) ? { prizes: prizesByEvent.get(eventUuid) } : {}),
    ...(expected ? { publishedMatchCount, schedulePartial: publishedMatchCount < expected } : {}),
  } satisfies SnookerEvent;
}

export async function loadSnookerDatabaseViewV2(): Promise<SnookerDatabaseView> {
  const base = await loadSnookerDatabaseView();
  if (!base.databaseOnline || !base.eventDetails.length) return base;

  try {
    const eventUuids = base.eventDetails.map(dbEventUuid).filter((id): id is string => Boolean(id));
    const matchUuids = base.eventDetails.flatMap((event) => event.rounds.flatMap((round) => round.matches.map((match) => dbMatchUuid(match.id)))).filter((id): id is string => Boolean(id));

    const [eventMeta, playerKeys, seasonStats, prizes, stats, h2h] = await Promise.all([
      rest<DbEventMeta[]>(`snooker_events?select=id,slug,previous_champion_name_zh,previous_champion_year,expected_match_count&id=in.${inFilter(eventUuids)}`),
      rest<DbPlayerKey[]>("snooker_players?select=id,slug"),
      rest<DbSeasonStat[]>("snooker_player_season_stats?select=player_id,season_start_year,season_label,ranking,tournaments_won,points_scored,matches_played,matches_won,match_win_rate,average_shot_time,breaks_50_plus,breaks_100_plus,highest_break,season_147s,average_break&season_start_year=eq.2026"),
      eventUuids.length ? rest<DbPrize[]>(`snooker_event_prizes?select=event_id,prize_key,label_zh,label_en,amount,currency,sort_order,is_total&event_id=in.${inFilter(eventUuids)}&order=sort_order.asc`) : Promise.resolve([]),
      matchUuids.length ? rest<DbMatchStat[]>(`snooker_match_statistics?select=match_id,player_id,total_points,average_shot_time_seconds,pot_rate,breaks_50_plus,breaks_100_plus,highest_break,average_break,shots_taken,time_on_table_pct&match_id=in.${inFilter(matchUuids)}`) : Promise.resolve([]),
      matchUuids.length ? rest<DbHeadToHead[]>(`snooker_match_head_to_head?select=match_id,meetings_before,player1_wins,player2_wins,player1_frames,player2_frames,recent_meetings,source_updated_at&match_id=in.${inFilter(matchUuids)}`) : Promise.resolve([]),
    ]);

    const playerCanonicalByUuid = new Map(playerKeys.map((row) => [row.id, `p-${row.slug}`]));
    const metaByUuid = new Map(eventMeta.map((row) => [row.id, row]));
    const seasonByPlayer = new Map<string, SnookerSeasonStatistics>();
    for (const row of seasonStats) {
      const canonical = playerCanonicalByUuid.get(row.player_id);
      if (canonical) seasonByPlayer.set(canonical, mapSeason(row));
    }

    const prizesByEvent = new Map<string, SnookerPrizeRow[]>();
    for (const row of prizes) {
      const item: SnookerPrizeRow = {
        key: row.prize_key,
        labelZh: row.label_zh,
        ...(row.label_en ? { labelEn: row.label_en } : {}),
        amount: Number(row.amount),
        currency: "GBP",
        sortOrder: row.sort_order,
        ...(row.is_total ? { isTotal: true } : {}),
      };
      const list = prizesByEvent.get(row.event_id) ?? [];
      list.push(item);
      prizesByEvent.set(row.event_id, list);
    }

    const statsByMatch = new Map<string, SnookerMatchPlayerStatistics[]>();
    for (const row of stats) {
      const canonical = playerCanonicalByUuid.get(row.player_id);
      if (!canonical) continue;
      const list = statsByMatch.get(row.match_id) ?? [];
      list.push(mapStat(row, canonical));
      statsByMatch.set(row.match_id, list);
    }

    const h2hByMatch = new Map<string, SnookerHeadToHead>();
    for (const row of h2h) {
      h2hByMatch.set(row.match_id, {
        meetings: row.meetings_before,
        player1Wins: row.player1_wins,
        player2Wins: row.player2_wins,
        player1Frames: row.player1_frames,
        player2Frames: row.player2_frames,
        recentMeetings: Array.isArray(row.recent_meetings) ? row.recent_meetings : [],
        ...(row.source_updated_at ? { sourceUpdatedAt: row.source_updated_at } : {}),
      });
    }

    const eventDetails = base.eventDetails.map((event) => enrichEvent(event, metaByUuid, prizesByEvent, statsByMatch, h2hByMatch));
    const primary = eventDetails.find((event) => event.slug === base.snapshot.event.slug) ?? eventDetails[0] ?? base.snapshot.event;
    const players = base.snapshot.players.map((player) => {
      const season = seasonByPlayer.get(player.id);
      return season ? { ...player, seasonStatistics: season } : player;
    });

    return {
      ...base,
      snapshot: {
        ...base.snapshot,
        version: "0.8.0-ui-performance",
        event: primary,
        players,
      },
      eventDetails,
    };
  } catch (error) {
    console.error("[snooker-db-v2] enrichment failed", error);
    return base;
  }
}
