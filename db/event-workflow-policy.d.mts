export const EVENT_LIFECYCLE: string[];
export const LIFECYCLE_LABELS: Record<string, string>;
export const LIFECYCLE_PROGRESS: Record<string, number>;
export function buildGroupWorkflow(fact: Record<string, unknown>): unknown;
export function chooseEventNextAction(summary: Record<string, unknown>, viewerRole: string): unknown;
export function workflowUrgencyScore(summary: Record<string, unknown>): number;
