import { getAdminViewer } from "@/app/admin/admin-viewer";
import { confirmFinalRanking, getFinalRankingWorkspaceData, publishFinalRanking } from "@/db/final-ranking-engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "请先登录后台。" }, { status: 401 });
  try {
    const url = new URL(request.url);
    const eventId = url.searchParams.get("eventId") || "";
    if (!eventId) throw new Error("缺少赛事ID。");
    return Response.json({ data: await getFinalRankingWorkspaceData(viewer.username, eventId) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "最终排名读取失败。" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "请先登录后台。" }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action || "");
    const batchId = String(body.batchId || "");
    if (!batchId) throw new Error("缺少最终排名批次ID。");
    if (action === "confirm") return Response.json({ data: await confirmFinalRanking(viewer.username, batchId) });
    if (action === "publish") return Response.json({ data: await publishFinalRanking(viewer.username, batchId) });
    throw new Error("不支持的最终排名操作。");
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "最终排名操作失败。" }, { status: 400 });
  }
}
