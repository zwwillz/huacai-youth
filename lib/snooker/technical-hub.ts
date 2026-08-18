const DEFAULT_SUPABASE_URL = "https://rtlvncsmbueatdzqvhbn.supabase.co";
const DEFAULT_PUBLISHABLE_KEY = "sb_publishable_SR0NVsqpSBGBMP3xg9utvQ_jywPEUNP";

const SUPABASE_URL = process.env.SNOOKER_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const SUPABASE_KEY = process.env.SNOOKER_SUPABASE_PUBLISHABLE_KEY || DEFAULT_PUBLISHABLE_KEY;
const REST_URL = `${SUPABASE_URL}/rest/v1`;

export const TECHNICAL_METRIC_KEYS = [
  "centuries",
  "fifties",
  "win_rate",
  "shot_time",
  "highest_break",
  "maximums",
  "average_break",
  "matches_won",
  "points_scored",
] as const;

export type SnookerTechnicalMetricKey = (typeof TECHNICAL_METRIC_KEYS)[number];

export type SnookerTechnicalMetric = {
  key: SnookerTechnicalMetricKey;
  labelZh: string;
  labelEn: string;
  shortLabelZh: string;
  direction: "asc" | "desc";
  unit: "count" | "percent" | "seconds" | "points";
  minMatches: number;
  positiveOnly: boolean;
};

export type SnookerTechnicalRow = {
  rank: number;
  playerId: string;
  playerSlug: string;
  value: number;
  matchesPlayed: number;
};

export type SnookerTechnicalList = SnookerTechnicalMetric & {
  rows: SnookerTechnicalRow[];
};

export type SnookerTechnicalHub = {
  seasonStartYear: number;
  seasonLabel: string;
  sourceName: string;
  capturedAt: string | null;
  online: boolean;
  lists: SnookerTechnicalList[];
};

type SeasonHeadRow = {
  season_start_year: number;
  season_label: string;
};

type SeasonRow = {
  player_id: string;
  season_start_year: number;
  season_label: string;
  matches_played: number | null;
  matches_won: number | null;
  match_win_rate: number | string | null;
  average_shot_time: number | string | null;
  breaks_50_plus: number | null;
  breaks_100_plus: number | null;
  highest_break: number | null;
  season_147s: number | null;
  average_break: number | string | null;
  points_scored: number | null;
  source_updated_at: string | null;
};

type PlayerRow = {
  id: string;
  slug: string;
  current_rank: number | null;
};

const metricDefinitions: SnookerTechnicalMetric[] = [
  { key: "centuries", labelZh: "破百杆数", labelEn: "100+ BREAKS", shortLabelZh: "破百", direction: "desc", unit: "count", minMatches: 0, positiveOnly: false },
  { key: "fifties", labelZh: "50+杆数", labelEn: "50+ BREAKS", shortLabelZh: "50+", direction: "desc", unit: "count", minMatches: 0, positiveOnly: false },
  { key: "win_rate", labelZh: "比赛胜率", labelEn: "MATCH WIN RATE", shortLabelZh: "胜率", direction: "desc", unit: "percent", minMatches: 5, positiveOnly: false },
  { key: "shot_time", labelZh: "平均出杆时间", labelEn: "AVERAGE SHOT TIME", shortLabelZh: "出杆", direction: "asc", unit: "seconds", minMatches: 5, positiveOnly: true },
  { key: "highest_break", labelZh: "最高单杆", labelEn: "HIGHEST BREAK", shortLabelZh: "最高杆", direction: "desc", unit: "count", minMatches: 0, positiveOnly: true },
  { key: "maximums", labelZh: "147杆数", labelEn: "147 BREAKS", shortLabelZh: "147", direction: "desc", unit: "count", minMatches: 0, positiveOnly: true },
  { key: "average_break", labelZh: "平均单杆", labelEn: "AVERAGE BREAK", shortLabelZh: "平均杆", direction: "desc", unit: "count", minMatches: 5, positiveOnly: true },
  { key: "matches_won", labelZh: "获胜场次", labelEn: "MATCHES WON", shortLabelZh: "胜场", direction: "desc", unit: "count", minMatches: 0, positiveOnly: false },
  { key: "points_scored", labelZh: "总得分", labelEn: "POINTS SCORED", shortLabelZh: "总得分", direction: "desc", unit: "points", minMatches: 0, positiveOnly: false },
];

async function rest<T>(resource: string, params: URLSearchParams, revalidate = 300): Promise<T> {
  const response = await fetch(`${REST_URL}/${resource}?${params.toString()}`, {
    headers: { apikey: SUPABASE_KEY, Accept: "application/json" },
    next: { revalidate },
  });
  if (!response.ok) throw new Error(`SNOOKER_TECHNICAL_HUB_HTTP_${response.status}`);
  return response.json() as Promise<T>;
}

function finite(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function metricValue(row: SeasonRow, key: SnookerTechnicalMetricKey) {
  switch (key) {
    case "centuries": return finite(row.breaks_100_plus);
    case "fifties": return finite(row.breaks_50_plus);
    case "win_rate": return finite(row.match_win_rate);
    case "shot_time": return finite(row.average_shot_time);
    case "highest_break": return finite(row.highest_break);
    case "maximums": return finite(row.season_147s);
    case "average_break": return finite(row.average_break);
    case "matches_won": return finite(row.matches_won);
    case "points_scored": return finite(row.points_scored);
  }
}

function emptyHub(): SnookerTechnicalHub {
  return {
    seasonStartYear: 2026,
    seasonLabel: "2026/27",
    sourceName: "WST 官方赛季统计",
    capturedAt: null,
    online: false,
    lists: metricDefinitions.map((definition) => ({ ...definition, rows: [] })),
  };
}

export async function loadSnookerTechnicalHub(): Promise<SnookerTechnicalHub> {
  try {
    const [latest] = await rest<SeasonHeadRow[]>("snooker_player_season_stats", new URLSearchParams({
      select: "season_start_year,season_label",
      order: "season_start_year.desc",
      limit: "1",
    }), 300);
    if (!latest) return emptyHub();

    const [seasonRows, playerRows] = await Promise.all([
      rest<SeasonRow[]>("snooker_player_season_stats", new URLSearchParams({
        select: "player_id,season_start_year,season_label,matches_played,matches_won,match_win_rate,average_shot_time,breaks_50_plus,breaks_100_plus,highest_break,season_147s,average_break,points_scored,source_updated_at",
        season_start_year: `eq.${latest.season_start_year}`,
      }), 300),
      rest<PlayerRow[]>("snooker_players", new URLSearchParams({
        select: "id,slug,current_rank",
        is_current_tour: "eq.true",
      }), 1800),
    ]);

    const playerById = new Map(playerRows.map((player) => [player.id, player]));
    const eligible = seasonRows.filter((row) => playerById.has(row.player_id));
    const capturedAt = eligible.reduce<string | null>((latestValue, row) => {
      if (!row.source_updated_at) return latestValue;
      return !latestValue || row.source_updated_at > latestValue ? row.source_updated_at : latestValue;
    }, null);

    const lists = metricDefinitions.map((definition) => {
      const sorted = eligible
        .map((row) => {
          const player = playerById.get(row.player_id)!;
          const value = metricValue(row, definition.key);
          const matchesPlayed = row.matches_played ?? 0;
          if (value === null || matchesPlayed < definition.minMatches || (definition.positiveOnly && value <= 0)) return null;
          return { row, player, value, matchesPlayed };
        })
        .filter((item): item is { row: SeasonRow; player: PlayerRow; value: number; matchesPlayed: number } => Boolean(item))
        .sort((a, b) => {
          const primary = definition.direction === "asc" ? a.value - b.value : b.value - a.value;
          if (primary !== 0) return primary;
          if (b.matchesPlayed !== a.matchesPlayed) return b.matchesPlayed - a.matchesPlayed;
          return (a.player.current_rank ?? 9999) - (b.player.current_rank ?? 9999) || a.player.slug.localeCompare(b.player.slug);
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
          matchesPlayed: item.matchesPlayed,
        } satisfies SnookerTechnicalRow;
      });
      return { ...definition, rows } satisfies SnookerTechnicalList;
    });

    return {
      seasonStartYear: latest.season_start_year,
      seasonLabel: latest.season_label,
      sourceName: "WST 官方赛季统计",
      capturedAt,
      online: lists.some((list) => list.rows.length > 0),
      lists,
    };
  } catch (error) {
    console.error("[snooker-technical-hub] season technical read failed", error);
    return emptyHub();
  }
}

export function technicalMetricKey(value: string | null | undefined): SnookerTechnicalMetricKey {
  return TECHNICAL_METRIC_KEYS.find((key) => key === value) ?? "centuries";
}
