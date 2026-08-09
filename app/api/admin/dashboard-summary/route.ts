import { getAdminViewer } from "@/app/admin/admin-viewer";
import { getAdminDashboardSummaryFast } from "@/db/admin-structure-first";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = performance.now();
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "登录状态已失效，请重新登录。" }, { status: 401 });

  try {
    const data = await getAdminDashboardSummaryFast(viewer);
    return Response.json({ data }, {
      headers: {
        "Cache-Control": "private, no-store",
        "Server-Timing": `app;dur=${(performance.now() - startedAt).toFixed(1)}`,
      },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "工作台数据读取失败。" }, { status: 500 });
  }
}
