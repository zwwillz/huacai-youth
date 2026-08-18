const DEFAULT_SUPABASE_URL = "https://rtlvncsmbueatdzqvhbn.supabase.co";
const DEFAULT_PUBLISHABLE_KEY = "sb_publishable_SR0NVsqpSBGBMP3xg9utvQ_jywPEUNP";

const SUPABASE_URL = process.env.SNOOKER_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const SUPABASE_KEY = process.env.SNOOKER_SUPABASE_PUBLISHABLE_KEY || DEFAULT_PUBLISHABLE_KEY;
const REST_URL = `${SUPABASE_URL}/rest/v1`;

export const CURRENT_RANKING_KEYS = [
  "world_official",
  "one_year",
  "provisional_seeding",
  "provisional_eos",
] as const;

export type SnookerCurrentRankingKey = (typeof CURRENT_RANKING_KEYS)[number];
export type SnookerRankingSection = "current" | "qualification" | "history";

export type SnookerRankingHubRow = {
  listKey: SnookerCurrentRankingKey;
  playerUuid: string;
  playerSlug: string | null;
  rank: number;
  money: number;
  previousRank: number | null;
  rankChange: number | null;
};

export type SnookerRankingHubList = {
  key: SnookerCurrentRankingKey;
  titleZh: string;
  titleEn: string;
  descriptionZh: string;
  sourceName: string;
  sourceUrl: string | null;
  capturedAt: string | null;
  syncStatus: "synced" | "partial" | "pending" | "unavailable" | string;
  rows: SnookerRankingHubRow[];
};

export type SnookerRankingHub = {
  lists: SnookerRankingHubList[];
  loadedAt: string;
  online: boolean;
};

type RankingRow = {
  list_key: string;
  player_id: string;
  rank: number;
  points: number | string | null;
  ranking_money: number | string | null;
  previous_rank: number | null;
  rank_change: number | null;
  captured_at: string;
  title_zh: string | null;
  title_en: string | null;
  source_name: string | null;
  source_url: string | null;
};

type PlayerKeyRow = { id: string; slug: string };

type RankingListMetaRow = {
  list_key: string;
  title_zh: string;
  title_en: string;
  description_zh: string | null;
  source_name: string | null;
  source_url: string | null;
  sync_status: string;
  latest_captured_at: string | null;
};

const descriptions: Record<SnookerCurrentRankingKey, string> = {
  world_official: "官方两年滚动世界排名，决定当前世界排名与多数赛事种子顺序。",
  one_year: "仅统计本赛季排名赛奖金，用于观察单赛季表现及部分赛事资格竞争。",
  provisional_seeding: "按下一排名修订节点口径计算的临时排名，更接近下一次正式排名变化。",
  provisional_eos: "按赛季结束口径计算的预测排名，用于观察当前赛季结束时的排名位置。",
};

function isCurrentRankingKey(value: string): value is SnookerCurrentRankingKey {
  return (CURRENT_RANKING_KEYS as readonly string[]).includes(value);
}

async function rest<T>(resource: string, params: URLSearchParams, revalidate = 300): Promise<T> {
  const response = await fetch(`${REST_URL}/${resource}?${params.toString()}`, {
    headers: { apikey: SUPABASE_KEY, Accept: "application/json" },
    next: { revalidate },
  });
  if (!response.ok) throw new Error(`SNOOKER_RANKING_HUB_HTTP_${response.status}`);
  return response.json() as Promise<T>;
}

function moneyOf(row: RankingRow) {
  const value = Number(row.ranking_money ?? row.points ?? 0);
  return Number.isFinite(value) ? value : 0;
}

export async function loadSnookerRankingHub(): Promise<SnookerRankingHub> {
  const loadedAt = new Date().toISOString();
  try {
    const keys = `(${CURRENT_RANKING_KEYS.join(",")})`;
    const [rankingRows, playerRows, metaRows] = await Promise.all([
      rest<RankingRow[]>("snooker_latest_rankings", new URLSearchParams({
        select: "list_key,player_id,rank,points,ranking_money,previous_rank,rank_change,captured_at,title_zh,title_en,source_name,source_url",
        list_key: `in.${keys}`,
        order: "list_key.asc,rank.asc",
      }), 300),
      rest<PlayerKeyRow[]>("snooker_players", new URLSearchParams({ select: "id,slug" }), 1800),
      rest<RankingListMetaRow[]>("snooker_ranking_lists", new URLSearchParams({
        select: "list_key,title_zh,title_en,description_zh,source_name,source_url,sync_status,latest_captured_at",
        list_key: `in.${keys}`,
      }), 300),
    ]);

    const slugByUuid = new Map(playerRows.map((row) => [row.id, row.slug]));
    const metaByKey = new Map(metaRows.filter((row) => isCurrentRankingKey(row.list_key)).map((row) => [row.list_key, row]));
    const rowsByKey = new Map<SnookerCurrentRankingKey, SnookerRankingHubRow[]>();
    for (const key of CURRENT_RANKING_KEYS) rowsByKey.set(key, []);

    for (const row of rankingRows) {
      if (!isCurrentRankingKey(row.list_key)) continue;
      rowsByKey.get(row.list_key)?.push({
        listKey: row.list_key,
        playerUuid: row.player_id,
        playerSlug: slugByUuid.get(row.player_id) ?? null,
        rank: row.rank,
        money: moneyOf(row),
        previousRank: row.previous_rank,
        rankChange: row.rank_change,
      });
    }

    const lists = CURRENT_RANKING_KEYS.map((key) => {
      const meta = metaByKey.get(key);
      const sample = rankingRows.find((row) => row.list_key === key);
      return {
        key,
        titleZh: meta?.title_zh ?? sample?.title_zh ?? key,
        titleEn: meta?.title_en ?? sample?.title_en ?? key,
        descriptionZh: meta?.description_zh ?? descriptions[key],
        sourceName: meta?.source_name ?? sample?.source_name ?? "WPBSA",
        sourceUrl: meta?.source_url ?? sample?.source_url ?? null,
        capturedAt: meta?.latest_captured_at ?? sample?.captured_at ?? null,
        syncStatus: meta?.sync_status ?? "unavailable",
        rows: rowsByKey.get(key) ?? [],
      } satisfies SnookerRankingHubList;
    });

    return { lists, loadedAt, online: lists.some((list) => list.rows.length > 0) };
  } catch (error) {
    console.error("[snooker-ranking-hub] ranking read failed", error);
    return { lists: [], loadedAt, online: false };
  }
}
