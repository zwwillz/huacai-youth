import { setupInitialAdmin } from "@/db/auth";
import { setAdminSessionCookie } from "@/lib/auth/cookies";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) return Response.json({ error: "后台数据库尚未配置。" }, { status: 503 });
  try {
    const body = await request.json() as { username?: string; password?: string };
    if (body.username !== "admin") throw new Error("首次系统管理员用户名固定为admin。");
    const session = await setupInitialAdmin(body.password || "", request.headers.get("x-forwarded-for"), request.headers.get("user-agent"));
    await setAdminSessionCookie(session.token, session.expiresAt);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "管理员设置失败。" }, { status: 400 });
  }
}
