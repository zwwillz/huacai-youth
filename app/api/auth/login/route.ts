import { LoginRateLimitError, loginWithPassword } from "@/db/auth";
import { setAdminSessionCookie } from "@/lib/auth/cookies";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) return Response.json({ error: "后台数据库尚未配置。" }, { status: 503 });
  try {
    const body = await request.json() as { username?: string; password?: string };
    const session = await loginWithPassword(body.username || "", body.password || "", request.headers.get("x-forwarded-for"), request.headers.get("user-agent"));
    await setAdminSessionCookie(session.token, session.expiresAt);
    return Response.json({ ok: true });
  } catch (error) {
    const status = error instanceof LoginRateLimitError ? 429 : 401;
    return Response.json({ error: error instanceof Error ? error.message : "登录失败。" }, { status });
  }
}
