import { getSqlClient } from "./index";
import { cache } from "react";

export type BackendRole = "system_admin" | "committee" | "referee";
export type AdminPrincipal = {
  id: string;
  username: string;
  role: BackendRole;
  displayName: string;
};
export type AdminPrincipalInput = string | AdminPrincipal;
export type EventAccessViewer = AdminPrincipal & {
  eventMemberRole: string | null;
};

type LoadedEventAccessViewer = EventAccessViewer & { hasEventAccess: boolean };

export function isAdminPrincipal(value: AdminPrincipalInput): value is AdminPrincipal {
  return typeof value !== "string";
}

const loadActivePrincipal = cache(async (username: string): Promise<AdminPrincipal | null> => {
  const sql = getSqlClient();
  const rows = await sql<AdminPrincipal[]>`
    select id,username,role,display_name as "displayName"
    from public.users
    where username=${username} and status='active'
    limit 1
  `;
  return rows[0] ?? null;
});

export async function resolveAdminPrincipal(input: AdminPrincipalInput): Promise<AdminPrincipal> {
  if (isAdminPrincipal(input)) return input;
  const principal = await loadActivePrincipal(input);
  if (!principal) throw new Error("当前账号尚未获得后台权限。");
  return principal;
}

const loadEventAccessViewer = cache(async (username: string, eventId: string) => {
  const sql = getSqlClient();
  const rows = await sql<LoadedEventAccessViewer[]>`
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

const loadPrincipalEventMembership = cache(async (userId: string, eventId: string) => {
  const sql = getSqlClient();
  const rows = await sql<Array<{ role: string }>>`
    select role from public.event_members
    where user_id=${userId} and event_id=${eventId} and status='active'
    limit 1
  `;
  return rows[0] ?? null;
});

export function assertAdminRole(
  principal: AdminPrincipal,
  allowedRoles: BackendRole[],
  deniedMessage = "当前账号没有执行此操作的权限。",
) {
  if (!allowedRoles.includes(principal.role)) throw new Error(deniedMessage);
  return principal;
}

export async function requireEventAccess(
  input: AdminPrincipalInput,
  eventId: string,
  options: {
    /** Marks state-changing access for call-site clarity; role restrictions remain explicit via allowedRoles. */
    write?: boolean;
    allowedRoles?: BackendRole[];
    deniedMessage?: string;
  } = {},
): Promise<EventAccessViewer> {
  if (!eventId) throw new Error("缺少赛事ID。");
  const allowedRoles = options.allowedRoles ?? ["system_admin", "committee", "referee"];
  const deniedMessage = options.deniedMessage || "当前账号没有执行此操作的权限。";

  if (typeof input === "string") {
    const viewer = await loadEventAccessViewer(input, eventId);
    if (!viewer || !allowedRoles.includes(viewer.role)) throw new Error(deniedMessage);
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

  assertAdminRole(input, allowedRoles, deniedMessage);
  if (input.role === "system_admin") return { ...input, eventMemberRole: null };
  const membership = await loadPrincipalEventMembership(input.id, eventId);
  if (!membership) throw new Error("当前账号未被分配到这场赛事，不能读取或修改本站数据。");
  return { ...input, eventMemberRole: membership.role };
}
