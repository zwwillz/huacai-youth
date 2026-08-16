import { NextRequest, NextResponse } from "next/server";
import { loadSnookerDatabaseViewV2 } from "@/lib/snooker/database-public-v2";
import { eventSummary, SNOOKER_BUILD_MARK, SNOOKER_FOUNDATION_VERSION } from "@/lib/snooker/foundation";
import { getCachedDashboardWithLiveOverlay } from "@/lib/snooker/live-dashboard-cache";
import { getSnookerRepository } from "@/lib/snooker/repository";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const repository = getSnookerRepository();
  if (request.nextUrl.searchParams.has("monitor")) {
    const { snapshot, sourceHealth } = await getCachedDashboardWithLiveOverlay();
    return NextResponse.json({ ok: true, product: "世界斯诺克数据中心", version: SNOOKER_FOUNDATION_VERSION, buildMark: SNOOKER_BUILD_MARK, repositoryMode: repository.mode, dataMode: "upstream-monitor", snapshot, summary: eventSummary(snapshot.event), sourceHealth }, { headers: { "Cache-Control": "no-store" } });
  }

  const database = await loadSnookerDatabaseViewV2();
  const allMatches = database.eventDetails.flatMap((event) => event.rounds.flatMap((round) => round.matches));
  const liveMatches = allMatches.filter((match) => match.status === "live" || match.status === "session-break");
  const sourceHealth = {
    online: database.databaseOnline,
    accepted: database.databaseOnline,
    eventAccepted: database.databaseOnline,
    liveAccepted: liveMatches.length > 0,
    source: "Snooker DB",
    fetchedAt: database.loadedAt,
    latencyMs: 0,
    parsedRoundCount: database.snapshot.event.rounds.length,
    parsedMatchCount: allMatches.length,
    overlayCount: allMatches.length,
    changedCount: 0,
    pollingSeconds: liveMatches.length ? 30 : 0,
    liveScore: null,
    appliedFinalScore: "",
    matchId: liveMatches[0]?.id ?? null,
    message: database.databaseOnline ? "用户端从独立斯诺克数据库读取；官方数据源由中央任务统一同步。" : "独立数据库读取失败，已切回本地已验证快照。",
  };

  return NextResponse.json({
    ok: true,
    product: "世界斯诺克数据中心",
    version: "0.8.0-ui-performance",
    buildMark: `${SNOOKER_BUILD_MARK}-DB08`,
    repositoryMode: repository.mode,
    dataMode: database.databaseOnline ? "snooker-database" : "verified-snapshot-fallback",
    snapshot: database.snapshot,
    databaseEvents: database.eventDetails,
    summary: eventSummary(database.snapshot.event),
    sourceHealth,
  }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0", Pragma: "no-cache", Expires: "0" } });
}
