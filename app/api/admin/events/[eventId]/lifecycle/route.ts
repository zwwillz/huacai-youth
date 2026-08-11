import { getAdminViewer } from "@/app/admin/admin-viewer";
import { getSqlClient } from "@/db";
import { changeEventLifecycle, type EventLifecycleAction } from "@/db/event-lifecycle";
import { requireEventAccess } from "@/db/permissions";
import { revalidatePath, revalidateTag } from "next/cache";

export const dynamic = "force-dynamic";

type LifecycleAction = "hide" | "show" | EventLifecycleAction;
const ACTIONS: LifecycleAction[] = ["hide", "show", "open_registration", "close_registration", "start_competition", "finish_event", "force_finish", "archive", "restore"];

function id(prefix: string) { return prefix + "_" + crypto.randomUUID().replaceAll("-", ""); }
function invalidate(eventId: string) {
  revalidateTag("admin-navigation-events", { expire: 0 });
  revalidateTag("public-site", { expire: 0 });
  revalidateTag("public-content", { expire: 0 });
  revalidateTag(`public-event-detail-${eventId}`, { expire: 0 });
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/events");
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath(`/api/public/events/${eventId}/detail`);
}

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "请先登录后台。" }, { status: 401 });

  try {
    const { eventId } = await params;
    const payload = await request.json() as { action?: LifecycleAction; reason?: string };
    if (!payload.action || !ACTIONS.includes(payload.action)) return Response.json({ error: "赛事操作不正确。" }, { status: 400 });

    if (payload.action !== "hide" && payload.action !== "show") {
      const data = await changeEventLifecycle(viewer, eventId, payload.action, payload.reason || "");
      invalidate(eventId);
      return Response.json({ data });
    }

    const actor = await requireEventAccess(viewer, eventId, {
      allowedRoles: ["system_admin", "committee"],
      deniedMessage: "当前账号没有管理该赛事的权限。",
    });
    const sql = getSqlClient();
    const rows = await sql<Array<{ status: string; isHidden: boolean }>>`
      select status,coalesce(is_hidden,false) as "isHidden" from public.events where id=${eventId} limit 1
    `;
    const current = rows[0];
    if (!current) throw new Error("没有找到这场赛事。");
    if (current.status === "archived") throw new Error("已归档赛事为历史只读状态。如需继续维护，请由系统管理员先撤回归档。");
    const updatedAt = new Date().toISOString();
    const hidden = payload.action === "hide";
    await sql`update public.events set is_hidden=${hidden},updated_by=${actor.id},updated_at=${updatedAt} where id=${eventId}`;
    await sql`
      insert into public.audit_logs (id,actor_user_id,event_id,module_type,target_type,target_id,action,before_json,after_json,created_at)
      values (${id("log")},${actor.id},${eventId},'events','event',${eventId},${`event_${payload.action}`},
        ${JSON.stringify({ status: current.status, isHidden: current.isHidden })},${JSON.stringify({ isHidden: hidden })},${updatedAt})
    `;
    invalidate(eventId);
    return Response.json({ data: { ok: true, isHidden: hidden } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "赛事状态修改失败。" }, { status: 400 });
  }
}
