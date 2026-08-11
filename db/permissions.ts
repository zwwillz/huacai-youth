import { getSqlClient } from "./index";
import { cache } from "react";

export type BackendRole = "system_admin" | "committee" | "referee";
export type AdminPrincipal = {
  id: string;
  username: string;
  role: BackendRole;
  displayName: string;
};
export type AdminPrincipalLike = {
  id: string;
  username: string;
  role: string;
  displayName: string;
};
export type AdminPrincipalInput = string | AdminPrincipalLike;
export type EventAccessViewer = AdminPrincipal & {
  eventMemberRole: string | null;
};

type LoadedEventAccessViewer = EventAccessViewer & {
  hasEventAccess: boolean;
  eventExists: boolean;
  eventStatus: string | null;
};

type EventState = { status: string };

export const ARCHIVED_EVENT_WRITE_MESSAGE = "已归档赛事为历史只读状态。如需继续维护，请由系统管理员先撤回归档。";

function asBackendRole(value: string): BackendRole {
  if (value === "system_admin" || value === "committee" || value === "referee") return value;
  throw new Error("当前账号角色无效或尚未获得后台权限。");
}

export function assertEventWritable(status: string | null | undefined) {
  if (status === "archived") throw new Error(ARCHIVED_EVENT_WRITE_MESSAGE);
}

const loadActivePrincipal = cache(async (username: string): Promise<AdminPrincipal | null> => {
  const sql = getSqlClient();
  const rows = await sql<Array<AdminPrincipalLike>>`
    select id,username,role,display_name as "displayName"
    from public.users
    where username=${username} and status='active'
    limit 1
  `;
  const row = rows[0];
  return row ? { ...row, role: asBackendRole(row.role) } : null;
});

export async function resolveAdminPrincipal(input: AdminPrincipalInput): Promise<AdminPrincipal> {
  if (typeof input !== "string") return { id: input.id, username: input.username, displayName: input.displayName, role: asBackendRole(input.role) };
  const principal = await loadActivePrincipal(input);
  if (!principal) throw new Error("当前账号尚未获得后台权限。");
  return principal;
}

const loadEventAccessViewer = cache(async (username: string, eventId: string) => {
  const sql = getSqlClient();
  const rows = await sql<Array<AdminPrincipalLike & {
    eventMemberRole: string | null;
    hasEventAccess: boolean;
    eventExists: boolean;
    eventStatus: string | null;
  }>>`
    select u.id,u.username,u.role,u.display_name as "displayName",
      em.role as "eventMemberRole",(em.id is not null) as "hasEventAccess",
      (e.id is not null) as "eventExists",e.status as "eventStatus"
    from public.users u
    left join public.events e on e.id=${eventId}
    left join public.event_members em
      on em.user_id=u.id and em.event_id=${eventId} and em.status='active'
    where u.username=${username} and u.status='active'
    limit 1
  `;
  const row = rows[0];
  return row ? { ...row, role: asBackendRole(row.role) } as LoadedEventAccessViewer : null;
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

const loadEventState = cache(async (eventId: string): Promise<EventState | null> => {
  const sql = getSqlClient();
  const rows = await sql<EventState[]>`
    select status from public.events where id=${eventId} limit 1
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
    /** State-changing access also enforces the event lifecycle write boundary. */
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
    if (!viewer.eventExists) throw new Error("没有找到这场赛事。");
    if (viewer.role !== "system_admin" && !viewer.hasEventAccess) {
      throw new Error("当前账号未被分配到这场赛事，不能读取或修改本站数据。");
    }
    if (options.write) assertEventWritable(viewer.eventStatus);
    return {
      id: viewer.id,
      username: viewer.username,
      role: viewer.role,
      displayName: viewer.displayName,
      eventMemberRole: viewer.eventMemberRole,
    };
  }

  const principal = await resolveAdminPrincipal(input);
  assertAdminRole(principal, allowedRoles, deniedMessage);
  const event = await loadEventState(eventId);
  if (!event) throw new Error("没有找到这场赛事。");
  if (principal.role !== "system_admin") {
    const membership = await loadPrincipalEventMembership(principal.id, eventId);
    if (!membership) throw new Error("当前账号未被分配到这场赛事，不能读取或修改本站数据。");
    if (options.write) assertEventWritable(event.status);
    return { ...principal, eventMemberRole: membership.role };
  }
  if (options.write) assertEventWritable(event.status);
  return { ...principal, eventMemberRole: null };
}
