import { getAdminViewer } from "@/app/admin/admin-viewer";
import { saveContentManagementData, type ContentManagementInput } from "@/db/content-management";
import { getContentManagementDataFast } from "@/db/content-management-fast";
import { setContentPublicationStatusFast } from "@/db/content-publication-fast";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const startedAt = performance.now();
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "请先登录后台。" }, { status: 401 });
  const eventId = new URL(request.url).searchParams.get("eventId")?.trim();
  if (!eventId) return Response.json({ error: "缺少赛事ID。" }, { status: 400 });
  try {
    const data = await getContentManagementDataFast(viewer, eventId);
    return Response.json({ data }, { headers: { "Cache-Control": "private, no-store", "Server-Timing": `app;dur=${(performance.now() - startedAt).toFixed(1)}` } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "内容读取失败。" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const startedAt = performance.now();
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "请先登录后台。" }, { status: 401 });
  try {
    const payload = await request.json() as
      | { action: "save"; data: ContentManagementInput }
      | { action: "publication"; eventId: string; publicationId: string; status: "draft" | "published" };

    if (payload.action === "publication") {
      const data = await setContentPublicationStatusFast(viewer, payload.eventId, payload.publicationId, payload.status);
      return Response.json({ data }, { headers: { "Cache-Control": "private, no-store", "Server-Timing": `app;dur=${(performance.now() - startedAt).toFixed(1)}` } });
    }
    const data = await saveContentManagementData(viewer.username, payload.data);
    return Response.json({ data }, { headers: { "Cache-Control": "private, no-store", "Server-Timing": `app;dur=${(performance.now() - startedAt).toFixed(1)}` } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "内容保存失败。" }, { status: 400 });
  }
}
