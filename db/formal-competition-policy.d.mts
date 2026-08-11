export const FORMAL_COMPETITION_CONFIRMED_STATUS: "confirmed";
export function groupReadyToStartCompetition(fact: { rosterLocked?: boolean; confirmedDraw?: boolean; confirmedBracket?: boolean }): boolean;
export function groupHasFormalCompetitionData(fact: {
  confirmedDraw?: boolean;
  confirmedBracket?: boolean;
  confirmedSchedule?: boolean;
  confirmedMatchOrResult?: boolean;
  confirmedQualification?: boolean;
  lockedMainRoster?: boolean;
  confirmedAdvancement?: boolean;
  rankingData?: boolean;
}): boolean;
export function participantRosterLifecycleDecision(
  action: "confirm" | "lock",
  eventStatus: string,
  groupFormalStarted: boolean,
): { allowed: boolean; message: string };
