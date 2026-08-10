import { getAdminViewer } from "@/app/admin/admin-viewer";
import { saveEventManagementData, type EventManagementInput } from "@/db/event-management";
import { getEventManagementDataFast } from "@/db/event-management-fast";
import { saveEventOverviewData, type EventOverviewInput } from "@/db/event-overview";
import { syncEventOverviewPublication } from "@/db/event-publication-sync";
import { getSqlClient } from "@/db";
import { revalidatePath, revalidateTag } from "next/cache";

export const dynamic = "force-dynamic";

type RequestPayload = EventManagementInput | { action: "save_overview"; data: EventOverviewInput };

async function normalizeEventJson(eventId: string) {
  const sql = getSqlClient();
  await sql`
    update public.event_details set
      age_rules=case when jsonb_typeof(age_rules)='string' then (age_rules #>> '{}')::jsonb else age_rules end,
      competition_format=case when jsonb_typeof(competition_format)='string' then (competition_format #>> '{}')::jsonb else competition_format end,
      draw_rules=case when jsonb_typeof(draw_rules)='string' then (draw_rules #>> '{}')::jsonb else draw_rules end,
      prizes=case when jsonb_typeof(prizes)='string' then (prizes #>> '{}')::jsonb else prizes end
    where event_id=${eventId}
  `;
}

function refreshPublicEvent(eventId: string) {
  revalidateTag("admin-navigation-events", { expire: 0 });
  revalidateTag("public-site", { expire: 0 });
  revalidateTag("public-content", { expire: 0 });
  revalidateTag(`public-event-detail-${eventId}`, { expire: 0 });
  revalidatePath("/");
  revalidatePath(`/api/public/events/${eventId}/detail`);
}

export async function GET(request: Request) {
  const startedAt = performance.now();
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "请先登录后台。" }, { status: 401 });
  const eventId = new URL(request.url).searchParams.get("eventId")?.trim();
  if (!eventId) return Response.json({ error: "缺少赛事ID。" }, { status: 400 });
  try {
    const data = await getEventManagementDataFast(viewer, eventId);
    return Response.json({ data }, { headers: { "Cache-Control": "private, no-store", "Server-Timing": `app;dur=${(performance.now() - startedAt).toFixed(1)}` } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "赛事资料读取失败。" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "请先登录后台。" }, { status: 401 });
  try {
    const payload = await request.json() as RequestPayload;

    if ("action" in payload && payload.action === "save_overview") {
      const input = payload.data;
      const data = await saveEventOverviewData(viewer.username, input);
      await syncEventOverviewPublication(input.eventId, input.publishStatus === "published");
      refreshPublicEvent(input.eventId);
      return Response.json({ data }, { headers: { "Cache-Control": "private, no-store" } });
    }

    const input = payload as EventManagementInput;
    const sql = getSqlClient();
    const rows = await sql<Array<{ status: string }>>`select status from public.events where id=${input.eventId} limit 1`;
    if (rows[0]?.status === "archived") throw new Error("已归档赛事为只读状态，不能继续修改。");

    await saveEventManagementData(viewer.username, input);
    await normalizeEventJson(input.eventId);
    await syncEventOverviewPublication(input.eventId, input.publishStatus === "published");
    const data = await getEventManagementDataFast(viewer, input.eventId);
    refreshPublicEvent(input.eventId);
    return Response.json({ data });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "赛事资料保存失败。" }, { status: 400 });
  }
}
