import { getDb } from "./index";
import { eventDetails, eventPhases } from "./schema";

const DEFAULT_PHASES = [
  { code: "qualifier-one", phaseNumber: "01", title: "资格赛第一场", sortOrder: 1 },
  { code: "qualifier-two", phaseNumber: "02", title: "资格赛第二场", sortOrder: 2 },
  { code: "main-one", phaseNumber: "03", title: "正赛第一阶段", sortOrder: 3 },
  { code: "main-two", phaseNumber: "04", title: "正赛第二阶段", sortOrder: 4 },
] as const;

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

  await db.insert(eventPhases).values(DEFAULT_PHASES.map((phase) => ({
    id: `phase_${eventId}_${phase.code}`,
    eventId,
    code: phase.code,
    phaseNumber: phase.phaseNumber,
    title: phase.title,
    dateLabel: null,
    status: "pending",
    sortOrder: phase.sortOrder,
    createdAt: timestamp,
    updatedAt: timestamp,
  }))).onConflictDoNothing();
}
