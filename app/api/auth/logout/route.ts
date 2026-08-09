import { NextResponse } from "next/server";
import { revokeSession } from "@/db/auth";
import { clearAdminSessionCookie, readAdminSessionCookie } from "@/lib/auth/cookies";

export const dynamic = "force-dynamic";

async function performLogout() {
  const token = await readAdminSessionCookie();
  if (token && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      await revokeSession(token);
    } catch {
      // Clearing the browser cookie is the critical logout step. A transient
      // remote revoke failure must not strand the user inside the admin UI.
    }
  }
  await clearAdminSessionCookie();
}

export async function POST() {
  await performLogout();
  return Response.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(request: Request) {
  await performLogout();
  return NextResponse.redirect(new URL("/admin", request.url));
}
