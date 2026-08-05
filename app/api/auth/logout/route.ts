import { NextResponse } from "next/server";
import { revokeSession } from "@/db/auth";
import { clearAdminSessionCookie, readAdminSessionCookie } from "@/lib/auth/cookies";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = await readAdminSessionCookie();
  if (token && process.env.DATABASE_URL) await revokeSession(token);
  await clearAdminSessionCookie();
  return NextResponse.redirect(new URL("/admin/login", request.url));
}
