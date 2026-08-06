import { redirect } from "next/navigation";
import { getNewEventDefaults } from "@/db/admin-index";
import { getAdminViewer } from "../../admin-viewer";
import AdminWorkspaceShell from "../../admin-workspace-shell";
import NewEventClient from "./new-event-client";
import "./new-event.css";

export const dynamic = "force-dynamic";

export default async function NewEventPage() {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  if (!["system_admin", "committee"].includes(viewer.role)) redirect("/admin");
  const { navEvents, latestYear, nextStationNo } = await getNewEventDefaults(viewer.username);

  return <AdminWorkspaceShell viewer={{ displayName: viewer.displayName, role: viewer.role }} events={navEvents} active="events" pageTitle="创建新赛事" pageHint="赛事管理 · 全局">
    <NewEventClient defaultYear={latestYear} defaultStationNo={nextStationNo} />
  </AdminWorkspaceShell>;
}
