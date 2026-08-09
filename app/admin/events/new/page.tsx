import { redirect } from "next/navigation";
import { getAdminViewer } from "../../admin-viewer";
import NewEventClient from "./new-event-client";
import "../event-management-v2.css";

export const dynamic = "force-dynamic";

export default async function NewEventPage() {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  if (!["system_admin", "committee"].includes(viewer.role)) redirect("/admin");

  const currentYear = new Date().getFullYear();
  return <NewEventClient initialYear={currentYear} />;
}
