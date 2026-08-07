import { getAdminViewer } from "@/app/admin/admin-viewer";
import { EventInput, saveEvent } from "@/db/admin";
import { ensureNewEventDefaults } from "@/db/event-bootstrap";
import { syncEventOverviewPublication } from "@/db/event-publication-sync";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "请先登录后台。" }, { status: 401 });
  try {
    const input = await request.json() as EventInput;
    const data = await saveEvent(viewer.username, input);
    if (!input.id) {
      const created = data.events.find((event) => event.year === Number(input.year) && event.stationNo === Number(input.stationNo) && event.shortTitle === input.shortTitle.trim()) ?? data.events[0];
      if (created) {
        await ensureNewEventDefaults(created.id);
        await syncEventOverviewPublication(created.id, input.publishStatus === "published");
      }
    } else {
      await syncEventOverviewPublication(input.id, input.publishStatus === "published");
    }
    return Response.json({ data });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "赛事保存失败。" }, { status: 400 });
  }
}
