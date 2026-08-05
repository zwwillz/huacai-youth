import { compare, hash } from "bcryptjs";
import { and, count, eq, gt } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { bootstrapSystemAdmin } from "./admin";
import { getDb } from "./index";
import { adminSessions, users } from "./schema";

export const ADMIN_SESSION_COOKIE = "huacai_admin_session";
const SESSION_DAYS = 7;

function now() {
  return new Date().toISOString();
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function validatePassword(password: string) {
  if (password.length < 8 || password.length > 72) throw new Error("密码需为8至72个字符。");
}

async function createSession(userId: string, ipAddress?: string | null, userAgent?: string | null) {
  const db = getDb();
  const token = randomBytes(32).toString("base64url");
  const createdAt = now();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await db.insert(adminSessions).values({
    id: "ses_" + crypto.randomUUID().replaceAll("-", ""),
    userId,
    tokenHash: tokenHash(token),
    expiresAt,
    lastSeenAt: createdAt,
    ipAddress: ipAddress || null,
    userAgent: userAgent?.slice(0, 500) || null,
    createdAt,
  });
  return { token, expiresAt };
}

export async function isInitialSetupAvailable() {
  const db = getDb();
  const [{ total }] = await db.select({ total: count() }).from(users);
  return Number(total) === 0;
}

export async function setupInitialAdmin(password: string, ipAddress?: string | null, userAgent?: string | null) {
  validatePassword(password);
  if (!(await isInitialSetupAvailable())) throw new Error("系统管理员已经设置完成，请直接登录。");
  const passwordHash = await hash(password, 12);
  await bootstrapSystemAdmin("admin", "系统管理员", passwordHash);
  const db = getDb();
  const [account] = await db.select().from(users).where(eq(users.username, "admin")).limit(1);
  if (!account) throw new Error("系统管理员创建失败。");
  return createSession(account.id, ipAddress, userAgent);
}

export async function loginWithPassword(username: string, password: string, ipAddress?: string | null, userAgent?: string | null) {
  const normalized = username.trim().toLowerCase();
  if (!normalized || !password) throw new Error("请输入用户名和密码。");
  const db = getDb();
  const [account] = await db.select().from(users).where(and(eq(users.username, normalized), eq(users.status, "active"))).limit(1);
  if (!account || !(await compare(password, account.passwordHash))) throw new Error("用户名或密码不正确。");
  const loginAt = now();
  await db.update(users).set({ lastLoginAt: loginAt, updatedAt: loginAt }).where(eq(users.id, account.id));
  return createSession(account.id, ipAddress, userAgent);
}

export async function getViewerBySessionToken(token: string) {
  const db = getDb();
  const [row] = await db.select({
    id: users.id,
    username: users.username,
    displayName: users.displayName,
    role: users.role,
    status: users.status,
  }).from(adminSessions)
    .innerJoin(users, eq(adminSessions.userId, users.id))
    .where(and(eq(adminSessions.tokenHash, tokenHash(token)), gt(adminSessions.expiresAt, now()), eq(users.status, "active")))
    .limit(1);
  return row ?? null;
}

export async function revokeSession(token: string) {
  const db = getDb();
  await db.delete(adminSessions).where(eq(adminSessions.tokenHash, tokenHash(token)));
}
