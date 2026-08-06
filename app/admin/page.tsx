import Link from "next/link";
import { redirect } from "next/navigation";
import AdminApp from "./admin-app";
import { getAdminViewer } from "./admin-viewer";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");

  return <>
    <AdminApp viewer={{ username: viewer.username, displayName: viewer.displayName }} />
    {["system_admin", "committee"].includes(viewer.role) && <Link href="/admin/events" style={{ position: "fixed", right: 18, bottom: 18, zIndex: 90, padding: "11px 15px", borderRadius: 12, color: "#fff", background: "linear-gradient(135deg,#6732ce,#d9469b)", boxShadow: "0 14px 34px #35166a38", textDecoration: "none", fontSize: 11, fontWeight: 800 }}>完整赛事设置</Link>}
  </>;
}
