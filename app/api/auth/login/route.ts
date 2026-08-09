import { LoginRateLimitError, loginWithPassword } from "@/db/auth";
import { setAdminSessionCookie } from "@/lib/auth/cookies";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const startedAt = performance.now();
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: "后台数据库 HTTPS 连接尚未配置。" }, { status: 503 });
  }
  try {
    const body = await request.json() as { username?: string; password?: string };
    const session = await loginWithPassword(body.username || "", body.password || "", request.headers.get("x-forwarded-for"), request.headers.get("user-agent"));
    await setAdminSessionCookie(session.token, session.expiresAt);
    return Response.json({ ok: true }, {
      headers: { "Server-Timing": `app;dur=${(performance.now() - startedAt).toFixed(1)}` },
    });
  } catch (error) {
    const status = error instanceof LoginRateLimitError ? 429 : 401;
    return Response.json({ error: error instanceof Error ? error.message : "登录失败。" }, {
      status,
      headers: { "Server-Timing": `app;dur=${(performance.now() - startedAt).toFixed(1)}` },
    });
  }
}
