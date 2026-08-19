import { runSnookerOpsAction } from "@/lib/snooker/data-ops-auth";

export const dynamic = "force-dynamic";

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}

const ALLOWED_ACTIONS = new Set([
  "analytics_refresh_current",
  "analytics_audit",
  "analytics_rebuild_season",
  "analytics_rebuild_career",
  "analytics_rebuild_h2h",
  "live_sync",
  "upcoming_sync",
  "event_sync",
]);

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "请求来源无效。" }, { status: 403 });
  try {
    const body = await request.json() as { action?: string; payload?: Record<string, unknown> };
    if (!body.action || !ALLOWED_ACTIONS.has(body.action)) return Response.json({ error: "不支持的运维操作。" }, { status: 400 });
    const result = await runSnookerOpsAction(body.action, body.payload || {});
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "运维操作执行失败。";
    const status = message.includes("UNAUTHORIZED") ? 401 : message.includes("PASSWORD_CHANGE_REQUIRED") ? 428 : 400;
    return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
