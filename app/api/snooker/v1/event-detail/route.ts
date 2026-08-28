import { NextRequest, NextResponse } from "next/server";
import { loadSnookerEventPublic } from "@/lib/snooker/event-public";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug")?.trim();
  if (!slug) return NextResponse.json({ ok: false, error: "EVENT_SLUG_REQUIRED" }, { status: 400 });

  try {
    const result = await loadSnookerEventPublic(slug);
    if (!result) return NextResponse.json({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });

    return NextResponse.json({
      ok: true,
      event: result.event,
      loadedAt: result.loadedAt,
      dataVersion: result.dataVersion,
      durationMs: result.durationMs,
      requestCount: result.requestCount,
    }, {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=120, stale-if-error=300",
      },
    });
  } catch (error) {
    console.error(`[snooker-event-detail] ${slug} read failed`, error);
    return NextResponse.json({
      ok: false,
      error: "EVENT_DETAIL_UNAVAILABLE",
      message: "赛事详情暂时无法刷新；请继续保留上一版成功数据。",
    }, {
      status: 503,
      headers: { "Cache-Control": "no-store", "Retry-After": "5" },
    });
  }
}
