import { hash } from "bcryptjs";
import { and, desc, eq, ne } from "drizzle-orm";
import { getDb } from "./index";
import { adminSessions, auditLogs, eventMembers, events, users } from "./schema";

const roleLabels: Record<string, string> = {
  system_admin: "系统管理员",
  committee: "组委会",
  referee: "裁判",
};

function now() { return new Date().toISOString(); }
function id(prefix: string) { return prefix + "_" + crypto.randomUUID().replaceAll("-", ""); }

async function requireSystemAdmin(username: string) {
  const db = getDb();
  const [account] = await db.select().from(users).where(and(eq(users.username, username), eq(users.status, "active"))).limit(1);
  if (!account || account.role !== "system_admin") throw new Error("只有系统管理员可以管理后台账号。");
  return account;
}

function validateUsername(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(normalized)) throw new Error("用户名需为3至32位小写字母、数字、点、横线或下划线。");
  return normalized;
}

function validatePassword(value: string) {
  if (value.length < 8 || value.length > 72) throw new Error("密码需为8至72个字符。");
}

export type AccountManagementRow = {
  id: string;
  username: string;
  displayName: string;
  role: string;
  roleLabel: string;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
  assignedEvents: Array<{ id: string; title: string }>;
};

export async function getAccountsForAdmin(username: string): Promise<AccountManagementRow[]> {
  await requireSystemAdmin(username);
  const db = getDb();
  const [accountRows, membershipRows] = await Promise.all([
    db.select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      role: users.role,
      status: users.status,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    }).from(users).where(ne(users.status, "deleted")).orderBy(desc(users.createdAt)),
    db.select({ userId: eventMembers.userId, eventId: events.id, eventTitle: events.shortTitle })
      .from(eventMembers)
      .innerJoin(events, eq(eventMembers.eventId, events.id))
      .where(eq(eventMembers.status, "active")),
  ]);
  const assignmentMap = new Map<string, Array<{ id: string; title: string }>>();
  for (const row of membershipRows) {
    const list = assignmentMap.get(row.userId) ?? [];
    list.push({ id: row.eventId, title: row.eventTitle });
    assignmentMap.set(row.userId, list);
  }
  return accountRows.map((row) => ({ ...row, roleLabel: roleLabels[row.role] ?? row.role, assignedEvents: assignmentMap.get(row.id) ?? [] }));
}

export type AccountAction =
  | { action: "create"; username: string; displayName: string; password: string; role: "committee" | "referee" }
  | { action: "status"; id: string; status: "active" | "disabled" }
  | { action: "password"; id: string; password: string }
  | { action: "role"; id: string; role: "committee" | "referee" }
  | { action: "delete"; id: string };

export async function updateAdminAccount(actorUsername: string, input: AccountAction) {
  const actor = await requireSystemAdmin(actorUsername);
  const db = getDb();
  const updatedAt = now();

  if (input.action === "create") {
    const username = validateUsername(input.username);
    validatePassword(input.password);
    if (!input.displayName.trim()) throw new Error("请填写账号显示名称。");
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
    if (existing) throw new Error("该用户名已经存在。");
    const userId = id("usr");
    await db.insert(users).values({
      id: userId,
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
    await db.insert(auditLogs).values({ id: id("log"), actorUserId: actor.id, moduleType: "accounts", targetType: "user", targetId: userId, action: "create_account", afterJson: JSON.stringify({ username, role: input.role }), createdAt: updatedAt });
    return getAccountsForAdmin(actorUsername);
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
    await db.transaction(async (tx) => {
      await tx.update(users).set({ role: input.role, updatedAt }).where(eq(users.id, target.id));
      await tx.update(eventMembers).set({ role: input.role, updatedAt }).where(eq(eventMembers.userId, target.id));
      await tx.insert(auditLogs).values({ id: id("log"), actorUserId: actor.id, moduleType: "accounts", targetType: "user", targetId: target.id, action: "change_role", beforeJson: JSON.stringify({ role: target.role }), afterJson: JSON.stringify({ role: input.role }), createdAt: updatedAt });
    });
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

  return getAccountsForAdmin(actorUsername);
}
