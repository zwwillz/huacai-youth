import { NextResponse } from "next/server";
import { eventSummary, SNOOKER_BUILD_MARK, SNOOKER_FOUNDATION_VERSION } from "@/lib/snooker/foundation";
import { getDashboardWithLiveOverlay } from "@/lib/snooker/live-overlay";
import { getSnookerRepository } from "@/lib/snooker/repository";

export const revalidate = 20;

export async function GET() {
  const repository = getSnookerRepository();
  const { snapshot, sourceHealth } = await getDashboardWithLiveOverlay();
  return NextResponse.json({
    ok: true,
    product: "世界斯诺克数据中心",
    version: SNOOKER_FOUNDATION_VERSION,
    buildMark: SNOOKER_BUILD_MARK,
    repositoryMode: repository.mode,
    dataMode: sourceHealth.accepted ? "verified-snapshot + live-overlay" : "verified-snapshot",
    snapshot,
    summary: eventSummary(snapshot.event),
    sourceHealth,
  });
}
