import { getPlayerAdminDetail } from "@/db/player-admin-v2";
import { getAdminViewer } from "@/app/admin/admin-viewer";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ playerId: string }> }) {
  const startedAt = performance.now();
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "登录状态已失效，请重新登录。" }, { status: 401 });
  if (viewer.role === "referee") return Response.json({ error: "当前账号没有球员管理权限。" }, { status: 403 });

  try {
    const { playerId } = await params;
    const url = new URL(request.url);
    const data = await getPlayerAdminDetail(viewer.username, playerId, url.searchParams.get("event"));
    if (!data) return Response.json({ error: "没有找到球员档案，或当前账号没有查看权限。" }, { status: 404 });
    return Response.json({ data }, {
      headers: {
        "Cache-Control": "private, no-store",
        "Server-Timing": `app;dur=${(performance.now() - startedAt).toFixed(1)}`,
      },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "球员详情读取失败。" }, { status: 500 });
  }
}
