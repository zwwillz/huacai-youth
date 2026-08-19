import { changeSnookerOpsPassword } from "@/lib/snooker/data-ops-auth";

export const dynamic = "force-dynamic";

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "请求来源无效。" }, { status: 403 });
  try {
    const body = await request.json() as { password?: string };
    const viewer = await changeSnookerOpsPassword(body.password || "");
    return Response.json({ ok: true, viewer }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "密码设置失败。" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
