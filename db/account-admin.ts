import { hash } from "bcryptjs";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { getDb } from "./index";
import { adminSessions, auditLogs, eventMembers, events, users } from "./schema";
import {
  MAX_SECONDARY_SYSTEM_ADMINS,
  ROOT_SYSTEM_ADMIN_USERNAME,
  canManageSystemAdminTarget,
  hasSecondarySystemAdminCapacity,
  isRootSystemAdminUsername,
  shouldHideRootSystemAdmin,
} from "./system-admin-policy.mjs";

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
  if (normalized === ROOT_SYSTEM_ADMIN_USERNAME) throw new Error("该用户名不可用于新建账号。");
  return normalized;
}

function validatePassword(value: string) {
  if (value.length < 8 || value.length > 72) throw new Error("密码需为8至72个字符。");
}

function validateDisplayName(value: string) {
  const displayName = value.trim();
  if (!displayName) throw new Error("请填写账号显示名称。");
  if (displayName.length > 64) throw new Error("账号显示名称不能超过64个字符。");
  return displayName;
}

function assertSystemAdminMutationAllowed(actorUsername: string, target: { username: string; role: string }) {
  if (isRootSystemAdminUsername(target.username)) {
    if (!isRootSystemAdminUsername(actorUsername)) throw new Error("没有找到该后台账号。");
    throw new Error("根系统管理员账号受保护，不能在账号管理中修改或删除。");
  }
  if (target.role === "system_admin" && !canManageSystemAdminTarget(actorUsername, target.username)) {
    throw new Error("只有根系统管理员 admin 可以修改或删除其他系统管理员账号。");
  }
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
  const actor = await requireSystemAdmin(username);
  const db = getDb();
  const accountFilter = shouldHideRootSystemAdmin(actor.username)
    ? and(ne(users.status, "deleted"), ne(users.username, ROOT_SYSTEM_ADMIN_USERNAME))
    : ne(users.status, "deleted");
  const [accountRows, membershipRows] = await Promise.all([
    db.select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      role: users.role,
      status: users.status,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    }).from(users).where(accountFilter).orderBy(desc(users.createdAt)),
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
  | { action: "create"; username: string; displayName: string; password: string; role: "system_admin" | "committee" | "referee" }
  | { action: "profile"; id: string; displayName: string }
  | { action: "status"; id: string; status: "active" | "disabled" }
  | { action: "password"; id: string; password: string }
  | { action: "role"; id: string; role: "system_admin" | "committee" | "referee" }
  | { action: "delete"; id: string };

export async function updateAdminAccount(actorUsername: string, input: AccountAction) {
  const actor = await requireSystemAdmin(actorUsername);
  const db = getDb();
  const updatedAt = now();

  if (input.action === "create") {
    const username = validateUsername(input.username);
    const displayName = validateDisplayName(input.displayName);
    validatePassword(input.password);
    if (input.role === "system_admin" && !isRootSystemAdminUsername(actor.username)) {
      throw new Error("只有根系统管理员 admin 可以增加系统管理员账号。");
    }
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
    if (existing) throw new Error("该用户名已经存在。");
    const userId = id("usr");
    const passwordHash = await hash(input.password, 12);

    if (input.role === "system_admin") {
      await db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext('huacai_secondary_system_admin_limit'))`);
        const [countRow] = await tx.select({ count: sql<number>`count(*)::int` }).from(users).where(and(
          eq(users.role, "system_admin"),
          ne(users.username, ROOT_SYSTEM_ADMIN_USERNAME),
          ne(users.status, "deleted"),
        ));
        if (!hasSecondarySystemAdminCapacity(Number(countRow?.count ?? 0))) {
          throw new Error(`系统管理员账号最多只能增加${MAX_SECONDARY_SYSTEM_ADMINS}个，请先删除一个已有系统管理员账号后再创建。`);
        }
        await tx.insert(users).values({
          id: userId,
          username,
          email: null,
          displayName,
          passwordHash,
          role: "system_admin",
          status: "active",
          passwordUpdatedAt: updatedAt,
          createdAt: updatedAt,
          updatedAt,
        });
        await tx.insert(auditLogs).values({ id: id("log"), actorUserId: actor.id, moduleType: "accounts", targetType: "user", targetId: userId, action: "create_system_admin", afterJson: JSON.stringify({ username, role: input.role }), createdAt: updatedAt });
      });
    } else {
      await db.insert(users).values({
        id: userId,
        username,
        email: null,
        displayName,
        passwordHash,
        role: input.role,
        status: "active",
        passwordUpdatedAt: updatedAt,
        createdAt: updatedAt,
        updatedAt,
      });
      await db.insert(auditLogs).values({ id: id("log"), actorUserId: actor.id, moduleType: "accounts", targetType: "user", targetId: userId, action: "create_account", afterJson: JSON.stringify({ username, role: input.role }), createdAt: updatedAt });
    }
    return getAccountsForAdmin(actorUsername);
  }

  const [target] = await db.select().from(users).where(eq(users.id, input.id)).limit(1);
  if (!target || target.status === "deleted") throw new Error("没有找到该后台账号。");
  assertSystemAdminMutationAllowed(actor.username, target);

  if (input.action === "profile") {
    const displayName = validateDisplayName(input.displayName);
    await db.update(users).set({ displayName, updatedAt }).where(eq(users.id, target.id));
    await db.insert(auditLogs).values({ id: id("log"), actorUserId: actor.id, moduleType: "accounts", targetType: "user", targetId: target.id, action: "update_account", beforeJson: JSON.stringify({ displayName: target.displayName }), afterJson: JSON.stringify({ displayName }), createdAt: updatedAt });
  } else if (input.action === "status") {
    await db.update(users).set({ status: input.status, updatedAt }).where(eq(users.id, target.id));
    if (input.status === "disabled") await db.delete(adminSessions).where(eq(adminSessions.userId, target.id));
    await db.insert(auditLogs).values({ id: id("log"), actorUserId: actor.id, moduleType: "accounts", targetType: "user", targetId: target.id, action: input.status === "active" ? "enable_account" : "disable_account", createdAt: updatedAt });
  } else if (input.action === "password") {
    validatePassword(input.password);
    await db.update(users).set({ passwordHash: await hash(input.password, 12), passwordUpdatedAt: updatedAt, updatedAt }).where(eq(users.id, target.id));
    await db.delete(adminSessions).where(eq(adminSessions.userId, target.id));
    await db.insert(auditLogs).values({ id: id("log"), actorUserId: actor.id, moduleType: "accounts", targetType: "user", targetId: target.id, action: "reset_password", createdAt: updatedAt });
  } else if (input.action === "role") {
    if (input.role === "system_admin" && !isRootSystemAdminUsername(actor.username)) {
      throw new Error("只有根系统管理员 admin 可以设置系统管理员角色。");
    }
    const applyRoleChange = async (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => {
      await tx.update(users).set({ role: input.role, updatedAt }).where(eq(users.id, target.id));
      await tx.update(eventMembers).set({ role: input.role, updatedAt }).where(eq(eventMembers.userId, target.id));
      await tx.insert(auditLogs).values({ id: id("log"), actorUserId: actor.id, moduleType: "accounts", targetType: "user", targetId: target.id, action: "change_role", beforeJson: JSON.stringify({ role: target.role }), afterJson: JSON.stringify({ role: input.role }), createdAt: updatedAt });
    };
    if (input.role === "system_admin" && target.role !== "system_admin") {
      await db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext('huacai_secondary_system_admin_limit'))`);
        const [countRow] = await tx.select({ count: sql<number>`count(*)::int` }).from(users).where(and(
          eq(users.role, "system_admin"),
          ne(users.username, ROOT_SYSTEM_ADMIN_USERNAME),
          ne(users.status, "deleted"),
        ));
        if (!hasSecondarySystemAdminCapacity(Number(countRow?.count ?? 0))) {
          throw new Error(`系统管理员账号最多只能增加${MAX_SECONDARY_SYSTEM_ADMINS}个，请先删除一个已有系统管理员账号后再设置。`);
        }
        await applyRoleChange(tx);
      });
    } else {
      await db.transaction(async (tx) => applyRoleChange(tx));
    }
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
      await tx.insert(auditLogs).values({ id: id("log"), actorUserId: actor.id, moduleType: "accounts", targetType: "user", targetId: target.id, action: target.role === "system_admin" ? "delete_system_admin" : "delete_account", beforeJson: JSON.stringify({ username: target.username, displayName: target.displayName, role: target.role }), createdAt: updatedAt });
    });
  }

  return getAccountsForAdmin(actorUsername);
}
