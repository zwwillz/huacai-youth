import { getAdminViewer } from "@/app/admin/admin-viewer";
import { getCompetitionContextData } from "@/db/competition-context";
import { getCompetitionBracketIndex } from "@/db/competition-tool-index";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const startedAt = performance.now();
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "请先登录后台。" }, { status: 401 });
  const eventId = new URL(request.url).searchParams.get("eventId") || "";
  if (!eventId) return Response.json({ error: "缺少赛事ID。" }, { status: 400 });
  try {
    const [context, items] = await Promise.all([
      getCompetitionContextData(viewer, eventId),
      getCompetitionBracketIndex(viewer, eventId),
    ]);
    return Response.json({ data: { context, items } }, { headers: { "Cache-Control": "private, no-store", "Server-Timing": `app;dur=${(performance.now() - startedAt).toFixed(1)}` } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "赛程索引读取失败。" }, { status: 400 });
  }
}
