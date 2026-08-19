import { cookies } from "next/headers";

const DEFAULT_SUPABASE_URL = "https://rtlvncsmbueatdzqvhbn.supabase.co";
const DEFAULT_PUBLISHABLE_KEY = "sb_publishable_SR0NVsqpSBGBMP3xg9utvQ_jywPEUNP";
const SUPABASE_URL = process.env.SNOOKER_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const SUPABASE_KEY = process.env.SNOOKER_SUPABASE_PUBLISHABLE_KEY || DEFAULT_PUBLISHABLE_KEY;
const RPC_URL = `${SUPABASE_URL}/rest/v1/rpc`;
export const SNOOKER_OPS_COOKIE = "snooker_ops_session";

type RpcError = { message?: string; details?: string; hint?: string; code?: string };

export type SnookerOpsViewer = {
  username: string;
  displayName: string;
  mustChangePassword: boolean;
};

export type SnookerOpsSessionState = SnookerOpsViewer & { authenticated: true } | { authenticated: false };

async function rpc<T>(name: string, payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${RPC_URL}/${name}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as RpcError;
    throw new Error(error.message || `Snooker Ops RPC ${name} failed (${response.status})`);
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
    const state = await rpc<SnookerOpsSessionState>("snooker_ops_session", { p_token: token });
    if (!state.authenticated) return null;
    return { username: state.username, displayName: state.displayName, mustChangePassword: state.mustChangePassword };
  } catch {
    return null;
  }
}

export async function loginSnookerOps(username: string, password: string, ip?: string | null, userAgent?: string | null) {
  const result = await rpc<{ ok: true; token: string; expiresAt: string; viewer: SnookerOpsViewer }>("snooker_ops_login", {
    p_username: username,
    p_password: password,
    p_ip: ip || null,
    p_user_agent: userAgent || null,
  });
  await persistToken(result.token, result.expiresAt);
  return result.viewer;
}

export async function changeSnookerOpsPassword(newPassword: string) {
  const token = await currentToken();
  if (!token) throw new Error("登录状态已失效，请重新登录。");
  const result = await rpc<{ ok: true; viewer: SnookerOpsViewer }>("snooker_ops_change_password", {
    p_token: token,
    p_new_password: newPassword,
  });
  return result.viewer;
}

export async function logoutSnookerOps() {
  const store = await cookies();
  const token = store.get(SNOOKER_OPS_COOKIE)?.value || "";
  try {
    if (token) await rpc("snooker_ops_logout", { p_token: token });
  } finally {
    store.delete(SNOOKER_OPS_COOKIE);
  }
}

export async function loadSnookerOpsSnapshot<T>() {
  const token = await currentToken();
  if (!token) throw new Error("UNAUTHORIZED");
  return rpc<T>("snooker_ops_snapshot", { p_token: token });
}

export async function runSnookerOpsAction<T>(action: string, payload: Record<string, unknown> = {}) {
  const token = await currentToken();
  if (!token) throw new Error("UNAUTHORIZED");
  return rpc<T>("snooker_ops_run_action", { p_token: token, p_action: action, p_payload: payload });
}
