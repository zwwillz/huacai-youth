import { getAdminViewer } from "@/app/admin/admin-viewer";
import { getSchedulePublishData, saveSchedulePublishData, setSchedulePublishStatus, type SchedulePublishInput } from "@/db/schedule-publish";
import { revalidatePath, revalidateTag } from "next/cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function refreshPublicSchedule(eventId: string) {
  revalidateTag("public-site", { expire: 0 });
  revalidateTag("public-content", { expire: 0 });
  revalidateTag(`public-event-detail-${eventId}`, { expire: 0 });
  revalidateTag(`public-competition-${eventId}`, { expire: 0 });
  revalidatePath("/");
  revalidatePath(`/api/public/events/${eventId}/detail`);
  revalidatePath(`/api/public/events/${eventId}/competition`);
}

export async function GET(request: Request) {
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "请先登录后台。" }, { status: 401 });
  try {
    const eventId = new URL(request.url).searchParams.get("eventId")?.trim() || "";
    if (!eventId) throw new Error("缺少赛事ID。");
    const data = await getSchedulePublishData(viewer, eventId);
    return Response.json({ data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "主赛程读取失败。" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "请先登录后台。" }, { status: 401 });
  try {
    const payload = await request.json() as
      | { action: "save"; data: SchedulePublishInput }
      | { action: "publication"; eventId: string; status: "draft" | "published" };

    if (payload.action === "save") {
      const data = await saveSchedulePublishData(viewer, payload.data);
      refreshPublicSchedule(payload.data.eventId);
      return Response.json({ data }, { headers: { "Cache-Control": "private, no-store" } });
    }

    if (!payload.eventId || !["draft", "published"].includes(payload.status)) throw new Error("发布状态不正确。");
    const data = await setSchedulePublishStatus(viewer, payload.eventId, payload.status);
    refreshPublicSchedule(payload.eventId);
    return Response.json({ data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "主赛程保存失败。" }, { status: 400 });
  }
}
