import { redirect } from "next/navigation";
import { getAdminViewer } from "../admin-viewer";
import LoginScreen from "./login-screen";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  // With no session cookie getAdminViewer() returns immediately and performs no DB read.
  // A valid existing session still redirects straight back into the workspace.
  if (await getAdminViewer()) redirect("/admin");
  return <LoginScreen />;
}
