import { logoutSnookerOps } from "@/lib/snooker/data-ops-auth";

export const dynamic = "force-dynamic";

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "请求来源无效。" }, { status: 403 });
  await logoutSnookerOps();
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
