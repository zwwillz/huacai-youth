const DEFAULT_SUPABASE_URL = "https://rtlvncsmbueatdzqvhbn.supabase.co";
const DEFAULT_PUBLISHABLE_KEY = "sb_publishable_SR0NVsqpSBGBMP3xg9utvQ_jywPEUNP";

const SUPABASE_URL = process.env.SNOOKER_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const SUPABASE_KEY = process.env.SNOOKER_SUPABASE_PUBLISHABLE_KEY || DEFAULT_PUBLISHABLE_KEY;
const REST_URL = `${SUPABASE_URL}/rest/v1`;

export const QUALIFICATION_RANKING_KEYS = [
  "race_masters_2027",
  "race_crucible_2027",
  "race_players_championship",
  "race_tour_championship",
] as const;

export type SnookerQualificationRankingKey = (typeof QUALIFICATION_RANKING_KEYS)[number];

export type SnookerQualificationRow = {
  listKey: SnookerQualificationRankingKey;
  playerUuid: string;
  playerSlug: string | null;
  sourcePlayerName: string;
  rank: number;
  money: number;
};

export type SnookerQualificationList = {
  key: SnookerQualificationRankingKey;
  titleZh: string;
  titleEn: string;
  descriptionZh: string;
  sourceName: string;
  sourceUrl: string | null;
  capturedAt: string | null;
  cutoffDate: string | null;
  qualificationLimit: number | null;
  syncStatus: string;
  rows: SnookerQualificationRow[];
};

export type SnookerQualificationHub = {
  lists: SnookerQualificationList[];
  loadedAt: string;
  online: boolean;
};

type RankingRow = {
  list_key: string;
  player_id: string;
  source_player_name: string | null;
  rank: number;
  points: number | string | null;
  ranking_money: number | string | null;
  captured_at: string;
  source_name: string | null;
  source_url: string | null;
};

type PlayerKeyRow = { id: string; slug: string };

type MetaRow = {
  list_key: string;
  title_zh: string;
  title_en: string;
  description_zh: string | null;
  source_name: string | null;
  source_url: string | null;
  latest_captured_at: string | null;
  cutoff_date: string | null;
  qualification_limit: number | null;
  sync_status: string;
};

const fallbackDescriptions: Record<SnookerQualificationRankingKey, string> = {
  race_masters_2027: "截至2026英国锦标赛结束的2027大师赛资格排名，前16名进入大师赛。",
  race_crucible_2027: "截至2027巡回锦标赛结束的世锦赛资格排名，前16名直接进入克鲁斯堡正赛阶段。",
  race_players_championship: "按本赛季单赛季排名决定球员锦标赛资格，待官方本赛季截止口径确认后开放。",
  race_tour_championship: "按本赛季单赛季排名决定巡回锦标赛资格，待官方本赛季截止口径确认后开放。",
};

function isQualificationKey(value: string): value is SnookerQualificationRankingKey {
  return (QUALIFICATION_RANKING_KEYS as readonly string[]).includes(value);
}

async function rest<T>(resource: string, params: URLSearchParams, revalidate = 300): Promise<T> {
  const response = await fetch(`${REST_URL}/${resource}?${params.toString()}`, {
    headers: { apikey: SUPABASE_KEY, Accept: "application/json" },
    next: { revalidate },
  });
  if (!response.ok) throw new Error(`SNOOKER_QUALIFICATION_HUB_HTTP_${response.status}`);
  return response.json() as Promise<T>;
}

function moneyOf(row: RankingRow) {
  const value = Number(row.ranking_money ?? row.points ?? 0);
  return Number.isFinite(value) ? value : 0;
}

export async function loadSnookerQualificationHub(): Promise<SnookerQualificationHub> {
  const loadedAt = new Date().toISOString();
  try {
    const keys = `(${QUALIFICATION_RANKING_KEYS.join(",")})`;
    const [rankingResult, playerResult, metaResult] = await Promise.allSettled([
      rest<RankingRow[]>("snooker_latest_rankings", new URLSearchParams({
        select: "list_key,player_id,source_player_name,rank,points,ranking_money,captured_at,source_name,source_url",
        list_key: `in.${keys}`,
        order: "list_key.asc,rank.asc",
      }), 300),
      rest<PlayerKeyRow[]>("snooker_players", new URLSearchParams({ select: "id,slug" }), 1800),
      rest<MetaRow[]>("snooker_ranking_lists", new URLSearchParams({
        select: "list_key,title_zh,title_en,description_zh,source_name,source_url,latest_captured_at,cutoff_date,qualification_limit,sync_status",
        list_key: `in.${keys}`,
      }), 300),
    ]);

    if (rankingResult.status !== "fulfilled") throw rankingResult.reason;
    const rankingRows = rankingResult.value;
    const playerRows = playerResult.status === "fulfilled" ? playerResult.value : [];
    const metaRows = metaResult.status === "fulfilled" ? metaResult.value : [];
    if (playerResult.status === "rejected") console.error("[snooker-qualification-hub] player mapping unavailable", playerResult.reason);
    if (metaResult.status === "rejected") console.error("[snooker-qualification-hub] metadata unavailable", metaResult.reason);

    const slugByUuid = new Map(playerRows.map((row) => [row.id, row.slug]));
    const metaByKey = new Map(metaRows.filter((row) => isQualificationKey(row.list_key)).map((row) => [row.list_key, row]));
    const rowsByKey = new Map<SnookerQualificationRankingKey, SnookerQualificationRow[]>();
    for (const key of QUALIFICATION_RANKING_KEYS) rowsByKey.set(key, []);

    for (const row of rankingRows) {
      if (!isQualificationKey(row.list_key)) continue;
      rowsByKey.get(row.list_key)?.push({
        listKey: row.list_key,
        playerUuid: row.player_id,
        playerSlug: slugByUuid.get(row.player_id) ?? null,
        sourcePlayerName: row.source_player_name ?? "",
        rank: row.rank,
        money: moneyOf(row),
      });
    }

    const lists = QUALIFICATION_RANKING_KEYS.map((key) => {
      const meta = metaByKey.get(key);
      const sample = rankingRows.find((row) => row.list_key === key);
      return {
        key,
        titleZh: meta?.title_zh ?? key,
        titleEn: meta?.title_en ?? key,
        descriptionZh: meta?.description_zh ?? fallbackDescriptions[key],
        sourceName: meta?.source_name ?? sample?.source_name ?? "WPBSA",
        sourceUrl: meta?.source_url ?? sample?.source_url ?? null,
        capturedAt: meta?.latest_captured_at ?? sample?.captured_at ?? null,
        cutoffDate: meta?.cutoff_date ?? null,
        qualificationLimit: meta?.qualification_limit ?? null,
        syncStatus: meta?.sync_status ?? "unavailable",
        rows: rowsByKey.get(key) ?? [],
      } satisfies SnookerQualificationList;
    });

    return { lists, loadedAt, online: lists.some((list) => list.rows.length > 0) };
  } catch (error) {
    console.error("[snooker-qualification-hub] qualification ranking read failed", error);
    return { lists: [], loadedAt, online: false };
  }
}

export function qualificationRankingKey(value: string | null | undefined): SnookerQualificationRankingKey {
  return QUALIFICATION_RANKING_KEYS.find((key) => key === value) ?? "race_masters_2027";
}
