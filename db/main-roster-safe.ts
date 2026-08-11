import type { AdminPrincipalInput } from "./permissions";
import type { MainRosterControlData } from "./main-competition-flow";
import { getMainRosterControlDataFast } from "./main-roster-fast";
import { findEligiblePreviousSeedEvent } from "./seed-initialization";

/**
 * Keeps the existing optimized roster query intact while correcting the displayed
 * previous-station seed source to the same rules used by the write operation.
 * Seed availability is evaluated per group so an incomplete ranking in one group
 * never prevents the other group from using its own valid previous-station top 16.
 */
export async function getMainRosterControlDataSafe(input: AdminPrincipalInput, eventId: string): Promise<MainRosterControlData> {
  const data = await getMainRosterControlDataFast(input, eventId);
  const previousEvents = await Promise.all(
    data.groups.map((group) => findEligiblePreviousSeedEvent(eventId, group.groupName)),
  );
  const previousEvent = previousEvents.find((event) => Boolean(event)) ?? null;

  return {
    ...data,
    previousEvent,
    groups: data.groups.map((group, index) => ({
      ...group,
      canInitializeSeeds: Boolean(previousEvents[index]) && group.seedSeats.length === 0 && !group.activeMainOneDraw,
    })),
  };
}
