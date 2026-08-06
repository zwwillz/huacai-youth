import { getAdminViewer } from "@/app/admin/admin-viewer";
import {
  getContentManagementData,
  saveContentManagementData,
  setContentPublicationStatus,
  type ContentManagementInput,
} from "@/db/content-management";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "请先登录后台。" }, { status: 401 });
  const eventId = new URL(request.url).searchParams.get("eventId")?.trim();
  if (!eventId) return Response.json({ error: "缺少赛事ID。" }, { status: 400 });
  try {
    return Response.json({ data: await getContentManagementData(viewer.username, eventId) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "内容读取失败。" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "请先登录后台。" }, { status: 401 });
  try {
    const payload = await request.json() as
      | { action: "save"; data: ContentManagementInput }
      | { action: "publication"; eventId: string; publicationId: string; status: "draft" | "published" };

    if (payload.action === "publication") {
      return Response.json({ data: await setContentPublicationStatus(viewer.username, payload.eventId, payload.publicationId, payload.status) });
    }
    return Response.json({ data: await saveContentManagementData(viewer.username, payload.data) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "内容保存失败。" }, { status: 400 });
  }
}
