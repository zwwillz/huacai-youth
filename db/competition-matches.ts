import { asc, eq, sql } from "drizzle-orm";
import { getDb } from "./index";
import { eventGroups, eventPhases, matches } from "./schema";
import type { Group, PhaseId } from "@/app/public-types";

const PHASE_CODES: PhaseId[] = ["qualifier-one", "qualifier-two", "main-one", "main-two"];

export type CompetitionMatch = {
  id: string;
  eventId: string;
  group: Group;
  phaseId: PhaseId | null;
  date: string;
  time: string;
  round: string;
  progress: string;
  race: string;
  order: number;
  playerAId: string | null;
  playerBId: string | null;
  playerA: string;
  playerB: string;
  matchCode: string;
  table: string;
  isTv: boolean;
  status: string;
  scoreA: string | null;
  scoreB: string | null;
  statsScoreA: number | null;
  statsScoreB: number | null;
  resultType: string | null;
};

/**
 * Convert the source score into a value usable by future win-rate/statistics code.
 * Official draw sheets may use X for a player who did not play / was directly
 * awarded a loss (and occasionally for a bye marker). It remains X for display,
 * but contributes 0 when a numeric score is required.
 */
export function scoreForStats(value: string | null): number | null {
  if (value == null || value === "") return null;
  if (value.trim().toUpperCase() === "X") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asPhaseId(value: string | null): PhaseId | null {
  return value && PHASE_CODES.includes(value as PhaseId) ? value as PhaseId : null;
}

export async function getCompetitionMatches(eventId: string): Promise<CompetitionMatch[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: matches.id,
      eventId: matches.eventId,
      groupName: eventGroups.name,
      phaseCode: eventPhases.code,
      date: matches.matchDate,
      time: matches.matchTime,
      round: matches.roundName,
      progress: matches.progress,
      race: matches.raceTo,
      order: matches.orderNo,
      playerAId: matches.playerAId,
      playerBId: matches.playerBId,
      playerA: matches.playerAName,
      playerB: matches.playerBName,
      table: matches.tableName,
      isTv: matches.isTv,
      status: matches.status,
      scoreA: sql<string | null>`"matches"."score_a"`,
      scoreB: sql<string | null>`"matches"."score_b"`,
      matchCode: sql<string | null>`"matches"."match_code"`,
      resultType: sql<string | null>`"matches"."result_type"`,
    })
    .from(matches)
    .innerJoin(eventGroups, eq(matches.groupId, eventGroups.id))
    .leftJoin(eventPhases, sql`"matches"."phase_id" = ${eventPhases.id}`)
    .where(eq(matches.eventId, eventId))
    .orderBy(asc(matches.matchDate), asc(matches.matchTime), asc(matches.orderNo), asc(matches.id));

  return rows.flatMap((row) => {
    if (row.groupName !== "少年组" && row.groupName !== "青年组") return [];
    const scoreA = row.scoreA ?? null;
    const scoreB = row.scoreB ?? null;
    return [{
      id: row.id,
      eventId: row.eventId,
      group: row.groupName as Group,
      phaseId: asPhaseId(row.phaseCode ?? null),
      date: row.date,
      time: row.time ?? "",
      round: row.round ?? "",
      progress: row.progress ?? "",
      race: row.race ?? "",
      order: row.order ?? 0,
      playerAId: row.playerAId ?? null,
      playerBId: row.playerBId ?? null,
      playerA: row.playerA,
      playerB: row.playerB,
      matchCode: row.matchCode ?? "",
      table: row.table ?? "",
      isTv: row.isTv,
      status: row.status,
      scoreA,
      scoreB,
      statsScoreA: scoreForStats(scoreA),
      statsScoreB: scoreForStats(scoreB),
      resultType: row.resultType ?? null,
    }];
  });
}
