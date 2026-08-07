import { getAdminViewer } from "@/app/admin/admin-viewer";
import { getGuideManagementData, saveGuideManagementData, type GuideEditorItem } from "@/db/guides";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "请先登录后台。" }, { status: 401 });
  try {
    const eventId = new URL(request.url).searchParams.get("eventId") || "";
    return Response.json({ data: await getGuideManagementData(viewer.username, eventId) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "参赛提示读取失败。" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "请先登录后台。" }, { status: 401 });
  try {
    const body = await request.json() as { eventId?: string; guides?: GuideEditorItem[] };
    if (!body.eventId) throw new Error("缺少赛事ID。");
    return Response.json({ data: await saveGuideManagementData(viewer.username, body.eventId, body.guides ?? []) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "参赛提示保存失败。" }, { status: 400 });
  }
}
