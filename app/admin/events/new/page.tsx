import { redirect } from "next/navigation";
import { getAdminViewer } from "../../admin-viewer";
import NewEventClient from "./new-event-client";
import "./new-event.css";

export const dynamic = "force-dynamic";

export default async function NewEventPage() {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  if (!["system_admin", "committee"].includes(viewer.role)) redirect("/admin");

  // Structure first: the complete form is renderable without database data.
  // Year/station are only suggestions and are filled progressively after paint.
  const currentYear = new Date().getFullYear();
  return <NewEventClient initialYear={currentYear} />;
}
