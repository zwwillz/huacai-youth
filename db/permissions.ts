import { getSqlClient } from "./index";
import { cache } from "react";

export type BackendRole = "system_admin" | "committee" | "referee";
export type EventAccessViewer = {
  id: string;
  username: string;
  role: BackendRole;
  displayName: string;
  eventMemberRole: string | null;
};

const loadEventAccessViewer = cache(async (username: string, eventId: string) => {
  const sql = getSqlClient();
  const rows = await sql<Array<EventAccessViewer & { hasEventAccess: boolean }>>`
    select u.id,u.username,u.role,u.display_name as "displayName",
      em.role as "eventMemberRole",(em.id is not null) as "hasEventAccess"
    from public.users u
    left join public.event_members em
      on em.user_id=u.id and em.event_id=${eventId} and em.status='active'
    where u.username=${username} and u.status='active'
    limit 1
  `;
  return rows[0] ?? null;
});

export async function requireEventAccess(
  username: string,
  eventId: string,
  options: {
    /** Marks state-changing access for call-site clarity; role restrictions remain explicit via allowedRoles. */
    write?: boolean;
    allowedRoles?: BackendRole[];
    deniedMessage?: string;
  } = {},
): Promise<EventAccessViewer> {
  if (!eventId) throw new Error("缺少赛事ID。");
  const viewer = await loadEventAccessViewer(username, eventId);
  const allowedRoles = options.allowedRoles ?? ["system_admin", "committee", "referee"];
  if (!viewer || !allowedRoles.includes(viewer.role)) {
    throw new Error(options.deniedMessage || "当前账号没有执行此操作的权限。");
  }
  if (viewer.role !== "system_admin" && !viewer.hasEventAccess) {
    throw new Error("当前账号未被分配到这场赛事，不能读取或修改本站数据。");
  }
  return {
    id: viewer.id,
    username: viewer.username,
    role: viewer.role,
    displayName: viewer.displayName,
    eventMemberRole: viewer.eventMemberRole,
  };
}
