import { getAdminViewer } from "@/app/admin/admin-viewer";
import { getEventManagementData, saveEventManagementData, type EventManagementInput } from "@/db/event-management";
import { syncEventOverviewPublication } from "@/db/event-publication-sync";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "请先登录后台。" }, { status: 401 });
  const eventId = new URL(request.url).searchParams.get("eventId")?.trim();
  if (!eventId) return Response.json({ error: "缺少赛事ID。" }, { status: 400 });
  try {
    return Response.json({ data: await getEventManagementData(viewer.username, eventId) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "赛事资料读取失败。" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "请先登录后台。" }, { status: 401 });
  try {
    const input = await request.json() as EventManagementInput;
    const data = await saveEventManagementData(viewer.username, input);
    await syncEventOverviewPublication(input.eventId, input.publishStatus === "published");
    return Response.json({ data });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "赛事资料保存失败。" }, { status: 400 });
  }
}
