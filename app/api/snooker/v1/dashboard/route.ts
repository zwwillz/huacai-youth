import { NextRequest, NextResponse } from "next/server";
import { loadSnookerDatabaseView } from "@/lib/snooker/database-public";
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

  const database = await loadSnookerDatabaseView();
  const matchCount = database.snapshot.event.rounds.flatMap((round) => round.matches).length;
  const sourceHealth = {
    online: database.databaseOnline,
    accepted: database.databaseOnline,
    eventAccepted: database.databaseOnline,
    liveAccepted: database.snapshot.event.rounds.some((round) => round.matches.some((match) => match.status === "live" || match.status === "session-break")),
    source: "Snooker DB",
    fetchedAt: database.loadedAt,
    latencyMs: 0,
    parsedRoundCount: database.snapshot.event.rounds.length,
    parsedMatchCount: matchCount,
    overlayCount: matchCount,
    changedCount: 0,
    pollingSeconds: 30,
    liveScore: null,
    appliedFinalScore: "",
    matchId: null,
    message: database.databaseOnline ? "用户端从独立 snooker-data-center 数据库读取；WST 上游同步与用户访问解耦。" : "独立数据库读取失败，已切回本地已验证快照。",
  };

  return NextResponse.json({
    ok: true,
    product: "世界斯诺克数据中心",
    version: "0.6.0-database-calendar",
    buildMark: `${SNOOKER_BUILD_MARK}-DB`,
    repositoryMode: repository.mode,
    dataMode: database.databaseOnline ? "snooker-database" : "verified-snapshot-fallback",
    snapshot: database.snapshot,
    databaseEvents: database.eventDetails,
    summary: eventSummary(database.snapshot.event),
    sourceHealth,
  }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0", Pragma: "no-cache", Expires: "0" } });
}
