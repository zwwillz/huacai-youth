import { getAdminViewer } from "@/app/admin/admin-viewer";
import { setCompetitionPublicationStatus, type CompetitionPublicationModule } from "@/db/competition-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "请先登录后台。" }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const eventId = String(body.eventId || "");
    const moduleType = String(body.moduleType || "") as CompetitionPublicationModule;
    const status = String(body.status || "") as "draft" | "published";
    if (!eventId) throw new Error("缺少赛事ID。");
    if (!["schedule","matches","rankings"].includes(moduleType)) throw new Error("不支持的竞赛发布模块。");
    if (!["draft","published"].includes(status)) throw new Error("发布状态不正确。");
    return Response.json({ data: await setCompetitionPublicationStatus(viewer.username, eventId, moduleType, status) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "发布状态更新失败。" }, { status: 400 });
  }
}
