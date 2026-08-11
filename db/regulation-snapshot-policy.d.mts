export type RegulationPrizeMap = Record<"少年组" | "青年组", string[][]>;

export type RegulationSnapshot = {
  version: 1;
  ruleStandard: string;
  competitionFormat: string[][];
  drawRules: string[];
  prizeNote: string;
  prizes: RegulationPrizeMap;
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
}>;

export const REGULATION_SNAPSHOT_VERSION: 1;
export function createRegulationSnapshot(details?: RegulationSnapshotInput): RegulationSnapshot;
export function parseRegulationSnapshot(value: unknown, published?: boolean): RegulationSnapshot | null;
