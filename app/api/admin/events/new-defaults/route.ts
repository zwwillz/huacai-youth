import { getAdminViewer } from "@/app/admin/admin-viewer";
import { getNewEventSuggestionFast } from "@/db/admin-structure-first";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = performance.now();
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "登录状态已失效，请重新登录。" }, { status: 401 });
  if (!["system_admin", "committee"].includes(viewer.role)) return Response.json({ error: "当前账号没有创建赛事的权限。" }, { status: 403 });

  try {
    const data = await getNewEventSuggestionFast(viewer);
    return Response.json({ data }, {
      headers: {
        "Cache-Control": "private, no-store",
        "Server-Timing": `app;dur=${(performance.now() - startedAt).toFixed(1)}`,
      },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "默认赛事信息读取失败。" }, { status: 500 });
  }
}
