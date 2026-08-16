import { NextResponse } from "next/server";
import {
  getSnookerVisitMonitorData,
  type SnookerVisitRange,
} from "@/db/snooker-visit-monitor";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ranges = new Set<SnookerVisitRange>(["today", "yesterday", "7d", "30d"]);

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requestedRange = url.searchParams.get("range") as SnookerVisitRange | null;
    const range = requestedRange && ranges.has(requestedRange) ? requestedRange : "today";
    const query = url.searchParams.get("q") || "";
    const pageValue = Number(url.searchParams.get("page") || "1");
    const data = await getSnookerVisitMonitorData({
      range,
      query,
      page: Number.isFinite(pageValue) ? pageValue : 1,
    });

    return NextResponse.json({ ok: true, ...data }, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("snooker visit monitor failed", error);
    return NextResponse.json({
      ok: false,
      message: "访问监测暂时读取失败",
    }, {
      status: 500,
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  }
}
