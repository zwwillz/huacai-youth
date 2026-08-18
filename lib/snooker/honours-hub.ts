const DEFAULT_SUPABASE_URL = "https://rtlvncsmbueatdzqvhbn.supabase.co";
const DEFAULT_PUBLISHABLE_KEY = "sb_publishable_SR0NVsqpSBGBMP3xg9utvQ_jywPEUNP";

const SUPABASE_URL = process.env.SNOOKER_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const SUPABASE_KEY = process.env.SNOOKER_SUPABASE_PUBLISHABLE_KEY || DEFAULT_PUBLISHABLE_KEY;
const REST_URL = `${SUPABASE_URL}/rest/v1`;

export const HONOURS_METRIC_KEYS = [
  "ranking_titles",
  "triple_crown_titles",
  "world_championship_titles",
  "uk_championship_titles",
  "masters_titles",
  "ranking_finals",
  "career_147s",
] as const;

export type SnookerHonoursMetricKey = (typeof HONOURS_METRIC_KEYS)[number];

export type SnookerHonoursMetric = {
  key: SnookerHonoursMetricKey;
  labelZh: string;
  labelEn: string;
  shortLabelZh: string;
};

export type SnookerHonoursRow = {
  rank: number;
  playerId: string;
  playerSlug: string;
  value: number;
};

export type SnookerHonoursList = SnookerHonoursMetric & {
  rows: SnookerHonoursRow[];
};

export type SnookerHonoursHub = {
  sourceName: string;
  capturedAt: string | null;
  online: boolean;
  lists: SnookerHonoursList[];
};

type CareerRow = {
  player_id: string;
  ranking_titles: number | null;
  ranking_finals: number | null;
  masters_titles: number | null;
  uk_championship_titles: number | null;
  world_championship_titles: number | null;
  triple_crown_titles: number | null;
  career_147s: number | null;
  hide_stats: boolean | null;
  source_name: string | null;
  source_updated_at: string | null;
};

type PlayerRow = {
  id: string;
  slug: string;
  current_rank: number | null;
};

const metricDefinitions: SnookerHonoursMetric[] = [
  { key: "ranking_titles", labelZh: "排名赛冠军", labelEn: "RANKING TITLES", shortLabelZh: "排名赛" },
  { key: "triple_crown_titles", labelZh: "三大赛冠军", labelEn: "TRIPLE CROWN TITLES", shortLabelZh: "三大赛" },
  { key: "world_championship_titles", labelZh: "世锦赛冠军", labelEn: "WORLD CHAMPIONSHIP TITLES", shortLabelZh: "世锦赛" },
  { key: "uk_championship_titles", labelZh: "英锦赛冠军", labelEn: "UK CHAMPIONSHIP TITLES", shortLabelZh: "英锦赛" },
  { key: "masters_titles", labelZh: "大师赛冠军", labelEn: "MASTERS TITLES", shortLabelZh: "大师赛" },
  { key: "ranking_finals", labelZh: "排名赛决赛", labelEn: "RANKING FINALS", shortLabelZh: "决赛" },
  { key: "career_147s", labelZh: "生涯147", labelEn: "CAREER 147S", shortLabelZh: "147" },
];

async function rest<T>(resource: string, params: URLSearchParams, revalidate = 1800): Promise<T> {
  const response = await fetch(`${REST_URL}/${resource}?${params.toString()}`, {
    headers: { apikey: SUPABASE_KEY, Accept: "application/json" },
    next: { revalidate },
  });
  if (!response.ok) throw new Error(`SNOOKER_HONOURS_HUB_HTTP_${response.status}`);
  return response.json() as Promise<T>;
}

function metricValue(row: CareerRow, key: SnookerHonoursMetricKey) {
  const value = row[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function emptyHub(): SnookerHonoursHub {
  return {
    sourceName: "WST 职业生涯统计",
    capturedAt: null,
    online: false,
    lists: metricDefinitions.map((definition) => ({ ...definition, rows: [] })),
  };
}

export async function loadSnookerHonoursHub(): Promise<SnookerHonoursHub> {
  try {
    const [careerRows, playerRows] = await Promise.all([
      rest<CareerRow[]>("snooker_player_career_stats", new URLSearchParams({
        select: "player_id,ranking_titles,ranking_finals,masters_titles,uk_championship_titles,world_championship_titles,triple_crown_titles,career_147s,hide_stats,source_name,source_updated_at",
        hide_stats: "eq.false",
      }), 1800),
      rest<PlayerRow[]>("snooker_players", new URLSearchParams({
        select: "id,slug,current_rank",
      }), 1800),
    ]);

    const playerById = new Map(playerRows.map((player) => [player.id, player]));
    const eligible = careerRows.filter((row) => playerById.has(row.player_id) && row.hide_stats !== true);
    const capturedAt = eligible.reduce<string | null>((latestValue, row) => {
      if (!row.source_updated_at) return latestValue;
      return !latestValue || row.source_updated_at > latestValue ? row.source_updated_at : latestValue;
    }, null);
    const sourceName = eligible.find((row) => row.source_name)?.source_name || "WST 职业生涯统计";

    const lists = metricDefinitions.map((definition) => {
      const sorted = eligible
        .map((row) => {
          const player = playerById.get(row.player_id)!;
          const value = metricValue(row, definition.key);
          if (value === null || value <= 0) return null;
          return { row, player, value };
        })
        .filter((item): item is { row: CareerRow; player: PlayerRow; value: number } => Boolean(item))
        .sort((a, b) => {
          if (b.value !== a.value) return b.value - a.value;
          const rankingTitleDiff = (b.row.ranking_titles ?? 0) - (a.row.ranking_titles ?? 0);
          if (rankingTitleDiff !== 0) return rankingTitleDiff;
          const rankDiff = (a.player.current_rank ?? 9999) - (b.player.current_rank ?? 9999);
          return rankDiff || a.player.slug.localeCompare(b.player.slug);
        });

      let previousValue: number | null = null;
      let previousRank = 0;
      const rows = sorted.map((item, index) => {
        const rank = previousValue !== null && item.value === previousValue ? previousRank : index + 1;
        previousValue = item.value;
        previousRank = rank;
        return {
          rank,
          playerId: item.row.player_id,
          playerSlug: item.player.slug,
          value: item.value,
        } satisfies SnookerHonoursRow;
      });

      return { ...definition, rows } satisfies SnookerHonoursList;
    });

    return {
      sourceName,
      capturedAt,
      online: lists.some((list) => list.rows.length > 0),
      lists,
    };
  } catch (error) {
    console.error("[snooker-honours-hub] career honours read failed", error);
    return emptyHub();
  }
}

export function honoursMetricKey(value: string | null | undefined): SnookerHonoursMetricKey {
  return HONOURS_METRIC_KEYS.find((key) => key === value) ?? "ranking_titles";
}
