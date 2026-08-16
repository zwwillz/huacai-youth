import SnookerDataCenter from "./snooker-data-center";
import { SNOOKER_BUILD_MARK } from "@/lib/snooker/foundation";
import { getDashboardWithLiveOverlay } from "@/lib/snooker/live-overlay";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SnookerPage() {
  const { snapshot, sourceHealth } = await getDashboardWithLiveOverlay();
  return (
    <SnookerDataCenter
      initialSnapshot={snapshot}
      initialSourceHealth={sourceHealth}
      buildMark={SNOOKER_BUILD_MARK}
    />
  );
}
