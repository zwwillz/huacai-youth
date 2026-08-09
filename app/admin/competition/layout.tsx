import { redirect } from "next/navigation";
import { getAdminViewer } from "../admin-viewer";

export default async function CompetitionLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  if (!["system_admin", "referee"].includes(viewer.role)) redirect("/admin");
  return <>{children}</>;
}
