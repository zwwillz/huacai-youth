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

type SessionDraft = { id: string; token: string; tokenHash: string; createdAt: string; expiresAt: string };

function createSessionDraft(): SessionDraft {
  const token = randomBytes(32).toString("base64url");
  const createdAt = now();
  return {
    id: "ses_" + crypto.randomUUID().replaceAll("-", ""),
    token,
    tokenHash: tokenHash(token),
    createdAt,
    expiresAt: new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString(),
  };
}

async function createSession(userId: string, ipAddress?: string | null, userAgent?: string | null) {
  const db = getDb();
  const session = createSessionDraft();
  await db.insert(adminSessions).values({
    id: session.id,
    userId,
    tokenHash: session.tokenHash,
    expiresAt: session.expiresAt,
    lastSeenAt: session.createdAt,
    ipAddress: ipAddress || null,
    userAgent: userAgent?.slice(0, 500) || null,
    createdAt: session.createdAt,
  });
  return { token: session.token, expiresAt: session.expiresAt };
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

type LoginCandidate = {
  usernameFailures: number;
  ipFailures: number;
  id: string | null;
  passwordHash: string | null;
};

async function getLoginCandidate(usernameKey: string, ipAddress: string | null): Promise<LoginCandidate> {
  const sql = getSqlClient();
  const since = new Date(Date.now() - LOGIN_WINDOW_MS).toISOString();
  const rows = await sql<LoginCandidate[]>`
    with limits as (
      select
        count(*) filter (where username_key=${usernameKey} and success=false)::int as "usernameFailures",
        count(*) filter (where ${ipAddress}::text is not null and ip_address=${ipAddress} and success=false)::int as "ipFailures"
      from public.admin_login_attempts
      where attempted_at >= ${since}
        and (username_key=${usernameKey} or (${ipAddress}::text is not null and ip_address=${ipAddress}))
    ), candidate as (
      select id,password_hash as "passwordHash"
      from public.users
      where username=${usernameKey} and status='active'
      limit 1
    )
    select limits."usernameFailures",limits."ipFailures",candidate.id,candidate."passwordHash"
    from limits
    left join candidate on true
  `;
  return rows[0] ?? { usernameFailures: 0, ipFailures: 0, id: null, passwordHash: null };
}

async function persistSuccessfulLogin(
  userId: string,
  usernameKey: string,
  ipAddress: string | null,
  userAgent: string | null | undefined,
) {
  const sql = getSqlClient();
  const loginAt = now();
  const attemptId = "login_" + crypto.randomUUID().replaceAll("-", "");
  const session = createSessionDraft();
  await sql`
    with updated_user as (
      update public.users
      set last_login_at=${loginAt},updated_at=${loginAt}
      where id=${userId}
      returning id
    ), logged_attempt as (
      insert into public.admin_login_attempts (id,username_key,ip_address,user_agent,success,attempted_at)
      values (${attemptId},${usernameKey},${ipAddress},${userAgent?.slice(0, 500) || null},true,${loginAt})
      returning id
    )
    insert into public.admin_sessions (id,user_id,token_hash,expires_at,last_seen_at,ip_address,user_agent,created_at)
    values (${session.id},${userId},${session.tokenHash},${session.expiresAt},${session.createdAt},${ipAddress},${userAgent?.slice(0, 500) || null},${session.createdAt})
  `;
  return { token: session.token, expiresAt: session.expiresAt };
}

export async function loginWithPassword(username: string, password: string, ipAddress?: string | null, userAgent?: string | null) {
  const normalized = username.trim().toLowerCase();
  if (!normalized || !password) throw new Error("请输入用户名和密码。");
  const clientIp = normalizeIp(ipAddress);
  const candidate = await getLoginCandidate(normalized, clientIp);
  if (candidate.usernameFailures >= USERNAME_FAILURE_LIMIT || candidate.ipFailures >= IP_FAILURE_LIMIT) throw new LoginRateLimitError();

  if (!candidate.id || !candidate.passwordHash || !(await compare(password, candidate.passwordHash))) {
    await recordLoginAttempt(normalized, clientIp, userAgent, false);
    throw new Error("用户名或密码不正确。");
  }

  return persistSuccessfulLogin(candidate.id, normalized, clientIp, userAgent);
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
