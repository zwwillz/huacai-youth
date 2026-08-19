import { loginSnookerOps } from "@/lib/snooker/data-ops-auth";

export const dynamic = "force-dynamic";

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "请求来源无效。" }, { status: 403 });
  try {
    const body = await request.json() as { username?: string; password?: string };
    const viewer = await loginSnookerOps(
      body.username || "",
      body.password || "",
      request.headers.get("x-forwarded-for"),
      request.headers.get("user-agent"),
    );
    return Response.json({ ok: true, viewer }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "登录失败。";
    const status = message.includes("次数过多") ? 429 : 401;
    return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
