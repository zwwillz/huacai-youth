import { redirect } from "next/navigation";
import { getAdminViewer } from "../../admin-viewer";
import { getAdminNavigationEvents } from "@/db/admin-ui";
import { getDrawSessionDetail } from "@/db/draw-engine";
import { getBracketDetail } from "@/db/bracket-engine";
import AdminWorkspaceShell from "../../admin-workspace-shell";
import BracketWorkbenchClient from "./bracket-workbench-client";
import "./bracket-workbench.css";

export const dynamic = "force-dynamic";

export default async function BracketWorkbenchPage({ searchParams }: { searchParams: Promise<{ session?: string; event?: string }> }) {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  const query = await searchParams;
  const sessionId = String(query.session || "");
  if (!sessionId) redirect("/admin/competition");
  const events = await getAdminNavigationEvents(viewer.username);

  try {
    const [draw, bracket] = await Promise.all([
      getDrawSessionDetail(viewer.username, sessionId),
      getBracketDetail(viewer.username, sessionId, true),
    ]);
    const eventId = draw.session.eventId;
    return <AdminWorkspaceShell
      viewer={{ displayName: viewer.displayName, role: viewer.role }}
      events={events}
      active="competition"
      pageTitle="完整分区签表"
      pageHint="竞赛执行 · 比赛关系"
      currentEventId={eventId}
      eventScoped
    >
      <BracketWorkbenchClient draw={draw} initialBracket={bracket} />
    </AdminWorkspaceShell>;
  } catch (error) {
    const eventId = events.some((event) => event.id === query.event) ? String(query.event) : events[0]?.id;
    return <AdminWorkspaceShell
      viewer={{ displayName: viewer.displayName, role: viewer.role }}
      events={events}
      active="competition"
      pageTitle="完整分区签表"
      pageHint="竞赛执行 · 比赛关系"
      currentEventId={eventId}
      eventScoped
    >
      <main className="backend-state backend-denied"><div className="backend-state-logo">表</div><small>比赛关系</small><h1>暂时不能打开完整签表</h1><p>{error instanceof Error ? error.message : "签表读取失败。"}</p><a href="/admin/competition">返回竞赛执行</a></main>
    </AdminWorkspaceShell>;
  }
}
