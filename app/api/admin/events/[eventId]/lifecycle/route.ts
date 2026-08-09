import { getAdminViewer } from "@/app/admin/admin-viewer";
import { getSqlClient } from "@/db";
import { requireEventAccess } from "@/db/permissions";
import { revalidatePath, revalidateTag } from "next/cache";

export const dynamic = "force-dynamic";

type LifecycleAction = "hide" | "show" | "archive";

function id(prefix: string) {
  return prefix + "_" + crypto.randomUUID().replaceAll("-", "");
}

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "请先登录后台。" }, { status: 401 });

  try {
    const { eventId } = await params;
    const payload = await request.json() as { action?: LifecycleAction };
    if (!payload.action || !["hide", "show", "archive"].includes(payload.action)) {
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
    if (current.status === "archived") throw new Error("已归档赛事为只读状态，不能继续修改。");

    const updatedAt = new Date().toISOString();
    if (payload.action === "archive") {
      if (current.status !== "finished") throw new Error("只有已结束的赛事才能归档。请先确认赛事已经结束。");
      await sql`update public.events set status='archived', updated_by=${actor.id}, updated_at=${updatedAt} where id=${eventId}`;
    } else {
      await sql`update public.events set is_hidden=${payload.action === "hide"}, updated_by=${actor.id}, updated_at=${updatedAt} where id=${eventId}`;
    }

    await sql`
      insert into public.audit_logs (id, actor_user_id, event_id, module_type, target_type, target_id, action, before_json, after_json, created_at)
      values (
        ${id("log")}, ${actor.id}, ${eventId}, 'events', 'event', ${eventId}, ${`event_${payload.action}`},
        ${JSON.stringify({ status: current.status, isHidden: current.isHidden })},
        ${JSON.stringify(payload.action === "archive" ? { status: "archived" } : { isHidden: payload.action === "hide" })},
        ${updatedAt}
      )
    `;

    revalidateTag("admin-navigation-events", { expire: 0 });
    revalidateTag("public-site", { expire: 0 });
    revalidateTag("public-content", { expire: 0 });
    revalidatePath("/");
    return Response.json({ data: { ok: true } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "赛事状态修改失败。" }, { status: 400 });
  }
}
