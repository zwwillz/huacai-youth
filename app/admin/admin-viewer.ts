import { getViewerBySessionToken } from "@/db/auth";
import { readAdminSessionCookie } from "@/lib/auth/cookies";

export async function getAdminViewer() {
  const token = await readAdminSessionCookie();
  if (!token || !process.env.DATABASE_URL) return null;
  return getViewerBySessionToken(token);
}
