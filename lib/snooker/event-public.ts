import type {
  SnookerEvent,
  SnookerFrame,
  SnookerHeadToHead,
  SnookerHeadToHeadMeeting,
  SnookerMatch,
  SnookerMatchPlayerStatistics,
  SnookerPrizeRow,
  SnookerRound,
} from "./domain";
import { compactEventTypeLabel, normalizeEventTaxonomy } from "./taxonomy";

const DEFAULT_SUPABASE_URL = "https://rtlvncsmbueatdzqvhbn.supabase.co";
const DEFAULT_PUBLISHABLE_KEY = "sb_publishable_SR0NVsqpSBGBMP3xg9utvQ_jywPEUNP";
const SUPABASE_URL = process.env.SNOOKER_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const SUPABASE_KEY = process.env.SNOOKER_SUPABASE_PUBLISHABLE_KEY || DEFAULT_PUBLISHABLE_KEY;
const REST_URL = `${SUPABASE_URL}/rest/v1`;
const PAGE_SIZE = 1000;
const BATCH_SIZE = 64;
const CONCURRENCY = 3;

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
  start_date: string | null;
  end_date: string | null;
  country_zh: string | null;
  city_zh: string | null;
  venue_zh: string | null;
  venue_en: string | null;
  winner_prize: number | null;
  runner_up_prize: number | null;
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
};

type DbPrize = {
  event_id: string;
  prize_key: string;
  label_zh: string;
  label_en: string | null;
  amount: number;
  sort_order: number;
  is_total: boolean;
};

type DbPlayerKey = { id: string; slug: string };

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

export type SnookerEventPublicResult = {
  event: SnookerEvent;
  loadedAt: string;
  dataVersion: string;
  durationMs: number;
  requestCount: number;
};

function inFilter(ids: string[]) {
  return encodeURIComponent(`(${ids.join(",")})`);
}

function statusFromDates(startDate: string, endDate: string): SnookerEvent["status"] {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  if (today < startDate) return "upcoming";
  if (today > endDate) return "completed";
  return "live";
}

function statusLabel(status: SnookerEvent["status"]) {
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

function finite(value: number | null | undefined) {
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

async function rest<T>(path: string, revalidate = 30): Promise<T> {
  const response = await fetch(`${REST_URL}/${path}`, {
    headers: { apikey: SUPABASE_KEY, Accept: "application/json" },
    next: { revalidate },
  });
  if (!response.ok) throw new Error(`SNOOKER_EVENT_HTTP_${response.status}`);
  return response.json() as Promise<T>;
}

async function restAll<T>(basePath: string, requestCounter: { value: number }, revalidate = 30): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    requestCounter.value += 1;
    const delimiter = basePath.includes("?") ? "&" : "?";
    const page = await rest<T[]>(`${basePath}${delimiter}limit=${PAGE_SIZE}&offset=${offset}`, revalidate);
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

function batches(ids: string[]) {
  const result: string[][] = [];
  for (let index = 0; index < ids.length; index += BATCH_SIZE) result.push(ids.slice(index, index + BATCH_SIZE));
  return result;
}

async function restBatches<T>(ids: string[], path: (batch: string[]) => string, counter: { value: number }) {
  const groups = batches(ids);
  const rows: T[] = [];
  for (let index = 0; index < groups.length; index += CONCURRENCY) {
    const current = groups.slice(index, index + CONCURRENCY);
    counter.value += current.length;
    const values = await Promise.all(current.map((batch) => rest<T[]>(path(batch), 30)));
    for (const value of values) rows.push(...value);
  }
  return rows;
}

export async function loadSnookerEventPublic(slug: string): Promise<SnookerEventPublicResult | null> {
  const started = Date.now();
  const loadedAt = new Date().toISOString();
  const counter = { value: 1 };
  const eventRows = await rest<DbEvent[]>(`snooker_events?select=id,slug,season,name_en,name_zh,sponsor_name,type_zh,event_type,event_stage,ranking_status,start_date,end_date,country_zh,city_zh,venue_zh,venue_en,winner_prize,runner_up_prize,source_name,source_event_id,source_url,source_updated_at,referee_zh,data_ready,expected_match_count,previous_champion_name_zh,previous_champion_year&slug=eq.${encodeURIComponent(slug)}&limit=1`, 30);
  const eventRow = eventRows[0];
  if (!eventRow || !eventRow.data_ready) return null;

  const eventId = eventRow.id;
  const [roundRows, matchRows, prizeRows] = await Promise.all([
    restAll<DbRound>(`snooker_rounds?select=id,event_id,round_key,label_en,label_zh,sort_order,best_of,loser_prize&event_id=eq.${eventId}&order=sort_order.asc`, counter, 60),
    restAll<DbMatch>(`snooker_matches?select=id,event_id,round_id,match_no,player1_id,player2_id,score1,score2,best_of,status,scheduled_at,session_label_zh,winner_id,note&event_id=eq.${eventId}&order=match_no.asc`, counter, 15),
    restAll<DbPrize>(`snooker_event_prizes?select=event_id,prize_key,label_zh,label_en,amount,sort_order,is_total&event_id=eq.${eventId}&order=sort_order.asc`, counter, 300),
  ]);

  const playerUuids = Array.from(new Set(matchRows.flatMap((row) => [row.player1_id, row.player2_id, row.winner_id].filter((id): id is string => Boolean(id)))));
  counter.value += playerUuids.length ? 1 : 0;
  const playerRows = playerUuids.length
    ? await rest<DbPlayerKey[]>(`snooker_players?select=id,slug&id=in.${inFilter(playerUuids)}`, 300)
    : [];
  const canonicalByUuid = new Map(playerRows.map((row) => [row.id, `p-${row.slug}`]));
  const matchUuids = matchRows.map((row) => row.id);

  const [frameRows, statRows, h2hRows] = await Promise.all([
    restBatches<DbFrame>(matchUuids, (batch) => `snooker_frames?select=match_id,frame_no,score1,score2,break1,break2,note&match_id=in.${inFilter(batch)}&order=match_id.asc,frame_no.asc`, counter),
    restBatches<DbMatchStat>(matchUuids, (batch) => `snooker_match_statistics?select=match_id,player_id,total_points,average_shot_time_seconds,pot_rate,breaks_50_plus,breaks_100_plus,highest_break,average_break,shots_taken,time_on_table_pct&match_id=in.${inFilter(batch)}`, counter),
    restBatches<DbHeadToHead>(matchUuids, (batch) => `snooker_match_head_to_head?select=match_id,meetings_before,player1_wins,player2_wins,player1_frames,player2_frames,recent_meetings,source_updated_at&match_id=in.${inFilter(batch)}`, counter),
  ]);

  const framesByMatch = new Map<string, SnookerFrame[]>();
  for (const row of frameRows) {
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

  const statsByMatch = new Map<string, SnookerMatchPlayerStatistics[]>();
  for (const row of statRows) {
    const canonical = canonicalByUuid.get(row.player_id);
    if (!canonical) continue;
    const list = statsByMatch.get(row.match_id) ?? [];
    list.push(mapStat(row, canonical));
    statsByMatch.set(row.match_id, list);
  }

  const h2hByMatch = new Map<string, SnookerHeadToHead>();
  for (const row of h2hRows) {
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

  const roundsById = new Map(roundRows.map((row) => [row.id, row]));
  const matchesByRound = new Map<string, DbMatch[]>();
  for (const row of matchRows) {
    if (!row.round_id) continue;
    const list = matchesByRound.get(row.round_id) ?? [];
    list.push(row);
    matchesByRound.set(row.round_id, list);
  }

  let publishedMatchCount = 0;
  const rounds: SnookerRound[] = [...roundRows]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((roundRow) => {
      const matches: SnookerMatch[] = [...(matchesByRound.get(roundRow.id) ?? [])]
        .sort((a, b) => (a.match_no ?? 999999) - (b.match_no ?? 999999))
        .map((matchRow) => {
          publishedMatchCount += 1;
          const status = matchStatus(matchRow.status);
          const winner = matchRow.winner_id ? canonicalByUuid.get(matchRow.winner_id) : undefined;
          return {
            id: `db-${matchRow.id}`,
            roundKey: roundRow.round_key,
            roundLabelZh: roundRow.label_zh || roundRow.label_en || roundRow.round_key,
            matchNo: matchRow.match_no ?? 0,
            bestOf: matchRow.best_of || roundRow.best_of || 0,
            player1Id: canonicalByUuid.get(matchRow.player1_id) || matchRow.player1_id,
            player2Id: canonicalByUuid.get(matchRow.player2_id) || matchRow.player2_id,
            score1: matchRow.score1,
            score2: matchRow.score2,
            status,
            statusLabelZh: matchStatusLabel(status),
            ...(matchRow.scheduled_at ? { scheduledAt: matchRow.scheduled_at, timeLabelZh: chinaTimeLabel(matchRow.scheduled_at) } : {}),
            ...(matchRow.session_label_zh ? { sessionLabelZh: matchRow.session_label_zh } : {}),
            ...(framesByMatch.has(matchRow.id) ? { frames: framesByMatch.get(matchRow.id) } : {}),
            ...(statsByMatch.has(matchRow.id) ? { statistics: statsByMatch.get(matchRow.id) } : {}),
            ...(h2hByMatch.has(matchRow.id) ? { headToHead: h2hByMatch.get(matchRow.id) } : {}),
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
  const startDate = eventRow.start_date || loadedAt.slice(0, 10);
  const endDate = eventRow.end_date || startDate;
  const eventStatus = statusFromDates(startDate, endDate);
  const prizes: SnookerPrizeRow[] = prizeRows.map((row) => ({
    key: row.prize_key,
    labelZh: row.label_zh,
    ...(row.label_en ? { labelEn: row.label_en } : {}),
    amount: Number(row.amount),
    currency: "GBP",
    sortOrder: row.sort_order,
    ...(row.is_total ? { isTotal: true } : {}),
  }));
  const expected = eventRow.expected_match_count ?? null;
  const event: SnookerEvent = {
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
    status: eventStatus,
    statusLabelZh: statusLabel(eventStatus),
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
    ...(prizes.length ? { prizes } : {}),
    ...(eventRow.referee_zh ? { refereeZh: eventRow.referee_zh } : {}),
    sourceName: eventRow.source_name || "Snooker DB",
    sourceUrl: eventRow.source_url || "",
    snapshotAt: eventRow.source_updated_at || loadedAt,
    rounds,
    ...(expected ? { publishedMatchCount, schedulePartial: publishedMatchCount < expected } : {}),
  };

  // Keep this read isolated by event. Home never needs to hydrate all season frame/H2H data.
  void roundsById;
  return { event, loadedAt, dataVersion: event.snapshotAt || loadedAt, durationMs: Date.now() - started, requestCount: counter.value };
}
