import { redirect } from "next/navigation";
import { getAdminViewer } from "../admin-viewer";

export default async function ContentManagementLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  if (!["system_admin", "committee"].includes(viewer.role)) redirect("/admin");
  return <>{children}</>;
}
