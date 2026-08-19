import { cookies } from "next/headers";

const DEFAULT_SUPABASE_URL = "https://rtlvncsmbueatdzqvhbn.supabase.co";
const DEFAULT_PUBLISHABLE_KEY = "sb_publishable_SR0NVsqpSBGBMP3xg9utvQ_jywPEUNP";
const SUPABASE_URL = process.env.SNOOKER_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const SUPABASE_KEY = process.env.SNOOKER_SUPABASE_PUBLISHABLE_KEY || DEFAULT_PUBLISHABLE_KEY;
const OPS_API_URL = `${SUPABASE_URL}/functions/v1/snooker-ops-api`;
export const SNOOKER_OPS_COOKIE = "snooker_ops_session";

type OpsError = { error?: string };

export type SnookerOpsViewer = {
  username: string;
  displayName: string;
  mustChangePassword: boolean;
};

export type SnookerOpsSessionState = SnookerOpsViewer & { authenticated: true } | { authenticated: false };

async function ops<T>(operation: string, payload: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(OPS_API_URL, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ operation, ...payload }),
    cache: "no-store",
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as OpsError;
    throw new Error(error.error || `Snooker Ops API failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

async function currentToken() {
  return (await cookies()).get(SNOOKER_OPS_COOKIE)?.value || "";
}

async function persistToken(token: string, expiresAt: string) {
  const store = await cookies();
  store.set(SNOOKER_OPS_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function getSnookerOpsViewer(): Promise<SnookerOpsViewer | null> {
  const token = await currentToken();
  if (!token) return null;
  try {
    const state = await ops<SnookerOpsSessionState>("session", { token });
    if (!state.authenticated) return null;
    return { username: state.username, displayName: state.displayName, mustChangePassword: state.mustChangePassword };
  } catch {
    return null;
  }
}

export async function loginSnookerOps(username: string, password: string, ip?: string | null, userAgent?: string | null) {
  const result = await ops<{ ok: true; token: string; expiresAt: string; viewer: SnookerOpsViewer }>("login", {
    username,
    password,
    ip: ip || null,
    userAgent: userAgent || null,
  });
  await persistToken(result.token, result.expiresAt);
  return result.viewer;
}

export async function changeSnookerOpsPassword(newPassword: string) {
  const token = await currentToken();
  if (!token) throw new Error("登录状态已失效，请重新登录。");
  const result = await ops<{ ok: true; viewer: SnookerOpsViewer }>("change-password", { token, newPassword });
  return result.viewer;
}

export async function logoutSnookerOps() {
  const store = await cookies();
  const token = store.get(SNOOKER_OPS_COOKIE)?.value || "";
  try {
    if (token) await ops("logout", { token });
  } finally {
    store.set(SNOOKER_OPS_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      expires: new Date(0),
    });
  }
}

export async function loadSnookerOpsSnapshot<T>() {
  const token = await currentToken();
  if (!token) throw new Error("UNAUTHORIZED");
  return ops<T>("snapshot", { token });
}

export async function runSnookerOpsAction<T>(action: string, payload: Record<string, unknown> = {}) {
  const token = await currentToken();
  if (!token) throw new Error("UNAUTHORIZED");
  return ops<T>("action", { token, action, payload });
}
