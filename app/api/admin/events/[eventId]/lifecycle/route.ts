import { getAdminViewer } from "@/app/admin/admin-viewer";
import { getSqlClient } from "@/db";
import { requireEventAccess } from "@/db/permissions";
import { revalidatePath, revalidateTag } from "next/cache";

export const dynamic = "force-dynamic";

type LifecycleAction = "hide" | "show" | "archive" | "restore";

function id(prefix: string) {
  return prefix + "_" + crypto.randomUUID().replaceAll("-", "");
}

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "请先登录后台。" }, { status: 401 });

  try {
    const { eventId } = await params;
    const payload = await request.json() as { action?: LifecycleAction };
    if (!payload.action || !["hide", "show", "archive", "restore"].includes(payload.action)) {
      return Response.json({ error: "赛事操作不正确。" }, { status: 400 });
    }

    const actor = await requireEventAccess(viewer.username, eventId, {
      allowedRoles: ["system_admin", "committee"],
      deniedMessage: "当前账号没有管理该赛事的权限。",
    });
    const sql = getSqlClient();
    const rows = await sql<Array<{ status: string; isHidden: boolean; shortTitle: string }>>`
      select status, coalesce(is_hidden, false) as "isHidden", short_title as "shortTitle"
      from public.events where id=${eventId} limit 1
    `;
    const current = rows[0];
    if (!current) throw new Error("没有找到这场赛事。");

    if (payload.action === "restore") {
      if (actor.role !== "system_admin") throw new Error("只有系统管理员可以撤回赛事归档。");
      if (current.status !== "archived") throw new Error("只有已归档赛事可以撤回归档。");
    } else if (current.status === "archived") {
      throw new Error("已归档赛事为只读状态。如需继续维护，请由系统管理员先撤回归档。");
    }

    const updatedAt = new Date().toISOString();
    if (payload.action === "archive") {
      if (current.status !== "finished") throw new Error("只有已结束的赛事才能归档。请先确认赛事已经结束。");
      await sql`update public.events set status='archived', updated_by=${actor.id}, updated_at=${updatedAt} where id=${eventId}`;
    } else if (payload.action === "restore") {
      await sql`update public.events set status='finished', updated_by=${actor.id}, updated_at=${updatedAt} where id=${eventId}`;
    } else {
      await sql`update public.events set is_hidden=${payload.action === "hide"}, updated_by=${actor.id}, updated_at=${updatedAt} where id=${eventId}`;
    }

    const after = payload.action === "archive"
      ? { status: "archived" }
      : payload.action === "restore"
        ? { status: "finished" }
        : { isHidden: payload.action === "hide" };

    await sql`
      insert into public.audit_logs (id, actor_user_id, event_id, module_type, target_type, target_id, action, before_json, after_json, created_at)
      values (
        ${id("log")}, ${actor.id}, ${eventId}, 'events', 'event', ${eventId}, ${`event_${payload.action}`},
        ${JSON.stringify({ status: current.status, isHidden: current.isHidden })},
        ${JSON.stringify(after)},
        ${updatedAt}
      )
    `;

    revalidateTag("admin-navigation-events", { expire: 0 });
    revalidateTag("public-site", { expire: 0 });
    revalidateTag("public-content", { expire: 0 });
    revalidateTag(`public-event-detail-${eventId}`, { expire: 0 });
    revalidatePath("/");
    revalidatePath(`/api/public/events/${eventId}/detail`);
    return Response.json({ data: { ok: true } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "赛事状态修改失败。" }, { status: 400 });
  }
}
