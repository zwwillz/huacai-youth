import { getPlayerDeleteEligibility } from "@/db/player-admin-delete";
import { getAdminViewer } from "@/app/admin/admin-viewer";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ playerId: string }> }) {
  const startedAt = performance.now();
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "登录状态已失效，请重新登录。" }, { status: 401 });
  if (viewer.role !== "system_admin") return Response.json({ error: "只有系统管理员可以检查删除条件。" }, { status: 403 });

  try {
    const { playerId } = await params;
    const data = await getPlayerDeleteEligibility(viewer.username, playerId);
    return Response.json({ data }, {
      headers: {
        "Cache-Control": "private, no-store",
        "Server-Timing": `app;dur=${(performance.now() - startedAt).toFixed(1)}`,
      },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "删除条件检查失败。" }, { status: 500 });
  }
}
