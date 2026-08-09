import { NextResponse } from "next/server";
import { revokeSession } from "@/db/auth";
import { clearAdminSessionCookie, readAdminSessionCookie } from "@/lib/auth/cookies";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = await readAdminSessionCookie();
  if (token && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      await revokeSession(token);
    } catch {
      // Clearing the browser cookie is the critical logout step. If the remote
      // session revoke has a transient failure, do not strand the user inside admin.
    }
  }
  await clearAdminSessionCookie();
  // `/admin` is also the structure-first welcome/login entry when no session exists.
  return NextResponse.redirect(new URL("/admin", request.url));
}
