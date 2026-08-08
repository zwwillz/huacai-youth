import { getAdminViewer } from "@/app/admin/admin-viewer";
import { getFinalRankingWorkspaceDataFast } from "@/db/final-ranking-fast";
import { confirmFinalRankingFast, publishFinalRankingFast, saveFinalRankingManualOrderFast } from "@/db/final-ranking-write-fast";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const startedAt = performance.now();
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "请先登录后台。" }, { status: 401 });
  try {
    const url = new URL(request.url);
    const eventId = url.searchParams.get("eventId") || "";
    if (!eventId) throw new Error("缺少赛事ID。");
    const data = await getFinalRankingWorkspaceDataFast(viewer, eventId);
    return Response.json({ data }, { headers: { "Cache-Control": "private, no-store", "Server-Timing": `app;dur=${(performance.now() - startedAt).toFixed(1)}` } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "最终排名读取失败。" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const startedAt = performance.now();
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "请先登录后台。" }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action || "");
    const batchId = String(body.batchId || "");
    if (!batchId) throw new Error("缺少最终排名批次ID。");
    let data: unknown;
    if (action === "save-manual") {
      const orderedPlayerIds = Array.isArray(body.orderedPlayerIds) ? body.orderedPlayerIds.map(String) : [];
      data = await saveFinalRankingManualOrderFast(viewer, batchId, orderedPlayerIds, String(body.reason || ""));
    } else if (action === "confirm") {
      data = await confirmFinalRankingFast(viewer, batchId);
    } else if (action === "publish") {
      data = await publishFinalRankingFast(viewer, batchId);
    } else {
      throw new Error("不支持的最终排名操作。");
    }
    return Response.json({ data }, { headers: { "Cache-Control": "private, no-store", "Server-Timing": `app;dur=${(performance.now() - startedAt).toFixed(1)}` } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "最终排名操作失败。" }, { status: 400 });
  }
}
