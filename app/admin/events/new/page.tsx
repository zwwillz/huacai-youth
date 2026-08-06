import { redirect } from "next/navigation";
import { getAdminSnapshot } from "@/db/admin";
import { getAdminViewer } from "../../admin-viewer";
import AdminWorkspaceShell from "../../admin-workspace-shell";
import NewEventClient from "./new-event-client";
import "./new-event.css";

export const dynamic = "force-dynamic";

export default async function NewEventPage() {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  if (!["system_admin", "committee"].includes(viewer.role)) redirect("/admin");
  const snapshot = await getAdminSnapshot(viewer.username);
  const events = snapshot.events.map((event) => ({ id: event.id, shortTitle: event.shortTitle, stationNo: event.stationNo, status: event.status, startDate: event.startDate, endDate: event.endDate }));
  const latestYear = Math.max(new Date().getFullYear(), ...snapshot.events.map((event) => Number(event.year) || 0));
  const maxStation = snapshot.events.filter((event) => Number(event.year) === latestYear).reduce((max, event) => Math.max(max, Number(event.stationNo) || 0), 0);

  return <AdminWorkspaceShell viewer={{ displayName: viewer.displayName, role: viewer.role }} events={events} active="events" pageTitle="创建新赛事" pageHint="赛事管理 · 全局">
    <NewEventClient defaultYear={latestYear} defaultStationNo={maxStation + 1} />
  </AdminWorkspaceShell>;
}
