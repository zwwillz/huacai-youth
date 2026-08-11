import { getAdminViewer } from "@/app/admin/admin-viewer";
import { getEventWorkflowSummaries, getEventWorkflowSummary } from "@/db/event-workflow";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const startedAt = performance.now();
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "登录状态已失效，请重新登录。" }, { status: 401 });
  try {
    const eventId = new URL(request.url).searchParams.get("event") || "";
    const data = eventId ? await getEventWorkflowSummary(viewer, eventId) : await getEventWorkflowSummaries(viewer);
    return Response.json({ data }, {
      headers: {
        "Cache-Control": "private, no-store",
        "Server-Timing": `app;dur=${(performance.now() - startedAt).toFixed(1)}`,
      },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "赛事流程状态读取失败。" }, { status: 400 });
  }
}
