import { redirect } from "next/navigation";
import { getAdminNavigationEventsForPrincipal } from "@/db/admin-principal-ui";
import { getRegistrationPublishData } from "@/db/registration-publishing";
import AdminWorkspaceShell from "../admin-workspace-shell";
import { getAdminViewer } from "../admin-viewer";
import RegistrationPublishClient from "./registration-publish-client";
import "./registration-publish.css";

export const dynamic = "force-dynamic";

export default async function RegistrationPublishPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  if (!["system_admin", "committee"].includes(viewer.role)) redirect("/admin");

  const query = await searchParams;
  const events = await getAdminNavigationEventsForPrincipal(viewer);
  const currentEventId = events.some((event) => event.id === query.event) ? String(query.event) : events[0]?.id || "";

  if (!currentEventId) {
    return <AdminWorkspaceShell viewer={{ displayName: viewer.displayName, role: viewer.role }} events={events} active="registrationPublish" pageTitle="报名发布" pageHint="赛事运营 · 报名信息与入口" eventScoped>
      <main className="backend-state"><div className="backend-state-logo">报</div><small>报名发布</small><h1>还没有可以维护的赛事</h1><p>请先在“赛事管理”中创建赛事。</p></main>
    </AdminWorkspaceShell>;
  }

  const data = await getRegistrationPublishData(viewer, currentEventId);
  return <AdminWorkspaceShell
    viewer={{ displayName: viewer.displayName, role: viewer.role }}
    events={events}
    active="registrationPublish"
    pageTitle="报名发布"
    pageHint="赛事运营 · 报名信息与入口"
    currentEventId={currentEventId}
    eventScoped
  >
    <RegistrationPublishClient key={currentEventId} currentEventId={currentEventId} initialData={data} />
  </AdminWorkspaceShell>;
}
