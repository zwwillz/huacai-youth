import type {
  SnookerCalendarEvent,
  SnookerDashboardSnapshot,
  SnookerEvent,
  SnookerFrame,
  SnookerHeadToHead,
  SnookerHeadToHeadMeeting,
  SnookerMatch,
  SnookerMatchPlayerStatistics,
  SnookerPlayer,
  SnookerPrizeRow,
  SnookerRankingRow,
  SnookerRound,
  SnookerSeasonStatistics,
} from "./domain";
import { compactEventTypeLabel, normalizeEventTaxonomy, normalizePlayerStatus } from "./taxonomy";

const DEFAULT_SUPABASE_URL = "https://rtlvncsmbueatdzqvhbn.supabase.co";
const DEFAULT_PUBLISHABLE_KEY = "sb_publishable_SR0NVsqpSBGBMP3xg9utvQ_jywPEUNP";
const SUPABASE_URL = process.env.SNOOKER_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const SUPABASE_KEY = process.env.SNOOKER_SUPABASE_PUBLISHABLE_KEY || DEFAULT_PUBLISHABLE_KEY;
const REST_URL = `${SUPABASE_URL}/rest/v1`;

const PAGE_SIZE = 1000;
const MATCH_BATCH_SIZE = 64;
const WORKSPACE_CONCURRENCY = 3;

export type SnookerDashboardDataState = "fresh" | "stale" | "unavailable";
export type SnookerDashboardScope = "core" | "full";

export type SnookerDashboardSourceHealth = {
  online: boolean;
  accepted: boolean;
  fetchedAt: string;
  message: string;
  dataState: SnookerDashboardDataState;
  lastSuccessfulAt: string | null;
  durationMs: number;
  failedStage?: string;
  requestCount?: number;
};

export type SnookerDashboardPublicView = {
  snapshot: SnookerDashboardSnapshot;
  eventDetails: SnookerEvent[];
  loadedAt: string;
  dataVersion: string;
  dataState: Exclude<SnookerDashboardDataState, "unavailable">;
  lastSuccessfulAt: string;
  scope: SnookerDashboardScope;
  durationMs: number;
  requestCount: number;
};

type DbEvent = {
  id: string;
  slug: string;
  season: string;
  name_en: string;
  name_zh: string;
  sponsor_name: string | null;
  type_zh: string | null;
  event_type: string | null;
  event_stage: string | null;
  ranking_status: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  country_zh: string | null;
  city_zh: string | null;
  venue_zh: string | null;
  venue_en: string | null;
  winner_prize: number | null;
  runner_up_prize: number | null;
  currency: string | null;
  source_name: string | null;
  source_event_id: string | null;
  source_url: string | null;
  source_updated_at: string | null;
  referee_zh: string | null;
  data_ready: boolean;
  expected_match_count: number | null;
  previous_champion_name_zh: string | null;
  previous_champion_year: number | null;
};

type DbPlayer = {
  id: string;
  slug: string;
  name_en: string;
  name_zh: string;
  short_name_en: string | null;
  short_name_zh: string | null;
  nationality_zh: string | null;
  country_code: string | null;
  date_of_birth: string | null;
  turned_pro: number | null;
  current_rank: number | null;
  ranking_points: number | null;
  avatar_url: string | null;
  profile_source: string | null;
  is_current_tour: boolean;
  tour_status: string;
  player_status: string;
};

type DbRound = {
  id: string;
  event_id: string;
  round_key: string;
  label_en: string | null;
  label_zh: string | null;
  sort_order: number;
  best_of: number | null;
  loser_prize: number | null;
};

type DbMatch = {
  id: string;
  event_id: string;
  round_id: string | null;
  source_match_id: string | null;
  match_no: number | null;
  player1_id: string;
  player2_id: string;
  score1: number | null;
  score2: number | null;
  best_of: number | null;
  status: string;
  scheduled_at: string | null;
  session_label_zh: string | null;
  winner_id: string | null;
  note: string | null;
  source_updated_at: string | null;
};

type DbRanking = {
  player_id: string;
  rank: number;
  points: number | null;
  ranking_money: number | null;
  list_key: string;
};

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

type DbFrame = {
  match_id: string;
  frame_no: number;
  score1: number;
  score2: number;
  break1: number | null;
  break2: number | null;
  note: string | null;
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

type CoreBuild = {
  view: SnookerDashboardPublicView;
  playerCanonicalByUuid: Map<string, string>;
};

class DashboardReadError extends Error {
  stage: string;

  constructor(stage: string, message: string) {
    super(message);
    this.name = "DashboardReadError";
    this.stage = stage;
  }
}

type DashboardGlobalCache = typeof globalThis & {
  __snookerDashboardLastKnownGood?: SnookerDashboardPublicView;
};

function cacheStore() {
  return globalThis as DashboardGlobalCache;
}

function currentSeason(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value ?? now.getUTCFullYear());
  const month = Number(parts.find((part) => part.type === "month")?.value ?? now.getUTCMonth() + 1);
  const start = month >= 5 ? year : year - 1;
  return {
    label: `${start}/${String((start + 1) % 100).padStart(2, "0")}`,
    startYear: start,
  };
}

function todayInChina() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function statusFromDates(startDate: string, endDate: string): "upcoming" | "live" | "completed" {
  const today = todayInChina();
  if (today < startDate) return "upcoming";
  if (today > endDate) return "completed";
  return "live";
}

function statusLabel(status: "upcoming" | "live" | "completed") {
  if (status === "completed") return "已结束";
  if (status === "live") return "进行中";
  return "即将开始";
}

function matchStatus(value: string): SnookerMatch["status"] {
  if (value === "completed" || value === "walkover" || value === "live" || value === "session-break") return value;
  return "upcoming";
}

function matchStatusLabel(status: SnookerMatch["status"]) {
  if (status === "completed") return "已结束";
  if (status === "walkover") return "退赛晋级";
  if (status === "session-break") return "进行中 · 阶段休息";
  if (status === "live") return "进行中";
  return "待开始";
}

function canonicalPlayerId(slug: string) {
  return `p-${slug}`;
}

function chinaTimeLabel(value: string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const part = (name: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === name)?.value ?? "";
  return `${Number(part("month"))}月${Number(part("day"))}日 ${part("hour")}:${part("minute")}`;
}

function inFilter(ids: string[]) {
  return encodeURIComponent(`(${ids.join(",")})`);
}

function finite(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
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

async function rest<T>(path: string, stage: string, revalidate = 30): Promise<T> {
  const response = await fetch(`${REST_URL}/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Accept: "application/json",
    },
    next: { revalidate },
  });
  if (!response.ok) throw new DashboardReadError(stage, `SNOOKER_DASHBOARD_HTTP_${response.status}`);
  return response.json() as Promise<T>;
}

async function restAll<T>(basePath: string, stage: string, revalidate = 30): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const delimiter = basePath.includes("?") ? "&" : "?";
    const page = await rest<T[]>(`${basePath}${delimiter}limit=${PAGE_SIZE}&offset=${offset}`, stage, revalidate);
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

function idBatches(ids: string[], batchSize = MATCH_BATCH_SIZE) {
  const batches: string[][] = [];
  for (let index = 0; index < ids.length; index += batchSize) batches.push(ids.slice(index, index + batchSize));
  return batches;
}

async function restInBatches<T>(
  ids: string[],
  buildPath: (batch: string[]) => string,
  stage: string,
): Promise<T[]> {
  if (!ids.length) return [];
  const batches = idBatches(ids);
  const rows: T[] = [];
  for (let start = 0; start < batches.length; start += WORKSPACE_CONCURRENCY) {
    const group = batches.slice(start, start + WORKSPACE_CONCURRENCY);
    const results = await Promise.all(group.map((batch) => rest<T[]>(buildPath(batch), stage, 60)));
    for (const result of results) rows.push(...result);
  }
  return rows;
}

function mapPlayers(rows: DbPlayer[], seasonStats: DbSeasonStat[], rankings: DbRanking[]) {
  const officialByUuid = new Map(rankings.filter((row) => row.list_key === "world_official").map((row) => [row.player_id, row]));
  const seasonByUuid = new Map(seasonStats.map((row) => [row.player_id, mapSeason(row)]));
  const playerCanonicalByUuid = new Map<string, string>();
  const players: SnookerPlayer[] = rows.map((row) => {
    const id = canonicalPlayerId(row.slug);
    playerCanonicalByUuid.set(row.id, id);
    const official = officialByUuid.get(row.id);
    const currentRank = official?.rank ?? row.current_rank;
    const rankingPoints = official ? Number(official.ranking_money ?? official.points ?? 0) : row.ranking_points;
    return {
      id,
      slug: row.slug,
      nameEn: row.name_en,
      nameZh: row.name_zh,
      shortNameZh: row.short_name_zh || row.name_zh,
      ...(row.short_name_en ? { shortNameEn: row.short_name_en } : {}),
      nationalityZh: row.nationality_zh || "未知",
      countryCode: row.country_code || "",
      currentRank,
      rankingPoints,
      ...(row.date_of_birth ? { dateOfBirth: row.date_of_birth } : {}),
      ...(row.turned_pro ? { turnedPro: row.turned_pro } : {}),
      ...(row.avatar_url ? { avatarUrl: row.avatar_url } : {}),
      profileSource: row.profile_source === "WST" || row.profile_source === "snooker.org" ? row.profile_source : "curated",
      isCurrentTour: row.is_current_tour,
      tourStatus: row.tour_status,
      playerStatus: normalizePlayerStatus(row.player_status, row.is_current_tour, row.turned_pro),
      ...(seasonByUuid.has(row.id) ? { seasonStatistics: seasonByUuid.get(row.id) } : {}),
    };
  });
  return { players, playerCanonicalByUuid };
}

function buildEventDetails(
  eventRows: DbEvent[],
  roundRows: DbRound[],
  matchRows: DbMatch[],
  prizeRows: DbPrize[],
  playerCanonicalByUuid: Map<string, string>,
  loadedAt: string,
) {
  const roundsByEvent = new Map<string, DbRound[]>();
  const matchesByRound = new Map<string, DbMatch[]>();
  const prizesByEvent = new Map<string, SnookerPrizeRow[]>();

  for (const row of roundRows) {
    const list = roundsByEvent.get(row.event_id) ?? [];
    list.push(row);
    roundsByEvent.set(row.event_id, list);
  }
  for (const row of matchRows) {
    if (!row.round_id) continue;
    const list = matchesByRound.get(row.round_id) ?? [];
    list.push(row);
    matchesByRound.set(row.round_id, list);
  }
  for (const row of prizeRows) {
    const list = prizesByEvent.get(row.event_id) ?? [];
    list.push({
      key: row.prize_key,
      labelZh: row.label_zh,
      ...(row.label_en ? { labelEn: row.label_en } : {}),
      amount: Number(row.amount),
      currency: "GBP",
      sortOrder: row.sort_order,
      ...(row.is_total ? { isTotal: true } : {}),
    });
    prizesByEvent.set(row.event_id, list);
  }

  return eventRows.filter((row) => row.data_ready).map((eventRow): SnookerEvent => {
    const startDate = eventRow.start_date || loadedAt.slice(0, 10);
    const endDate = eventRow.end_date || startDate;
    const status = statusFromDates(startDate, endDate);
    let publishedMatchCount = 0;
    const rounds: SnookerRound[] = [...(roundsByEvent.get(eventRow.id) ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((roundRow) => {
        const matches: SnookerMatch[] = [...(matchesByRound.get(roundRow.id) ?? [])]
          .sort((a, b) => (a.match_no ?? 999999) - (b.match_no ?? 999999))
          .map((matchRow) => {
            publishedMatchCount += 1;
            const statusValue = matchStatus(matchRow.status);
            const winner = matchRow.winner_id ? playerCanonicalByUuid.get(matchRow.winner_id) : undefined;
            return {
              id: `db-${matchRow.id}`,
              roundKey: roundRow.round_key,
              roundLabelZh: roundRow.label_zh || roundRow.label_en || roundRow.round_key,
              matchNo: matchRow.match_no ?? 0,
              bestOf: matchRow.best_of || roundRow.best_of || 0,
              player1Id: playerCanonicalByUuid.get(matchRow.player1_id) || matchRow.player1_id,
              player2Id: playerCanonicalByUuid.get(matchRow.player2_id) || matchRow.player2_id,
              score1: matchRow.score1,
              score2: matchRow.score2,
              status: statusValue,
              statusLabelZh: matchStatusLabel(statusValue),
              ...(matchRow.scheduled_at ? { scheduledAt: matchRow.scheduled_at, timeLabelZh: chinaTimeLabel(matchRow.scheduled_at) } : {}),
              ...(matchRow.session_label_zh ? { sessionLabelZh: matchRow.session_label_zh } : {}),
              ...(matchRow.note ? { note: matchRow.note } : {}),
              ...(winner ? { winnerId: winner } : {}),
            };
          });
        return {
          key: roundRow.round_key,
          labelZh: roundRow.label_zh || roundRow.label_en || roundRow.round_key,
          labelEn: roundRow.label_en || roundRow.round_key,
          bestOf: roundRow.best_of || matches[0]?.bestOf || 0,
          ...(roundRow.loser_prize !== null ? { loserPrize: roundRow.loser_prize } : {}),
          matches,
        };
      });
    const taxonomy = normalizeEventTaxonomy(eventRow.event_type, eventRow.event_stage, eventRow.ranking_status, eventRow.type_zh);
    const expected = eventRow.expected_match_count ?? null;
    return {
      id: `db-event-${eventRow.id}`,
      sourceEventId: eventRow.source_event_id || "",
      slug: eventRow.slug,
      nameZh: eventRow.name_zh,
      nameEn: eventRow.name_en,
      ...(eventRow.sponsor_name ? { sponsorName: eventRow.sponsor_name } : {}),
      season: eventRow.season,
      typeZh: compactEventTypeLabel(taxonomy),
      eventType: taxonomy.eventType,
      eventStage: taxonomy.eventStage,
      rankingStatus: taxonomy.rankingStatus,
      status,
      statusLabelZh: statusLabel(status),
      startDate,
      endDate,
      cityZh: eventRow.city_zh || "待定",
      countryZh: eventRow.country_zh || "待定",
      venueZh: eventRow.venue_zh || "",
      ...(eventRow.venue_en ? { venueEn: eventRow.venue_en } : {}),
      ...(eventRow.previous_champion_name_zh ? { previousChampionZh: eventRow.previous_champion_name_zh } : {}),
      ...(eventRow.previous_champion_year ? { previousChampionYear: eventRow.previous_champion_year } : {}),
      winnerPrize: eventRow.winner_prize || 0,
      runnerUpPrize: eventRow.runner_up_prize || 0,
      currency: "GBP",
      ...(prizesByEvent.has(eventRow.id) ? { prizes: prizesByEvent.get(eventRow.id) } : {}),
      ...(eventRow.referee_zh ? { refereeZh: eventRow.referee_zh } : {}),
      sourceName: eventRow.source_name || "Snooker DB",
      sourceUrl: eventRow.source_url || "",
      snapshotAt: eventRow.source_updated_at || loadedAt,
      rounds,
      ...(expected ? { publishedMatchCount, schedulePartial: publishedMatchCount < expected } : {}),
    };
  });
}

function eventWinnerZh(event: SnookerEvent, playerById: Map<string, SnookerPlayer>) {
  const final = event.rounds.find((round) => round.key === "final")?.matches[0];
  return final?.winnerId ? playerById.get(final.winnerId)?.nameZh : undefined;
}

function makeCalendar(eventRows: DbEvent[], eventDetails: SnookerEvent[], playerById: Map<string, SnookerPlayer>, loadedAt: string) {
  const detailsBySlug = new Map(eventDetails.map((event) => [event.slug, event]));
  return eventRows.map((row): SnookerCalendarEvent => {
    const startDate = row.start_date || loadedAt.slice(0, 10);
    const endDate = row.end_date || startDate;
    const status = statusFromDates(startDate, endDate);
    const taxonomy = normalizeEventTaxonomy(row.event_type, row.event_stage, row.ranking_status, row.type_zh);
    const detail = detailsBySlug.get(row.slug);
    return {
      id: `db-calendar-${row.id}`,
      slug: row.slug,
      nameZh: row.name_zh,
      nameEn: row.name_en,
      season: row.season,
      typeZh: compactEventTypeLabel(taxonomy),
      eventType: taxonomy.eventType,
      eventStage: taxonomy.eventStage,
      rankingStatus: taxonomy.rankingStatus,
      status,
      statusLabelZh: statusLabel(status),
      startDate,
      endDate,
      cityZh: row.city_zh || "待定",
      countryZh: row.country_zh || "待定",
      ...(row.venue_zh ? { venueZh: row.venue_zh } : {}),
      ...(detail ? { winnerZh: eventWinnerZh(detail, playerById) } : {}),
      current: status === "live",
      dataReady: row.data_ready,
    };
  });
}

async function loadFreshCoreBuild(): Promise<CoreBuild> {
  const started = Date.now();
  const loadedAt = new Date().toISOString();
  const season = currentSeason();
  let requestCount = 0;
  const read = async <T>(path: string, stage: string, revalidate = 30) => {
    requestCount += 1;
    return rest<T>(path, stage, revalidate);
  };
  const readAll = async <T>(path: string, stage: string, revalidate = 30) => {
    const rows: T[] = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      requestCount += 1;
      const delimiter = path.includes("?") ? "&" : "?";
      const page = await rest<T[]>(`${path}${delimiter}limit=${PAGE_SIZE}&offset=${offset}`, stage, revalidate);
      rows.push(...page);
      if (page.length < PAGE_SIZE) break;
    }
    return rows;
  };

  const [eventRows, playerRows, rankingRows, seasonStats] = await Promise.all([
    read<DbEvent[]>(`snooker_events?select=id,slug,season,name_en,name_zh,sponsor_name,type_zh,event_type,event_stage,ranking_status,status,start_date,end_date,country_zh,city_zh,venue_zh,venue_en,winner_prize,runner_up_prize,currency,source_name,source_event_id,source_url,source_updated_at,referee_zh,data_ready,expected_match_count,previous_champion_name_zh,previous_champion_year&season=eq.${encodeURIComponent(season.label)}&order=start_date.asc`, "event_list", 30),
    readAll<DbPlayer>("snooker_players?select=id,slug,name_en,name_zh,short_name_en,short_name_zh,nationality_zh,country_code,date_of_birth,turned_pro,current_rank,ranking_points,avatar_url,profile_source,is_current_tour,tour_status,player_status&order=current_rank.asc.nullslast,name_en.asc", "player_directory", 300),
    read<DbRanking[]>("snooker_latest_rankings?select=player_id,rank,points,ranking_money,list_key&list_key=eq.world_official&order=rank.asc&limit=256", "ranking", 60),
    readAll<DbSeasonStat>(`snooker_player_season_stats?select=player_id,season_start_year,season_label,ranking,tournaments_won,points_scored,matches_played,matches_won,match_win_rate,average_shot_time,breaks_50_plus,breaks_100_plus,highest_break,season_147s,average_break&season_start_year=eq.${season.startYear}`, "season_analytics", 60),
  ]);

  const dataReadyIds = eventRows.filter((row) => row.data_ready).map((row) => row.id);
  const eventFilter = dataReadyIds.length ? inFilter(dataReadyIds) : "()";
  const [roundRows, matchRows, prizeRows] = dataReadyIds.length ? await Promise.all([
    readAll<DbRound>(`snooker_rounds?select=id,event_id,round_key,label_en,label_zh,sort_order,best_of,loser_prize&event_id=in.${eventFilter}&order=event_id.asc,sort_order.asc`, "round_list", 60),
    readAll<DbMatch>(`snooker_matches?select=id,event_id,round_id,source_match_id,match_no,player1_id,player2_id,score1,score2,best_of,status,scheduled_at,session_label_zh,winner_id,note,source_updated_at&event_id=in.${eventFilter}&order=event_id.asc,match_no.asc`, "match_list", 15),
    readAll<DbPrize>(`snooker_event_prizes?select=event_id,prize_key,label_zh,label_en,amount,currency,sort_order,is_total&event_id=in.${eventFilter}&order=event_id.asc,sort_order.asc`, "event_prizes", 300),
  ]) : [[], [], []] as [DbRound[], DbMatch[], DbPrize[]];

  const { players, playerCanonicalByUuid } = mapPlayers(playerRows, seasonStats, rankingRows);
  const eventDetails = buildEventDetails(eventRows, roundRows, matchRows, prizeRows, playerCanonicalByUuid, loadedAt);
  const playerById = new Map(players.map((player) => [player.id, player]));
  const calendar = makeCalendar(eventRows, eventDetails, playerById, loadedAt);
  const rankings: SnookerRankingRow[] = rankingRows
    .filter((row) => row.list_key === "world_official" && row.rank <= 16)
    .map((row) => ({
      rank: row.rank,
      playerId: playerCanonicalByUuid.get(row.player_id) || row.player_id,
      points: Number(row.ranking_money ?? row.points ?? 0),
    }));
  const active = eventDetails.find((event) => event.status === "live");
  const latestCompleted = [...eventDetails].filter((event) => event.status === "completed").sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
  const firstUpcoming = [...eventDetails].filter((event) => event.status === "upcoming").sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  const primary = active || latestCompleted || firstUpcoming || eventDetails[0];
  if (!primary) throw new DashboardReadError("event_list", "SNOOKER_DASHBOARD_NO_EVENT_DATA");

  const durationMs = Date.now() - started;
  const view: SnookerDashboardPublicView = {
    snapshot: {
      version: "1.0.0-dashboard-core",
      builtAt: loadedAt,
      event: primary,
      calendar,
      players,
      rankings,
    },
    eventDetails,
    loadedAt,
    dataVersion: loadedAt,
    dataState: "fresh",
    lastSuccessfulAt: loadedAt,
    scope: "core",
    durationMs,
    requestCount,
  };
  return { view, playerCanonicalByUuid };
}

function mergeWorkspace(
  core: SnookerDashboardPublicView,
  frames: DbFrame[],
  stats: DbMatchStat[],
  h2h: DbHeadToHead[],
  playerCanonicalByUuid: Map<string, string>,
  durationMs: number,
  requestCount: number,
): SnookerDashboardPublicView {
  const framesByMatch = new Map<string, SnookerFrame[]>();
  const statsByMatch = new Map<string, SnookerMatchPlayerStatistics[]>();
  const h2hByMatch = new Map<string, SnookerHeadToHead>();

  for (const row of frames) {
    const list = framesByMatch.get(row.match_id) ?? [];
    list.push({
      frameNo: row.frame_no,
      score1: row.score1,
      score2: row.score2,
      ...(row.break1 !== null ? { break1: row.break1 } : {}),
      ...(row.break2 !== null ? { break2: row.break2 } : {}),
      ...(row.note ? { note: row.note } : {}),
    });
    framesByMatch.set(row.match_id, list);
  }
  for (const list of framesByMatch.values()) list.sort((a, b) => a.frameNo - b.frameNo);

  for (const row of stats) {
    const playerId = playerCanonicalByUuid.get(row.player_id);
    if (!playerId) continue;
    const list = statsByMatch.get(row.match_id) ?? [];
    list.push(mapStat(row, playerId));
    statsByMatch.set(row.match_id, list);
  }

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

  const eventDetails = core.eventDetails.map((event) => ({
    ...event,
    rounds: event.rounds.map((round) => ({
      ...round,
      matches: round.matches.map((match) => {
        const matchUuid = match.id.startsWith("db-") ? match.id.slice(3) : null;
        if (!matchUuid) return match;
        return {
          ...match,
          ...(framesByMatch.has(matchUuid) ? { frames: framesByMatch.get(matchUuid) } : {}),
          ...(statsByMatch.has(matchUuid) ? { statistics: statsByMatch.get(matchUuid) } : {}),
          ...(h2hByMatch.has(matchUuid) ? { headToHead: h2hByMatch.get(matchUuid) } : {}),
        };
      }),
    })),
  }));
  const eventBySlug = new Map(eventDetails.map((event) => [event.slug, event]));
  const primary = eventBySlug.get(core.snapshot.event.slug) ?? eventDetails[0] ?? core.snapshot.event;
  return {
    ...core,
    snapshot: { ...core.snapshot, version: "1.0.0-dashboard-workspace", event: primary },
    eventDetails,
    scope: "full",
    durationMs,
    requestCount,
  };
}

export async function loadSnookerDashboardCore(options: { allowStale?: boolean } = {}): Promise<SnookerDashboardPublicView> {
  const allowStale = options.allowStale ?? false;
  try {
    const build = await loadFreshCoreBuild();
    cacheStore().__snookerDashboardLastKnownGood = build.view;
    return build.view;
  } catch (error) {
    const cached = cacheStore().__snookerDashboardLastKnownGood;
    if (allowStale && cached) {
      return {
        ...cached,
        dataState: "stale",
        scope: "core",
      };
    }
    throw error;
  }
}

export async function loadSnookerDashboardWorkspace(): Promise<SnookerDashboardPublicView> {
  const started = Date.now();
  const build = await loadFreshCoreBuild();
  const matchUuids = build.view.eventDetails.flatMap((event) => event.rounds.flatMap((round) => round.matches.map((match) => match.id.startsWith("db-") ? match.id.slice(3) : null))).filter((id): id is string => Boolean(id));
  let requestCount = build.view.requestCount;

  const readBatches = async <T>(buildPath: (batch: string[]) => string, stage: string) => {
    const batches = idBatches(matchUuids);
    const rows: T[] = [];
    for (let start = 0; start < batches.length; start += WORKSPACE_CONCURRENCY) {
      const group = batches.slice(start, start + WORKSPACE_CONCURRENCY);
      requestCount += group.length;
      const results = await Promise.all(group.map((batch) => rest<T[]>(buildPath(batch), stage, 60)));
      for (const result of results) rows.push(...result);
    }
    return rows;
  };

  const [frames, stats, h2h] = await Promise.all([
    readBatches<DbFrame>((batch) => `snooker_frames?select=match_id,frame_no,score1,score2,break1,break2,note&match_id=in.${inFilter(batch)}&order=match_id.asc,frame_no.asc`, "frame_detail"),
    readBatches<DbMatchStat>((batch) => `snooker_match_statistics?select=match_id,player_id,total_points,average_shot_time_seconds,pot_rate,breaks_50_plus,breaks_100_plus,highest_break,average_break,shots_taken,time_on_table_pct&match_id=in.${inFilter(batch)}`, "match_statistics"),
    readBatches<DbHeadToHead>((batch) => `snooker_match_head_to_head?select=match_id,meetings_before,player1_wins,player2_wins,player1_frames,player2_frames,recent_meetings,source_updated_at&match_id=in.${inFilter(batch)}`, "head_to_head"),
  ]);

  const view = mergeWorkspace(build.view, frames, stats, h2h, build.playerCanonicalByUuid, Date.now() - started, requestCount);
  cacheStore().__snookerDashboardLastKnownGood = {
    ...build.view,
    loadedAt: view.loadedAt,
    dataVersion: view.dataVersion,
    lastSuccessfulAt: view.lastSuccessfulAt,
  };
  return view;
}

export function dashboardErrorStage(error: unknown) {
  return error instanceof DashboardReadError ? error.stage : "unknown";
}

export function dashboardSourceHealth(view: SnookerDashboardPublicView): SnookerDashboardSourceHealth {
  return {
    online: view.dataState === "fresh",
    accepted: true,
    fetchedAt: view.loadedAt,
    message: view.dataState === "fresh"
      ? view.scope === "core"
        ? "首页轻量数据已连接；详细逐局与技术统计按需后台补全。"
        : "完整斯诺克数据库工作区已连接。"
      : "数据库本次读取失败，当前显示最近一次成功数据。",
    dataState: view.dataState,
    lastSuccessfulAt: view.lastSuccessfulAt,
    durationMs: view.durationMs,
    requestCount: view.requestCount,
  };
}
