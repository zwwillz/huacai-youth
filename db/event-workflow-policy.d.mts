export const EVENT_LIFECYCLE: string[];
export const LIFECYCLE_LABELS: Record<string, string>;
export const LIFECYCLE_PROGRESS: Record<string, number>;
export function buildGroupWorkflow(fact: Record<string, any>): any;
export function chooseEventNextAction(summary: Record<string, any>, viewerRole: string): any;
export function workflowUrgencyScore(summary: Record<string, any>): number;
