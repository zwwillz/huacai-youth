import { getDb } from "./index";
import { eventDetails } from "./schema";

export async function ensureNewEventDefaults(eventId: string) {
  const db = getDb();
  const timestamp = new Date().toISOString();
  await db.insert(eventDetails).values({
    eventId,
    sponsorLabel: null,
    durationLabel: null,
    qualifierDateLabel: null,
    mainDateLabel: null,
    totalPrizeLabel: null,
    mainSizeLabel: null,
    minimumAgeNote: null,
    signupNote: null,
    ageRules: {},
    competitionFormat: [],
    drawRules: [],
    prizes: {},
    createdAt: timestamp,
    updatedAt: timestamp,
  }).onConflictDoNothing();
}
