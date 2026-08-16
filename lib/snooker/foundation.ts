import type { PlayerEventStats, SnookerDashboardSnapshot, SnookerEvent, SnookerMatch, SnookerPlayer } from "./domain";
import { snookerCalendar2026 } from "./data/calendar";
import { chinaOpen2026 } from "./data/china-open-2026";
import { playerById, snookerPlayers, top16Rankings } from "./data/players";

export const SNOOKER_FOUNDATION_VERSION = "0.5.0-db-foundation";
export const SNOOKER_BUILD_MARK = "2026-08-16-DB-01";

// POC currently uses lightweight letter avatars. Keep the curated image metadata
// in the player master data so a faster/stable image delivery strategy can be
// restored later without re-entering player assets.
const publicSnookerPlayers = snookerPlayers.map((player) => ({ ...player, avatar: undefined }));

// The China Open has finished. Keep a verified terminal snapshot in code so a
// completed event never falls back to the old 4-4 interval score if WST is slow
// or temporarily unavailable. The same final data is now persisted in the
// dedicated snooker-data-center Supabase database.
const completedChinaOpen2026: SnookerEvent = structuredClone(chinaOpen2026);
completedChinaOpen2026.status = "completed";
completedChinaOpen2026.statusLabelZh = "已结束";
completedChinaOpen2026.snapshotAt = "2026-08-16T23:55:00+08:00";
const chinaOpenFinal = completedChinaOpen2026.rounds.find((round) => round.key === "final")?.matches[0];
if (chinaOpenFinal) {
  chinaOpenFinal.score1 = 10;
  chinaOpenFinal.score2 = 6;
  chinaOpenFinal.status = "completed";
  chinaOpenFinal.statusLabelZh = "已结束";
  chinaOpenFinal.winnerId = "p-mark-selby";
  chinaOpenFinal.sessionLabelZh = "全场结束 · 10-6";
  chinaOpenFinal.frames = [
    { frameNo: 1, score1: 8, score2: 67 },
    { frameNo: 2, score1: 89, score2: 38 },
    { frameNo: 3, score1: 138, score2: 0, break1: 138 },
    { frameNo: 4, score1: 0, score2: 73 },
    { frameNo: 5, score1: 0, score2: 80, break2: 80 },
    { frameNo: 6, score1: 5, score2: 75, break2: 51 },
    { frameNo: 7, score1: 70, score2: 68, break1: 53, break2: 57 },
    { frameNo: 8, score1: 73, score2: 32 },
    { frameNo: 9, score1: 74, score2: 0, break1: 58 },
    { frameNo: 10, score1: 91, score2: 37, break1: 90 },
    { frameNo: 11, score1: 103, score2: 27, break1: 69 },
    { frameNo: 12, score1: 62, score2: 29, break1: 52 },
    { frameNo: 13, score1: 25, score2: 82, break2: 71 },
    { frameNo: 14, score1: 77, score2: 68, break2: 68 },
    { frameNo: 15, score1: 1, score2: 61, break2: 61 },
    { frameNo: 16, score1: 79, score2: 27, break1: 57 },
  ];
  chinaOpenFinal.note = "19局10胜；马克·塞尔比10-6夺冠。比赛已结束，最终数据冻结保存。";
}

const finalizedCalendar = snookerCalendar2026.map((item) => item.slug === "china-open-2026"
  ? { ...item, status: "completed" as const, statusLabelZh: "已结束", winnerZh: "马克·塞尔比" }
  : item);

export const dashboardSnapshot: SnookerDashboardSnapshot = {
  version: SNOOKER_FOUNDATION_VERSION,
  builtAt: "2026-08-16T23:55:00+08:00",
  event: completedChinaOpen2026,
  calendar: finalizedCalendar,
  players: publicSnookerPlayers,
  rankings: top16Rankings,
};

export function getPlayer(playerId: string): SnookerPlayer {
  return playerById.get(playerId) ?? {
    id: playerId,
    slug: playerId.replace(/^p-/, ""),
    nameEn: playerId,
    nameZh: playerId,
    shortNameZh: playerId,
    nationalityZh: "未知",
    countryCode: "",
    currentRank: null,
    rankingPoints: null,
  };
}

export function allEventMatches(event: SnookerEvent = completedChinaOpen2026): SnookerMatch[] {
  return event.rounds.flatMap((round) => round.matches);
}

export function eventPlayerIds(event: SnookerEvent = completedChinaOpen2026): string[] {
  return Array.from(new Set(allEventMatches(event).flatMap((match) => [match.player1Id, match.player2Id])));
}

export function eventPlayers(event: SnookerEvent = completedChinaOpen2026): SnookerPlayer[] {
  return eventPlayerIds(event).map(getPlayer).sort((a, b) => {
    const rankA = a.currentRank ?? 999;
    const rankB = b.currentRank ?? 999;
    return rankA - rankB || a.nameEn.localeCompare(b.nameEn);
  });
}

export function getPlayerEventStats(playerId: string, event: SnookerEvent = completedChinaOpen2026): PlayerEventStats | null {
  const matches = allEventMatches(event).filter((match) => match.player1Id === playerId || match.player2Id === playerId);
  if (!matches.length) return null;

  let wins = 0;
  let losses = 0;
  let frameWins = 0;
  let frameLosses = 0;
  for (const match of matches) {
    const isP1 = match.player1Id === playerId;
    const selfScore = isP1 ? match.score1 : match.score2;
    const opponentScore = isP1 ? match.score2 : match.score1;
    if (selfScore !== null) frameWins += selfScore;
    if (opponentScore !== null) frameLosses += opponentScore;
    if (match.winnerId === playerId) wins += 1;
    else if (match.status === "completed" || match.status === "walkover") losses += 1;
  }

  const roundOrder = event.rounds.map((round) => round.key);
  const bestMatch = [...matches].sort((a, b) => roundOrder.indexOf(a.roundKey) - roundOrder.indexOf(b.roundKey))[0];
  const isActive = matches.some((match) => match.status === "live" || match.status === "session-break" || match.status === "upcoming");

  return {
    playerId,
    eventId: event.id,
    played: wins + losses,
    wins,
    losses,
    frameWins,
    frameLosses,
    bestRoundKey: bestMatch.roundKey,
    bestRoundLabelZh: bestMatch.roundLabelZh,
    isActive,
    matches,
  };
}

export function playerEventStats(event: SnookerEvent = completedChinaOpen2026): PlayerEventStats[] {
  return eventPlayerIds(event)
    .map((id) => getPlayerEventStats(id, event))
    .filter((item): item is PlayerEventStats => Boolean(item));
}

export function eventSummary(event: SnookerEvent = completedChinaOpen2026) {
  const matches = allEventMatches(event);
  const players = eventPlayers(event);
  const chinaPlayers = players.filter((player) => player.countryCode === "CHN");
  return {
    matchCount: matches.length,
    completedCount: matches.filter((match) => match.status === "completed" || match.status === "walkover").length,
    activeCount: matches.filter((match) => match.status === "live" || match.status === "session-break").length,
    playerCount: players.length,
    chinaPlayerCount: chinaPlayers.length,
    chinaBest: getPlayerEventStats("p-zhou-yuelong", event),
  };
}

export function moneyGBP(value: number) {
  return `£${value.toLocaleString("en-GB")}`;
}
