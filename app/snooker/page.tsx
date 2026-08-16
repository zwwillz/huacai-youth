import SnookerDataCenter from "./snooker-data-center";
import { SNOOKER_BUILD_MARK } from "@/lib/snooker/foundation";
import { getCachedDashboardWithLiveOverlay } from "@/lib/snooker/live-dashboard-cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SnookerPage() {
  const { snapshot, sourceHealth } = await getCachedDashboardWithLiveOverlay();
  return (
    <SnookerDataCenter
      initialSnapshot={snapshot}
      initialSourceHealth={sourceHealth}
      buildMark={SNOOKER_BUILD_MARK}
    />
  );
}
