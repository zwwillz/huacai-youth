import { getAdminViewer } from "@/app/admin/admin-viewer";
import { getContentManagementData } from "@/db/content-management";
import { saveEventOverviewData, type EventOverviewInput } from "@/db/event-overview";
import { revalidatePath, revalidateTag } from "next/cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function refreshPublic(eventId: string) {
  revalidateTag("admin-navigation-events", { expire: 0 });
  revalidateTag("public-site", { expire: 0 });
  revalidateTag("public-content", { expire: 0 });
  revalidateTag(`public-event-detail-${eventId}`, { expire: 0 });
  revalidatePath("/");
  revalidatePath(`/api/public/events/${eventId}/detail`);
}

export async function POST(request: Request) {
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "请先登录后台。" }, { status: 401 });
  try {
    const input = await request.json() as EventOverviewInput;
    if (!input?.eventId) throw new Error("缺少赛事ID。");
    const event = await saveEventOverviewData(viewer.username, input);
    const content = await getContentManagementData(viewer.username, input.eventId);
    refreshPublic(input.eventId);
    return Response.json({ data: { event, content } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "赛事概览保存失败。" }, { status: 400 });
  }
}
