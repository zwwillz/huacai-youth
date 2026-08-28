import { NextRequest, NextResponse } from "next/server";
import {
  dashboardErrorStage,
  dashboardSourceHealth,
  loadSnookerDashboardCore,
  loadSnookerDashboardWorkspace,
  type SnookerDashboardPublicView,
} from "@/lib/snooker/dashboard-public";
import { eventSummary, SNOOKER_BUILD_MARK, SNOOKER_FOUNDATION_VERSION } from "@/lib/snooker/foundation";
import { getCachedDashboardWithLiveOverlay } from "@/lib/snooker/live-dashboard-cache";
import { getSnookerRepository } from "@/lib/snooker/repository";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function databaseSummary(database: SnookerDashboardPublicView) {
  const allMatches = database.eventDetails.flatMap((event) => event.rounds.flatMap((round) => round.matches));
  const liveMatches = allMatches.filter((match) => match.status === "live" || match.status === "session-break");
  return {
    matchCount: allMatches.length,
    completedCount: allMatches.filter((match) => match.status === "completed" || match.status === "walkover").length,
    activeCount: liveMatches.length,
    playerCount: database.snapshot.players.length,
  };
}

export async function GET(request: NextRequest) {
  const repository = getSnookerRepository();
  if (request.nextUrl.searchParams.has("monitor")) {
    const { snapshot, sourceHealth } = await getCachedDashboardWithLiveOverlay();
    return NextResponse.json({ ok: true, product: "世界斯诺克数据中心", version: SNOOKER_FOUNDATION_VERSION, buildMark: SNOOKER_BUILD_MARK, repositoryMode: repository.mode, dataMode: "upstream-monitor", snapshot, summary: eventSummary(snapshot.event), sourceHealth }, { headers: { "Cache-Control": "no-store" } });
  }

  const scope = request.nextUrl.searchParams.get("scope") === "full" ? "full" as const : "core" as const;
  try {
    const database = scope === "full"
      ? await loadSnookerDashboardWorkspace()
      : await loadSnookerDashboardCore({ allowStale: false });
    const allMatches = database.eventDetails.flatMap((event) => event.rounds.flatMap((round) => round.matches));
    const liveMatches = allMatches.filter((match) => match.status === "live" || match.status === "session-break");
    const sourceHealth = {
      ...dashboardSourceHealth(database),
      eventAccepted: true,
      liveAccepted: liveMatches.length > 0,
      source: "Snooker DB",
      latencyMs: database.durationMs,
      parsedRoundCount: database.snapshot.event.rounds.length,
      parsedMatchCount: allMatches.length,
      overlayCount: allMatches.length,
      changedCount: 0,
      pollingSeconds: liveMatches.length ? 30 : 0,
      liveScore: null,
      appliedFinalScore: "",
      matchId: liveMatches[0]?.id ?? null,
    };

    return NextResponse.json({
      ok: true,
      product: "世界斯诺克数据中心",
      version: "1.0.0-dashboard-resilience",
      buildMark: `${SNOOKER_BUILD_MARK}-DB11`,
      repositoryMode: "supabase",
      dataMode: scope === "full" ? "snooker-database-workspace" : "snooker-database-core",
      dataState: database.dataState,
      dataVersion: database.dataVersion,
      lastSuccessfulAt: database.lastSuccessfulAt,
      scope: database.scope,
      snapshot: database.snapshot,
      databaseEvents: database.eventDetails,
      summary: databaseSummary(database),
      sourceHealth,
    }, {
      headers: scope === "full"
        ? { "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300, stale-if-error=600" }
        : { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0", Pragma: "no-cache", Expires: "0" },
    });
  } catch (error) {
    const attemptedAt = new Date().toISOString();
    const failedStage = dashboardErrorStage(error);
    console.error(`[snooker-dashboard] ${scope} read failed at ${failedStage}`, error);
    return NextResponse.json({
      ok: false,
      product: "世界斯诺克数据中心",
      version: "1.0.0-dashboard-resilience",
      buildMark: `${SNOOKER_BUILD_MARK}-DB11`,
      dataMode: "database-unavailable",
      dataState: "unavailable",
      scope,
      sourceHealth: {
        online: false,
        accepted: false,
        fetchedAt: attemptedAt,
        lastSuccessfulAt: null,
        dataState: "unavailable",
        failedStage,
        message: "数据库本次读取失败；当前页面应保留上一版成功数据，不使用静态赛事快照覆盖。",
      },
    }, {
      status: 503,
      headers: { "Cache-Control": "no-store", "Retry-After": "5" },
    });
  }
}
