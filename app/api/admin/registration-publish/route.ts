import { getAdminViewer } from "@/app/admin/admin-viewer";
import { getRegistrationPublishData, saveRegistrationDraft, setRegistrationPublicationStatus } from "@/db/registration-publishing";
import { revalidatePath, revalidateTag } from "next/cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function refreshPublic(eventId: string) {
  revalidateTag("public-site", { expire: 0 });
  revalidateTag("public-content", { expire: 0 });
  revalidateTag(`public-event-detail-${eventId}`, { expire: 0 });
  revalidatePath("/");
  revalidatePath(`/api/public/events/${eventId}/detail`);
}

export async function GET(request: Request) {
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "请先登录后台。" }, { status: 401 });
  try {
    const eventId = new URL(request.url).searchParams.get("eventId") || "";
    if (!eventId) throw new Error("缺少赛事ID。");
    return Response.json({ data: await getRegistrationPublishData(viewer, eventId) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "报名发布数据读取失败。" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "请先登录后台。" }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const eventId = String(body.eventId || "");
    const action = String(body.action || "save");
    if (!eventId) throw new Error("缺少赛事ID。");
    if (action === "save") {
      const data = await saveRegistrationDraft(viewer, eventId, {
        registrationStartAt: String(body.registrationStartAt || ""),
        registrationEndAt: String(body.registrationEndAt || ""),
        registrationNote: String(body.registrationNote || ""),
        registrationUrl: String(body.registrationUrl || ""),
      });
      return Response.json({ data });
    }
    if (action === "publish" || action === "unpublish") {
      const data = await setRegistrationPublicationStatus(viewer, eventId, action === "publish" ? "published" : "draft");
      refreshPublic(eventId);
      return Response.json({ data });
    }
    throw new Error("不支持的报名发布操作。");
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "报名发布操作失败。" }, { status: 400 });
  }
}
