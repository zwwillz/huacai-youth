import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getAdminViewer } from "../../admin-viewer";
import { getAdminNavigationEvents } from "@/db/admin-ui";
import { type DrawPhaseCode } from "@/db/draw-engine";
import { getCompetitionDrawWorkspaceData } from "@/db/competition-draw-workspace";
import { getMainStageWorkspaceData, isMainPhase } from "@/db/main-stage-engine";
import { getMainRosterLockStatus } from "@/db/main-roster-lock-check";
import AdminWorkspaceShell from "../../admin-workspace-shell";
import DrawWorkbenchClient from "./draw-workbench-client";
import MainStageWorkbenchClient from "./main-stage-workbench-client";
import "./draw-workbench.css";
import "./main-stage-workbench.css";

export const dynamic = "force-dynamic";

export default async function DrawWorkbenchPage({ searchParams }: { searchParams: Promise<{ event?: string; group?: string; phase?: string }> }) {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  const query = await searchParams;
  const events = await getAdminNavigationEvents(viewer.username);
  const eventId = events.some((event) => event.id === query.event) ? String(query.event) : events[0]?.id;
  if (!eventId) redirect("/admin/events");
  const phaseCode = (["qualifier-one", "qualifier-two", "main-one", "main-two"].includes(String(query.phase)) ? query.phase : "qualifier-one") as DrawPhaseCode;

  const shell = (child: ReactNode) => <AdminWorkspaceShell
    viewer={{ displayName: viewer.displayName, role: viewer.role }}
    events={events}
    active="competition"
    pageTitle="抽签与签表"
    pageHint="竞赛执行 · 抽签引擎"
    currentEventId={eventId}
    eventScoped
    competitionTool="overview"
  >{child}</AdminWorkspaceShell>;

  try {
    if (isMainPhase(phaseCode)) {
      const data = await getMainStageWorkspaceData(viewer.username, eventId, query.group, phaseCode);
      if (data.latestSession?.status === "void") data.latestSession = null;
      if (phaseCode === "main-one") {
        const lock = await getMainRosterLockStatus(eventId, data.selectedGroupId);
        if (!lock || lock.status !== "locked") {
          data.sourceReady = false;
          data.sourceNote = `${data.sourceNote} 请先在“晋级与正赛名单”中完成种子确认、递补并锁定64人名单。`;
        }
      }
      return shell(<MainStageWorkbenchClient initialData={data} />);
    }
    const data = await getCompetitionDrawWorkspaceData(viewer.username, eventId, query.group, phaseCode);
    if (data.latestSession?.status === "void") data.latestSession = null;
    return shell(<DrawWorkbenchClient initialData={data} />);
  } catch (error) {
    return shell(<main className="backend-state backend-denied"><div className="backend-state-logo">签</div><small>抽签引擎</small><h1>当前还不能开始抽签</h1><p>{error instanceof Error ? error.message : "抽签数据读取失败。"}</p><a href={`/admin/competition?event=${encodeURIComponent(eventId)}`}>返回竞赛执行</a></main>);
  }
}
