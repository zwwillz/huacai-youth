import { compare, hash } from "bcryptjs";
import { and, count, eq, gt } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { bootstrapSystemAdmin } from "./admin";
import { getDb, getSqlClient } from "./index";
import { adminSessions, users } from "./schema";

export const ADMIN_SESSION_COOKIE = "huacai_admin_session";
const SESSION_DAYS = 7;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const USERNAME_FAILURE_LIMIT = 5;
const IP_FAILURE_LIMIT = 20;

export class LoginRateLimitError extends Error {
  constructor() {
    super("登录尝试次数过多，请15分钟后再试。");
    this.name = "LoginRateLimitError";
  }
}

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

function normalizeIp(value?: string | null) {
  return value?.split(",")[0]?.trim().slice(0, 120) || null;
}

async function recordLoginAttempt(usernameKey: string, ipAddress: string | null, userAgent: string | null | undefined, success: boolean) {
  const sql = getSqlClient();
  await sql`
    insert into public.admin_login_attempts (id,username_key,ip_address,user_agent,success,attempted_at)
    values (${"login_" + crypto.randomUUID().replaceAll("-", "")},${usernameKey},${ipAddress},${userAgent?.slice(0, 500) || null},${success},${now()})
  `;
}

async function assertLoginRateLimit(usernameKey: string, ipAddress: string | null) {
  const sql = getSqlClient();
  const since = new Date(Date.now() - LOGIN_WINDOW_MS).toISOString();
  const rows = await sql<Array<{ usernameFailures: number; ipFailures: number }>>`
    select
      count(*) filter (where username_key=${usernameKey} and success=false)::int as "usernameFailures",
      count(*) filter (where ${ipAddress}::text is not null and ip_address=${ipAddress} and success=false)::int as "ipFailures"
    from public.admin_login_attempts
    where attempted_at >= ${since}
      and (username_key=${usernameKey} or (${ipAddress}::text is not null and ip_address=${ipAddress}))
  `;
  const counts = rows[0] ?? { usernameFailures: 0, ipFailures: 0 };
  if (counts.usernameFailures >= USERNAME_FAILURE_LIMIT || counts.ipFailures >= IP_FAILURE_LIMIT) throw new LoginRateLimitError();
}

export async function loginWithPassword(username: string, password: string, ipAddress?: string | null, userAgent?: string | null) {
  const normalized = username.trim().toLowerCase();
  if (!normalized || !password) throw new Error("请输入用户名和密码。");
  const clientIp = normalizeIp(ipAddress);
  await assertLoginRateLimit(normalized, clientIp);
  const db = getDb();
  const [account] = await db.select().from(users).where(and(eq(users.username, normalized), eq(users.status, "active"))).limit(1);
  if (!account || !(await compare(password, account.passwordHash))) {
    await recordLoginAttempt(normalized, clientIp, userAgent, false);
    throw new Error("用户名或密码不正确。");
  }
  const loginAt = now();
  await Promise.all([
    db.update(users).set({ lastLoginAt: loginAt, updatedAt: loginAt }).where(eq(users.id, account.id)),
    recordLoginAttempt(normalized, clientIp, userAgent, true),
  ]);
  return createSession(account.id, clientIp, userAgent);
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
