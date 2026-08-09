import { cache } from "react";
import { getViewerBySessionToken } from "@/db/auth";
import { readAdminSessionCookie } from "@/lib/auth/cookies";

export const getAdminViewer = cache(async () => {
  const token = await readAdminSessionCookie();
  if (!token || !process.env.DATABASE_URL) return null;
  return getViewerBySessionToken(token);
});
