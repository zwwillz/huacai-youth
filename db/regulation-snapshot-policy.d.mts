export type RegulationPrizeMap = Record<"少年组" | "青年组", string[][]>;
export type RegulationFeeMap = Record<"少年组" | "青年组", number | null>;

export type RegulationSnapshot = {
  version: 2;
  ruleStandard: string;
  competitionFormat: string[][];
  drawRules: string[];
  prizeNote: string;
  prizes: RegulationPrizeMap;
  signupNote: string;
  registrationFees: RegulationFeeMap;
};

export type RegulationSnapshotInput = Partial<{
  ruleStandard: unknown;
  rule_standard: unknown;
  competitionFormat: unknown;
  competition_format: unknown;
  drawRules: unknown;
  draw_rules: unknown;
  prizeNote: unknown;
  prize_note: unknown;
  prizes: unknown;
  signupNote: unknown;
  signup_note: unknown;
  registrationFees: unknown;
  registration_fees: unknown;
}>;

export const REGULATION_SNAPSHOT_VERSION: 2;
export function createRegulationSnapshot(details?: RegulationSnapshotInput): RegulationSnapshot;
export function parseRegulationSnapshot(value: unknown, published?: boolean): RegulationSnapshot | null;
