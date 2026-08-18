import type { SnookerPlayer, SnookerSeasonStatistics } from "./domain";

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
  lists: SnookerTechnicalList[];
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

function isCurrentTourPlayer(player: SnookerPlayer) {
  if (typeof player.isCurrentTour === "boolean") return player.isCurrentTour;
  if (player.playerStatus) return player.playerStatus === "tour";
  return player.currentRank !== null;
}

function metricValue(stat: SnookerSeasonStatistics, key: SnookerTechnicalMetricKey) {
  switch (key) {
    case "centuries": return stat.breaks100Plus;
    case "fifties": return stat.breaks50Plus;
    case "win_rate": return stat.matchWinRate;
    case "shot_time": return stat.averageShotTimeSeconds;
    case "highest_break": return stat.highestBreak;
    case "maximums": return stat.season147s;
    case "average_break": return stat.averageBreak;
    case "matches_won": return stat.matchesWon;
    case "points_scored": return stat.pointsScored;
  }
}

function finite(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function buildSnookerTechnicalHub(players: SnookerPlayer[]): SnookerTechnicalHub {
  const seasonStartYear = players.reduce((latest, player) => {
    const season = player.seasonStatistics?.seasonStartYear;
    return isCurrentTourPlayer(player) && typeof season === "number" ? Math.max(latest, season) : latest;
  }, 0) || 2026;
  const seasonLabel = players.find((player) => player.seasonStatistics?.seasonStartYear === seasonStartYear)?.seasonStatistics?.seasonLabel ?? `${seasonStartYear}/${String(seasonStartYear + 1).slice(-2)}`;
  const eligible = players.filter((player) => isCurrentTourPlayer(player) && player.seasonStatistics?.seasonStartYear === seasonStartYear);

  const lists = metricDefinitions.map((definition) => {
    const sorted = eligible
      .map((player) => {
        const stat = player.seasonStatistics!;
        const value = finite(metricValue(stat, definition.key));
        const matchesPlayed = stat.matchesPlayed ?? 0;
        if (value === null || matchesPlayed < definition.minMatches || (definition.positiveOnly && value <= 0)) return null;
        return { player, value, matchesPlayed };
      })
      .filter((item): item is { player: SnookerPlayer; value: number; matchesPlayed: number } => Boolean(item))
      .sort((a, b) => {
        const primary = definition.direction === "asc" ? a.value - b.value : b.value - a.value;
        if (primary !== 0) return primary;
        if (b.matchesPlayed !== a.matchesPlayed) return b.matchesPlayed - a.matchesPlayed;
        const ar = a.player.currentRank ?? 9999;
        const br = b.player.currentRank ?? 9999;
        return ar - br || a.player.nameEn.localeCompare(b.player.nameEn);
      });

    let previousValue: number | null = null;
    let previousRank = 0;
    const rows = sorted.map((item, index) => {
      const rank = previousValue !== null && item.value === previousValue ? previousRank : index + 1;
      previousValue = item.value;
      previousRank = rank;
      return {
        rank,
        playerId: item.player.id,
        playerSlug: item.player.slug,
        value: item.value,
        matchesPlayed: item.matchesPlayed,
      } satisfies SnookerTechnicalRow;
    });

    return { ...definition, rows } satisfies SnookerTechnicalList;
  });

  return { seasonStartYear, seasonLabel, sourceName: "WST 官方赛季统计", lists };
}

export function technicalMetricKey(value: string | null | undefined): SnookerTechnicalMetricKey {
  return TECHNICAL_METRIC_KEYS.find((key) => key === value) ?? "centuries";
}
