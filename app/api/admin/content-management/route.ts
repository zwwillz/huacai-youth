import { getAdminViewer } from "@/app/admin/admin-viewer";
import { saveContentManagementData, type ContentManagementInput } from "@/db/content-management";
import { getContentManagementDataFast } from "@/db/content-management-fast";
import { setContentPublicationStatusFast } from "@/db/content-publication-fast";
import { getSqlClient } from "@/db";
import { revalidatePath, revalidateTag } from "next/cache";

export const dynamic = "force-dynamic";

function refreshPublicEvent(eventId: string) {
  revalidateTag("public-site", { expire: 0 });
  revalidateTag("public-content", { expire: 0 });
  revalidateTag(`public-event-detail-${eventId}`, { expire: 0 });
  revalidatePath("/");
}

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
    const eventId = payload.action === "publication" ? payload.eventId : payload.data.eventId;
    const sql = getSqlClient();
    const rows = await sql<Array<{ status: string }>>`select status from public.events where id=${eventId} limit 1`;
    if (rows[0]?.status === "archived") throw new Error("已归档赛事为只读状态，不能继续修改或发布内容。");

    if (payload.action === "publication") {
      const data = await setContentPublicationStatusFast(viewer, payload.eventId, payload.publicationId, payload.status);
      refreshPublicEvent(eventId);
      return Response.json({ data }, { headers: { "Cache-Control": "private, no-store", "Server-Timing": `app;dur=${(performance.now() - startedAt).toFixed(1)}` } });
    }
    const data = await saveContentManagementData(viewer.username, payload.data);
    refreshPublicEvent(eventId);
    return Response.json({ data }, { headers: { "Cache-Control": "private, no-store", "Server-Timing": `app;dur=${(performance.now() - startedAt).toFixed(1)}` } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "内容保存失败。" }, { status: 400 });
  }
}
