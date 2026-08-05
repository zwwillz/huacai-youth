import { headers } from "next/headers";
import { getChatGPTUser } from "../chatgpt-auth";

export async function getAdminViewer() {
  const viewer = await getChatGPTUser();
  if (viewer) return viewer;

  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "";
  if (process.env.NODE_ENV === "development" && host.startsWith("terminal.local")) {
    return {
      displayName: "后台预览账号",
      email: "preview-admin@local.invalid",
      fullName: "后台预览账号",
    };
  }
  return null;
}
