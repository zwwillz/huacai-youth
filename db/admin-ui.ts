import { hash } from "bcryptjs";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { getDb, getSqlClient } from "./index";
import {
  adminSessions,
  auditLogs,
  eventMembers,
  events,
  matches,
  publications,
  registrations,
  users,
  venues,
} from "./schema";

export type AdminNavEvent = {
  id: string;
  shortTitle: string;
  stationNo: number;
  status: string;
  startDate: string;
  endDate: string;
  city: string;
  venueName: string;
  publishStatus: string;
};

const roleLabels: Record<string, string> = {
  system_admin: "系统管理员",
  committee: "组委会",
  referee: "裁判",
};

function now() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return prefix + "_" + crypto.randomUUID().replaceAll("-", "");
}

async function requireActiveAccount(username: string) {
  const db = getDb();
  const [account] = await db.select().from(users).where(and(eq(users.username, username), eq(users.status, "active"))).limit(1);
  if (!account) throw new Error("当前账号尚未获得后台权限。");
  return account;
}

async function requireSystemAdmin(username: string) {
  const account = await requireActiveAccount(username);
  if (account.role !== "system_admin") throw new Error("只有系统管理员可以执行这个操作。");
  return account;
}

async function loadAdminNavigationEvents(username: string): Promise<AdminNavEvent[]> {
  const account = await requireActiveAccount(username);
  const db = getDb();
  const memberEventIds = account.role === "system_admin" ? null : await db
    .select({ eventId: eventMembers.eventId })
    .from(eventMembers)
    .where(and(eq(eventMembers.userId, account.id), eq(eventMembers.status, "active")))
    .then((rows) => [...new Set(rows.map((row) => row.eventId))]);
  if (memberEventIds && !memberEventIds.length) return [];
  const base = db.select({
    id: events.id,
    shortTitle: events.shortTitle,
    stationNo: events.stationNo,
    status: events.status,
    startDate: events.startDate,
    endDate: events.endDate,
    city: events.city,
    venueName: venues.name,
    publishStatus: events.publishStatus,
  }).from(events).leftJoin(venues, eq(events.venueId, venues.id));
  const rows = memberEventIds
    ? await base.where(inArray(events.id, memberEventIds)).orderBy(desc(events.year), desc(events.stationNo))
    : await base.orderBy(desc(events.year), desc(events.stationNo));
  return rows.map((row) => ({ ...row, venueName: row.venueName ?? "" }));
}

export const getAdminNavigationEvents = unstable_cache(loadAdminNavigationEvents, ["admin-navigation-events-v3"], {
  revalidate: 30,
  tags: ["admin-navigation-events"],
});

export async function getAdminHomeData(username: string) {
  const db = getDb();
  const eventRows = await getAdminNavigationEvents(username);
  const eventIds = eventRows.map((event) => event.id);
  const [pendingRegistrations, draftPublications] = eventIds.length ? await Promise.all([
    db.select({ total: count() }).from(registrations).where(and(eq(registrations.status, "pending"), inArray(registrations.eventId, eventIds))),
    db.select({ total: count() }).from(publications).where(and(eq(publications.status, "draft"), inArray(publications.eventId, eventIds))),
  ]) : [[{ total: 0 }], [{ total: 0 }]];
  return {
    events: eventRows,
    metrics: {
      eventCount: eventRows.length,
      activeEventCount: eventRows.filter((event) => event.status === "registration_open" || event.status === "in_progress").length,
      pendingRegistrationCount: Number(pendingRegistrations[0]?.total ?? 0),
      draftPublicationCount: Number(draftPublications[0]?.total ?? 0),
    },
  };
}

export async function getAccountManagementData(username: string) {
  await requireSystemAdmin(username);
  const db = getDb();
  const [accountRows, memberRows] = await Promise.all([
    db.select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      role: users.role,
      status: users.status,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    }).from(users).where(and(eq(users.status, "active"))).orderBy(desc(users.createdAt)),
    db.select({ userId: eventMembers.userId, eventId: eventMembers.eventId, eventTitle: events.shortTitle })
      .from(eventMembers)
      .innerJoin(events, eq(eventMembers.eventId, events.id))
      .where(eq(eventMembers.status, "active")),
  ]);
  const assigned = new Map<string, Array<{ id: string; title: string }>>();
  for (const row of memberRows) {
    const list = assigned.get(row.userId) ?? [];
    list.push({ id: row.eventId, title: row.eventTitle });
    assigned.set(row.userId, list);
  }
  return accountRows.map((row) => ({ ...row, roleLabel: roleLabels[row.role] ?? row.role, assignedEvents: assigned.get(row.id) ?? [] }));
}

export async function getAuditLogData(username: string, limit = 100) {
  await requireSystemAdmin(username);
  const db = getDb();
  const rows = await db.select({
    id: auditLogs.id,
    createdAt: auditLogs.createdAt,
    moduleType: auditLogs.moduleType,
    targetType: auditLogs.targetType,
    targetId: auditLogs.targetId,
    action: auditLogs.action,
    reason: auditLogs.reason,
    eventId: auditLogs.eventId,
    actorName: users.displayName,
    actorUsername: users.username,
  }).from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorUserId, users.id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(Math.min(300, Math.max(1, limit)));
  return rows.map((row) => ({ ...row, actorName: row.actorName ?? "系统", actorUsername: row.actorUsername ?? "-" }));
}

function validateUsername(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(normalized)) throw new Error("用户名需为3至32位小写字母、数字、点、横线或下划线。");
  return normalized;
}

function validatePassword(value: string) {
  if (value.length < 8 || value.length > 72) throw new Error("密码需为8至72个字符。");
}

export type AccountAdminAction =
  | { action: "create"; username: string; displayName: string; password: string; role: "committee" | "referee" }
  | { action: "status"; id: string; status: "active" | "disabled" }
  | { action: "password"; id: string; password: string }
  | { action: "role"; id: string; role: "committee" | "referee" }
  | { action: "delete"; id: string };

export async function manageAdminAccount(actorUsername: string, input: AccountAdminAction) {
  const actor = await requireSystemAdmin(actorUsername);
  const db = getDb();
  const updatedAt = now();

  if (input.action === "create") {
    const username = validateUsername(input.username);
    validatePassword(input.password);
    if (!input.displayName.trim()) throw new Error("请填写账号显示名称。");
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
    if (existing) throw new Error("该用户名已经存在。");
    const accountId = id("usr");
    await db.insert(users).values({
      id: accountId,
      username,
      email: null,
      displayName: input.displayName.trim(),
      passwordHash: await hash(input.password, 12),
      role: input.role,
      status: "active",
      passwordUpdatedAt: updatedAt,
      createdAt: updatedAt,
      updatedAt,
    });
    await db.insert(auditLogs).values({ id: id("log"), actorUserId: actor.id, moduleType: "accounts", targetType: "user", targetId: accountId, action: "create_account", afterJson: JSON.stringify({ username, role: input.role }), createdAt: updatedAt });
    return getAccountManagementData(actorUsername);
  }

  const [target] = await db.select().from(users).where(eq(users.id, input.id)).limit(1);
  if (!target || target.status === "deleted") throw new Error("没有找到该后台账号。");
  if (target.role === "system_admin") throw new Error("系统管理员账号不能在这里修改或删除。");

  if (input.action === "status") {
    await db.update(users).set({ status: input.status, updatedAt }).where(eq(users.id, target.id));
    if (input.status === "disabled") await db.delete(adminSessions).where(eq(adminSessions.userId, target.id));
    await db.insert(auditLogs).values({ id: id("log"), actorUserId: actor.id, moduleType: "accounts", targetType: "user", targetId: target.id, action: input.status === "active" ? "enable_account" : "disable_account", createdAt: updatedAt });
  } else if (input.action === "password") {
    validatePassword(input.password);
    await db.update(users).set({ passwordHash: await hash(input.password, 12), passwordUpdatedAt: updatedAt, updatedAt }).where(eq(users.id, target.id));
    await db.delete(adminSessions).where(eq(adminSessions.userId, target.id));
    await db.insert(auditLogs).values({ id: id("log"), actorUserId: actor.id, moduleType: "accounts", targetType: "user", targetId: target.id, action: "reset_password", createdAt: updatedAt });
  } else if (input.action === "role") {
    await db.update(users).set({ role: input.role, updatedAt }).where(eq(users.id, target.id));
    await db.update(eventMembers).set({ role: input.role, updatedAt }).where(eq(eventMembers.userId, target.id));
    await db.insert(auditLogs).values({ id: id("log"), actorUserId: actor.id, moduleType: "accounts", targetType: "user", targetId: target.id, action: "change_role", beforeJson: JSON.stringify({ role: target.role }), afterJson: JSON.stringify({ role: input.role }), createdAt: updatedAt });
  } else {
    const deletedUsername = `deleted.${target.id.slice(-8)}.${target.username}`.slice(0, 64);
    await db.transaction(async (tx) => {
      await tx.delete(adminSessions).where(eq(adminSessions.userId, target.id));
      await tx.delete(eventMembers).where(eq(eventMembers.userId, target.id));
      await tx.update(users).set({
        username: deletedUsername,
        email: null,
        displayName: `${target.displayName}（已删除）`,
        passwordHash: await hash(crypto.randomUUID(), 12),
        status: "deleted",
        updatedAt,
      }).where(eq(users.id, target.id));
      await tx.insert(auditLogs).values({ id: id("log"), actorUserId: actor.id, moduleType: "accounts", targetType: "user", targetId: target.id, action: "delete_account", beforeJson: JSON.stringify({ username: target.username, displayName: target.displayName, role: target.role }), createdAt: updatedAt });
    });
  }

  return getAccountManagementData(actorUsername);
}

export async function deleteMistakenEvent(username: string, eventId: string) {
  const actor = await requireSystemAdmin(username);
  const db = getDb();
  const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!event) throw new Error("没有找到要删除的赛事。");

  const [[registrationRow], [matchRow]] = await Promise.all([
    db.select({ total: count() }).from(registrations).where(eq(registrations.eventId, eventId)),
    db.select({ total: count() }).from(matches).where(eq(matches.eventId, eventId)),
  ]);
  if (Number(registrationRow?.total ?? 0) > 0 || Number(matchRow?.total ?? 0) > 0) {
    throw new Error("该赛事已经有报名或比赛数据，为防止误删不能直接删除。请先归档，或后续通过数据维护工具处理。");
  }

  const sql = getSqlClient();
  await sql.begin(async (tx) => {
    await tx`update public.audit_logs set event_id = null where event_id = ${eventId}`;
    await tx`delete from public.event_assets where event_id = ${eventId}`;
    await tx`delete from public.event_rankings where event_id = ${eventId}`;
    await tx`delete from public.publications where event_id = ${eventId}`;
    await tx`delete from public.event_guides where event_id = ${eventId}`;
    await tx`delete from public.event_documents where event_id = ${eventId}`;
    await tx`delete from public.event_sponsors where event_id = ${eventId}`;
    await tx`delete from public.event_organizations where event_id = ${eventId}`;
    await tx`delete from public.event_members where event_id = ${eventId}`;
    await tx`delete from public.event_details where event_id = ${eventId}`;
    await tx`delete from public.event_phases where event_id = ${eventId}`;
    await tx`delete from public.event_groups where event_id = ${eventId}`;
    await tx`delete from public.events where id = ${eventId}`;
  });

  await db.insert(auditLogs).values({
    id: id("log"),
    actorUserId: actor.id,
    eventId: null,
    moduleType: "events",
    targetType: "event",
    targetId: eventId,
    action: "delete_event",
    beforeJson: JSON.stringify({ shortTitle: event.shortTitle, stationNo: event.stationNo, year: event.year }),
    createdAt: now(),
  });
  return { ok: true };
}
