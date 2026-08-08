import { getAdminViewer } from "@/app/admin/admin-viewer";
import { getCompetitionDashboardData } from "@/db/competition-dashboard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const startedAt = performance.now();
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "请先登录后台。" }, { status: 401 });
  try {
    const eventId = new URL(request.url).searchParams.get("eventId") || undefined;
    const data = await getCompetitionDashboardData(viewer.username, eventId);
    return Response.json({ data }, { headers: { "Cache-Control": "private, no-store", "Server-Timing": `app;dur=${(performance.now() - startedAt).toFixed(1)}` } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "竞赛总览读取失败。" }, { status: 400 });
  }
}
