import type { AdminPrincipalInput } from "./permissions";
import type { MainRosterControlData } from "./main-competition-flow";
import { getMainRosterControlDataFast } from "./main-roster-fast";
import { findEligiblePreviousSeedEvent } from "./seed-initialization";

/**
 * Keeps the existing optimized roster query intact while correcting the displayed
 * previous-station seed source to the same rules used by the write operation.
 */
export async function getMainRosterControlDataSafe(input: AdminPrincipalInput, eventId: string): Promise<MainRosterControlData> {
  const [data, previousEvent] = await Promise.all([
    getMainRosterControlDataFast(input, eventId),
    findEligiblePreviousSeedEvent(eventId),
  ]);
  return {
    ...data,
    previousEvent,
    groups: data.groups.map((group) => ({
      ...group,
      canInitializeSeeds: Boolean(previousEvent) && group.seedSeats.length === 0 && !group.activeMainOneDraw,
    })),
  };
}
