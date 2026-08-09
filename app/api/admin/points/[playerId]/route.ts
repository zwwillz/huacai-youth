import { getPlayerPointsDetailFast } from "@/db/player-points-fast";
import { getAdminViewer } from "@/app/admin/admin-viewer";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ playerId: string }> }) {
  const startedAt = performance.now();
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "登录状态已失效，请重新登录。" }, { status: 401 });
  if (viewer.role === "referee") return Response.json({ error: "当前账号没有积分排名查看权限。" }, { status: 403 });
  try {
    const { playerId } = await params;
    const url = new URL(request.url);
    const data = await getPlayerPointsDetailFast(viewer, playerId, {
      eventId: url.searchParams.get("event"),
      scope: url.searchParams.get("scope") || undefined,
    });
    if (!data) return Response.json({ error: "没有找到积分详情，或当前账号没有查看权限。" }, { status: 404 });
    return Response.json({ data }, { headers: { "Cache-Control": "private, no-store", "Server-Timing": `app;dur=${(performance.now() - startedAt).toFixed(1)}` } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "积分详情读取失败。" }, { status: 500 });
  }
}
