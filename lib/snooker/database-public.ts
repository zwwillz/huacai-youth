import type {
  SnookerCalendarEvent,
  SnookerDashboardSnapshot,
  SnookerEvent,
  SnookerFrame,
  SnookerMatch,
  SnookerMatchStatus,
  SnookerPlayer,
  SnookerRankingRow,
  SnookerRound,
} from "./domain";
import { dashboardSnapshot } from "./foundation";

const DEFAULT_SUPABASE_URL = "https://rtlvncsmbueatdzqvhbn.supabase.co";
const DEFAULT_PUBLISHABLE_KEY = "sb_publishable_SR0NVsqpSBGBMP3xg9utvQ_jywPEUNP";

const SUPABASE_URL = process.env.SNOOKER_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const SUPABASE_KEY = process.env.SNOOKER_SUPABASE_PUBLISHABLE_KEY || DEFAULT_PUBLISHABLE_KEY;
const REST_URL = `${SUPABASE_URL}/rest/v1`;

export type SnookerDatabaseView = {
  snapshot: SnookerDashboardSnapshot;
  eventDetails: SnookerEvent[];
  loadedAt: string;
  databaseOnline: boolean;
};

type DbEvent = {
  id: string;
  slug: string;
  season: string;
  name_en: string;
  name_zh: string;
  sponsor_name: string | null;
  type_zh: string | null;
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
};

type DbPlayer = {
  id: string;
  slug: string;
  name_en: string;
  name_zh: string;
  short_name_zh: string | null;
  nationality_zh: string | null;
  country_code: string | null;
  date_of_birth: string | null;
  turned_pro: number | null;
  current_rank: number | null;
  ranking_points: number | null;
  profile_source: string | null;
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

type DbFrame = {
  id: string;
  match_id: string;
  frame_no: number;
  score1: number;
  score2: number;
  break1: number | null;
  break2: number | null;
  note: string | null;
};

type DbRanking = {
  captured_at: string;
  player_id: string;
  rank: number;
  points: number;
};

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

function matchStatus(value: string): SnookerMatchStatus {
  if (value === "completed" || value === "walkover" || value === "live" || value === "session-break") return value;
  return "upcoming";
}

function matchStatusLabel(status: SnookerMatchStatus) {
  if (status === "completed") return "已结束";
  if (status === "walkover") return "退赛晋级";
  if (status === "session-break") return "进行中 · 阶段休息";
  if (status === "live") return "进行中";
  return "待开始";
}

function typeZh(value: string | null): SnookerCalendarEvent["typeZh"] {
  if (value === "非排名赛" || value === "资格赛") return value;
  return "排名赛";
}

function playerId(slug: string) {
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

async function rest<T>(path: string): Promise<T> {
  const response = await fetch(`${REST_URL}/${path}`, {
    cache: "no-store",
    headers: {
      apikey: SUPABASE_KEY,
      Accept: "application/json",
    },
  });
  if (!response.ok) throw new Error(`SNOOKER_DB_HTTP_${response.status}`);
  return response.json() as Promise<T>;
}

function inFilter(ids: string[]) {
  return encodeURIComponent(`(${ids.join(",")})`);
}

function mapPlayers(rows: DbPlayer[]) {
  const uuidToCanonical = new Map<string, string>();
  const players: SnookerPlayer[] = rows.map((row) => {
    const id = playerId(row.slug);
    uuidToCanonical.set(row.id, id);
    return {
      id,
      slug: row.slug,
      nameEn: row.name_en,
      nameZh: row.name_zh,
      shortNameZh: row.short_name_zh || row.name_zh,
      nationalityZh: row.nationality_zh || "未知",
      countryCode: row.country_code || "",
      currentRank: row.current_rank,
      rankingPoints: row.ranking_points,
      ...(row.date_of_birth ? { dateOfBirth: row.date_of_birth } : {}),
      ...(row.turned_pro ? { turnedPro: row.turned_pro } : {}),
      profileSource: row.profile_source === "WST" || row.profile_source === "snooker.org" ? row.profile_source : "curated",
    };
  });
  return { players, uuidToCanonical };
}

function mapFrames(rows: DbFrame[]) {
  const byMatch = new Map<string, SnookerFrame[]>();
  for (const row of rows) {
    const item: SnookerFrame = {
      frameNo: row.frame_no,
      score1: row.score1,
      score2: row.score2,
      ...(row.break1 !== null ? { break1: row.break1 } : {}),
      ...(row.break2 !== null ? { break2: row.break2 } : {}),
      ...(row.note ? { note: row.note } : {}),
    };
    const list = byMatch.get(row.match_id) ?? [];
    list.push(item);
    byMatch.set(row.match_id, list);
  }
  for (const frames of byMatch.values()) frames.sort((a, b) => a.frameNo - b.frameNo);
  return byMatch;
}

function buildEventDetails(
  eventRows: DbEvent[],
  roundRows: DbRound[],
  matchRows: DbMatch[],
  frameRows: DbFrame[],
  uuidToCanonical: Map<string, string>,
  loadedAt: string,
) {
  const framesByMatch = mapFrames(frameRows);
  const roundsByEvent = new Map<string, DbRound[]>();
  for (const row of roundRows) {
    const list = roundsByEvent.get(row.event_id) ?? [];
    list.push(row);
    roundsByEvent.set(row.event_id, list);
  }
  const matchesByRound = new Map<string, DbMatch[]>();
  for (const row of matchRows) {
    if (!row.round_id) continue;
    const list = matchesByRound.get(row.round_id) ?? [];
    list.push(row);
    matchesByRound.set(row.round_id, list);
  }

  return eventRows.filter((row) => row.data_ready).map((eventRow): SnookerEvent => {
    const startDate = eventRow.start_date || loadedAt.slice(0, 10);
    const endDate = eventRow.end_date || startDate;
    const status = statusFromDates(startDate, endDate);
    const rounds: SnookerRound[] = [...(roundsByEvent.get(eventRow.id) ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((roundRow) => {
        const matches: SnookerMatch[] = [...(matchesByRound.get(roundRow.id) ?? [])]
          .sort((a, b) => (a.match_no ?? 999) - (b.match_no ?? 999))
          .map((matchRow) => {
            const p1 = uuidToCanonical.get(matchRow.player1_id) || matchRow.player1_id;
            const p2 = uuidToCanonical.get(matchRow.player2_id) || matchRow.player2_id;
            const winner = matchRow.winner_id ? uuidToCanonical.get(matchRow.winner_id) : undefined;
            const statusValue = matchStatus(matchRow.status);
            const frames = framesByMatch.get(matchRow.id);
            return {
              id: `db-${matchRow.id}`,
              roundKey: roundRow.round_key,
              roundLabelZh: roundRow.label_zh || roundRow.label_en || roundRow.round_key,
              matchNo: matchRow.match_no ?? 0,
              bestOf: matchRow.best_of || roundRow.best_of || 0,
              player1Id: p1,
              player2Id: p2,
              score1: matchRow.score1,
              score2: matchRow.score2,
              status: statusValue,
              statusLabelZh: matchStatusLabel(statusValue),
              ...(matchRow.scheduled_at ? { scheduledAt: matchRow.scheduled_at } : {}),
              ...(matchRow.scheduled_at ? { timeLabelZh: chinaTimeLabel(matchRow.scheduled_at) } : {}),
              ...(matchRow.session_label_zh ? { sessionLabelZh: matchRow.session_label_zh } : {}),
              ...(frames?.length ? { frames } : {}),
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

    return {
      id: `db-event-${eventRow.id}`,
      sourceEventId: eventRow.source_event_id || "",
      slug: eventRow.slug,
      nameZh: eventRow.name_zh,
      nameEn: eventRow.name_en,
      ...(eventRow.sponsor_name ? { sponsorName: eventRow.sponsor_name } : {}),
      season: eventRow.season,
      typeZh: typeZh(eventRow.type_zh),
      status,
      statusLabelZh: statusLabel(status),
      startDate,
      endDate,
      cityZh: eventRow.city_zh || "待定",
      countryZh: eventRow.country_zh || "待定",
      venueZh: eventRow.venue_zh || "",
      ...(eventRow.venue_en ? { venueEn: eventRow.venue_en } : {}),
      winnerPrize: eventRow.winner_prize || 0,
      runnerUpPrize: eventRow.runner_up_prize || 0,
      currency: "GBP",
      ...(eventRow.referee_zh ? { refereeZh: eventRow.referee_zh } : {}),
      sourceName: eventRow.source_name || "Snooker DB",
      sourceUrl: eventRow.source_url || "",
      snapshotAt: eventRow.source_updated_at || loadedAt,
      rounds,
    };
  });
}

function eventWinnerZh(event: SnookerEvent, playerById: Map<string, SnookerPlayer>) {
  const final = event.rounds.find((round) => round.key === "final")?.matches[0];
  return final?.winnerId ? playerById.get(final.winnerId)?.nameZh : undefined;
}

export async function loadSnookerDatabaseView(): Promise<SnookerDatabaseView> {
  const loadedAt = new Date().toISOString();
  try {
    const [eventRows, playerRows, rankingRows] = await Promise.all([
      rest<DbEvent[]>("snooker_events?select=id,slug,season,name_en,name_zh,sponsor_name,type_zh,status,start_date,end_date,country_zh,city_zh,venue_zh,venue_en,winner_prize,runner_up_prize,currency,source_name,source_event_id,source_url,source_updated_at,referee_zh,data_ready&season=eq.2026%2F27&order=start_date.asc"),
      rest<DbPlayer[]>("snooker_players?select=id,slug,name_en,name_zh,short_name_zh,nationality_zh,country_code,date_of_birth,turned_pro,current_rank,ranking_points,profile_source&order=current_rank.asc.nullslast,name_en.asc"),
      rest<DbRanking[]>("snooker_ranking_snapshots?select=captured_at,player_id,rank,points&season=eq.2026%2F27&order=captured_at.desc,rank.asc&limit=200"),
    ]);

    const { players, uuidToCanonical } = mapPlayers(playerRows);
    const dataReadyIds = eventRows.filter((row) => row.data_ready).map((row) => row.id);
    let roundRows: DbRound[] = [];
    let matchRows: DbMatch[] = [];
    let frameRows: DbFrame[] = [];

    if (dataReadyIds.length) {
      [roundRows, matchRows] = await Promise.all([
        rest<DbRound[]>(`snooker_rounds?select=id,event_id,round_key,label_en,label_zh,sort_order,best_of,loser_prize&event_id=in.${inFilter(dataReadyIds)}&order=sort_order.asc`),
        rest<DbMatch[]>(`snooker_matches?select=id,event_id,round_id,source_match_id,match_no,player1_id,player2_id,score1,score2,best_of,status,scheduled_at,session_label_zh,winner_id,note,source_updated_at&event_id=in.${inFilter(dataReadyIds)}&order=match_no.asc`),
      ]);
      const matchIds = matchRows.map((row) => row.id);
      if (matchIds.length) {
        frameRows = await rest<DbFrame[]>(`snooker_frames?select=id,match_id,frame_no,score1,score2,break1,break2,note&match_id=in.${inFilter(matchIds)}&order=frame_no.asc`);
      }
    }

    const eventDetails = buildEventDetails(eventRows, roundRows, matchRows, frameRows, uuidToCanonical, loadedAt);
    const playerByCanonical = new Map(players.map((player) => [player.id, player]));
    const detailsBySlug = new Map(eventDetails.map((event) => [event.slug, event]));
    const calendar: SnookerCalendarEvent[] = eventRows.map((row) => {
      const startDate = row.start_date || loadedAt.slice(0, 10);
      const endDate = row.end_date || startDate;
      const status = statusFromDates(startDate, endDate);
      const detail = detailsBySlug.get(row.slug);
      return {
        id: `db-calendar-${row.id}`,
        slug: row.slug,
        nameZh: row.name_zh,
        nameEn: row.name_en,
        season: row.season,
        typeZh: typeZh(row.type_zh),
        status,
        statusLabelZh: statusLabel(status),
        startDate,
        endDate,
        cityZh: row.city_zh || "待定",
        countryZh: row.country_zh || "待定",
        ...(row.venue_zh ? { venueZh: row.venue_zh } : {}),
        ...(detail ? { winnerZh: eventWinnerZh(detail, playerByCanonical) } : {}),
        current: status === "live",
        dataReady: row.data_ready,
      };
    });

    const latestCapturedAt = rankingRows[0]?.captured_at;
    const rankings: SnookerRankingRow[] = rankingRows
      .filter((row) => row.captured_at === latestCapturedAt && row.rank <= 16)
      .map((row) => ({
        rank: row.rank,
        playerId: uuidToCanonical.get(row.player_id) || row.player_id,
        points: Number(row.points),
      }));

    const activeDetail = eventDetails.find((event) => event.status === "live");
    const latestCompletedDetail = [...eventDetails]
      .filter((event) => event.status === "completed")
      .sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
    const primaryEvent = activeDetail || latestCompletedDetail || eventDetails[0] || dashboardSnapshot.event;

    return {
      snapshot: {
        ...dashboardSnapshot,
        version: "0.6.0-database-calendar",
        builtAt: loadedAt,
        event: primaryEvent,
        calendar,
        players: players.length ? players : dashboardSnapshot.players,
        rankings: rankings.length ? rankings : dashboardSnapshot.rankings,
      },
      eventDetails,
      loadedAt,
      databaseOnline: true,
    };
  } catch (error) {
    console.error("[snooker-db] public database read failed", error);
    return {
      snapshot: dashboardSnapshot,
      eventDetails: [dashboardSnapshot.event],
      loadedAt,
      databaseOnline: false,
    };
  }
}
