import { redirect } from "next/navigation";
import AdminApp from "./admin-app";
import AdminDashboardBridge from "./admin-dashboard-bridge";
import { getAdminViewer } from "./admin-viewer";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  return <>
    <AdminApp viewer={{ username: viewer.username, displayName: viewer.displayName }} />
    <AdminDashboardBridge />
  </>;
}
