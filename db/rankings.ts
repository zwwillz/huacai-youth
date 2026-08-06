import { and, asc, eq } from "drizzle-orm";
import { boolean, integer, pgTable, text } from "drizzle-orm/pg-core";
import type { Group } from "@/app/public-types";
import { getDb } from "./index";
import { eventGroups } from "./schema";

const eventRankings = pgTable("event_rankings", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull(),
  groupId: text("group_id").notNull(),
  playerId: text("player_id"),
  playerName: text("player_name").notNull(),
  displayOrder: integer("display_order").notNull(),
  placementLabel: text("placement_label").notNull(),
  prizeAmountCents: integer("prize_amount_cents").notNull(),
  prizeDisplay: text("prize_display").notNull(),
  isExactPlace: boolean("is_exact_place").notNull(),
  rankingBasis: text("ranking_basis").notNull(),
  source: text("source").notNull(),
  note: text("note"),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type PublicRanking = {
  id: string;
  eventId: string;
  group: Group;
  playerId: string | null;
  displayOrder: number;
  placementLabel: string;
  playerName: string;
  prizeDisplay: string;
  isExactPlace: boolean;
  rankingBasis: string;
  note: string | null;
};

export async function getPublicRankings(eventId: string): Promise<PublicRanking[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: eventRankings.id,
      eventId: eventRankings.eventId,
      group: eventGroups.name,
      playerId: eventRankings.playerId,
      displayOrder: eventRankings.displayOrder,
      placementLabel: eventRankings.placementLabel,
      playerName: eventRankings.playerName,
      prizeDisplay: eventRankings.prizeDisplay,
      isExactPlace: eventRankings.isExactPlace,
      rankingBasis: eventRankings.rankingBasis,
      note: eventRankings.note,
    })
    .from(eventRankings)
    .innerJoin(eventGroups, eq(eventRankings.groupId, eventGroups.id))
    .where(and(eq(eventRankings.eventId, eventId), eq(eventRankings.status, "published")))
    .orderBy(asc(eventRankings.displayOrder));

  return rows.flatMap((row) => {
    if (row.group !== "少年组" && row.group !== "青年组") return [];
    return [{ ...row, group: row.group as Group }];
  });
}
