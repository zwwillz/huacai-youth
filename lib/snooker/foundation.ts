import type { PlayerEventStats, SnookerDashboardSnapshot, SnookerEvent, SnookerMatch, SnookerPlayer } from "./domain";
import { chinaOpen2026 } from "./data/china-open-2026";
import { playerById, snookerPlayers, top16Rankings } from "./data/players";

export const SNOOKER_FOUNDATION_VERSION = "0.3.0-data-foundation";
export const SNOOKER_BUILD_MARK = "2026-08-16-BIG-02";

export const dashboardSnapshot: SnookerDashboardSnapshot = {
  version: SNOOKER_FOUNDATION_VERSION,
  builtAt: "2026-08-16T19:05:00+08:00",
  event: chinaOpen2026,
  players: snookerPlayers,
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

export function allEventMatches(event: SnookerEvent = chinaOpen2026): SnookerMatch[] {
  return event.rounds.flatMap((round) => round.matches);
}

export function eventPlayerIds(event: SnookerEvent = chinaOpen2026): string[] {
  return Array.from(new Set(allEventMatches(event).flatMap((match) => [match.player1Id, match.player2Id])));
}

export function eventPlayers(event: SnookerEvent = chinaOpen2026): SnookerPlayer[] {
  return eventPlayerIds(event).map(getPlayer).sort((a, b) => {
    const rankA = a.currentRank ?? 999;
    const rankB = b.currentRank ?? 999;
    return rankA - rankB || a.nameEn.localeCompare(b.nameEn);
  });
}

export function getPlayerEventStats(playerId: string, event: SnookerEvent = chinaOpen2026): PlayerEventStats | null {
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

export function playerEventStats(event: SnookerEvent = chinaOpen2026): PlayerEventStats[] {
  return eventPlayerIds(event)
    .map((id) => getPlayerEventStats(id, event))
    .filter((item): item is PlayerEventStats => Boolean(item));
}

export function eventSummary(event: SnookerEvent = chinaOpen2026) {
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
