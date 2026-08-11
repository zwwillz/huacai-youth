import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getAdminViewer } from "../../admin-viewer";
import { getAdminNavigationEventsForPrincipal } from "@/db/admin-principal-ui";
import { type DrawPhaseCode } from "@/db/draw-engine";
import { getCompetitionDrawWorkspaceData } from "@/db/competition-draw-workspace";
import { getMainStageWorkspaceData, isMainPhase } from "@/db/main-stage-engine";
import { getMainRosterLockStatus } from "@/db/main-roster-lock-check";
import { getParticipantRosterGate } from "@/db/participant-roster";
import { getCompetitionContextData } from "@/db/competition-context";
import AdminWorkspaceShell from "../../admin-workspace-shell";
import CompetitionContextBar from "../competition-context-bar";
import CompetitionPublicationBar from "../competition-publication-bar";
import DrawWorkbenchClient from "./draw-workbench-client";
import MainStageWorkbenchClient from "./main-stage-workbench-client";
import { captureAdminLoad } from "../../capture-admin-load";
import "../competition-context-bar.css";
import "./draw-workbench.css";
import "./main-stage-workbench.css";

export const dynamic = "force-dynamic";
const PHASES = [
  { code: "qualifier-one", title: "资格赛第一场", hint: "一次抽签到底" },
  { code: "qualifier-two", title: "资格赛第二场", hint: "未晋级球员重抽" },
  { code: "main-one", title: "正赛第一阶段", hint: "64人 · 8组双败" },
  { code: "main-two", title: "正赛第二阶段", hint: "32强重新抽签" },
];

export default async function DrawWorkbenchPage({ searchParams }: { searchParams: Promise<{ event?: string; group?: string; phase?: string }> }) {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  const query = await searchParams;
  const events = await getAdminNavigationEventsForPrincipal(viewer);
  const eventId = events.some((event) => event.id === query.event) ? String(query.event) : events[0]?.id;
  if (!eventId) redirect("/admin/competition");
  const phaseCode = (["qualifier-one", "qualifier-two", "main-one", "main-two"].includes(String(query.phase)) ? query.phase : "qualifier-one") as DrawPhaseCode;
  const context = await getCompetitionContextData(viewer, eventId);

  const shell = (child: ReactNode, groupId: string, phaseTitle: string) => <AdminWorkspaceShell viewer={{ displayName: viewer.displayName, role: viewer.role }} events={events} active="competition" pageTitle="抽签与签表" pageHint="竞赛执行 · 当前组别与阶段" currentEventId={eventId} eventScoped competitionTool="overview">
    <CompetitionContextBar eventId={eventId} eventTitle={context.event.shortTitle} groups={context.groups} selectedGroupId={groupId} basePath="/admin/competition/draw" phases={PHASES} selectedPhase={phaseCode} eyebrow="抽签与签表" title={`${context.groups.find((group) => group.id === groupId)?.name || "当前组别"} · ${phaseTitle}`} description="抽签草稿只保存在后台；用户端始终保持上一版正式签表，直到再次点击发布更新。四个阶段使用同一套组别、阶段切换逻辑。" />
    <CompetitionPublicationBar eventId={eventId} moduleType="schedule" title="签表与赛程" status={context.publications.schedule.status} hasUnpublishedChanges={context.publications.schedule.hasUnpublishedChanges} viewerRole={viewer.role} hint="抽签、重抽或赛程调整只更新后台草稿；已发布的用户端继续保持上一版，确认无误后再发布更新。" />
    <div className="unified-competition-context">{child}</div>
  </AdminWorkspaceShell>;

  const selectedGroupId = context.groups.some((group) => group.id === query.group) ? String(query.group) : context.groups[0]?.id || "";
  const phaseTitle = PHASES.find((phase) => phase.code === phaseCode)?.title || "当前阶段";
  if (!selectedGroupId) return shell(<main className="backend-state backend-denied"><div className="backend-state-logo">签</div><small>抽签引擎</small><h1>当前还不能开始抽签</h1><p>当前赛事还没有可用参赛组别，请等待组委会完成赛事基础设置。</p></main>, "", phaseTitle);

  if (!isMainPhase(phaseCode)) {
    const rosterGate = await getParticipantRosterGate(eventId, selectedGroupId);
    if (!rosterGate.locked) {
      const refereeBlocked = viewer.role === "referee";
      const note = refereeBlocked
        ? `${rosterGate.name}正式参赛名单尚未完成确认和锁定，请等待组委会处理；完成后即可继续竞赛执行。`
        : rosterGate.status === "confirmed"
          ? `${rosterGate.name}正式参赛名单已经确认，但尚未锁定。锁定后才能开始资格赛抽签。`
          : rosterGate.status === "locked"
            ? `${rosterGate.name}锁定人数与当前审核通过人数不一致，请先处理参赛名单异常。`
            : `${rosterGate.name}正式参赛名单尚未确认和锁定，请先完成报名审核与名单确认。`;
      return shell(<main className="backend-state backend-denied"><div className="backend-state-logo">锁</div><small>参赛名单前置检查</small><h1>当前还不能开始抽签</h1><p>{note}</p>{!refereeBlocked && <a href={`/admin/participants?event=${encodeURIComponent(eventId)}&group=${encodeURIComponent(selectedGroupId)}`}>前往参赛人员</a>}</main>, selectedGroupId, phaseTitle);
    }
  }

  const result = await captureAdminLoad((async () => {
    if (isMainPhase(phaseCode)) {
      const data = await getMainStageWorkspaceData(viewer.username, eventId, query.group, phaseCode);
      if (data.latestSession?.status === "void") data.latestSession = null;
      if (phaseCode === "main-one") {
        const lock = await getMainRosterLockStatus(eventId, data.selectedGroupId);
        if (!lock || lock.status !== "locked") {
          data.sourceReady = false;
          data.sourceNote = `${data.sourceNote} 请先在“晋级”中完成种子确认、递补并锁定64人名单。`;
        }
      }
      return { kind: "main" as const, data };
    }
    const data = await getCompetitionDrawWorkspaceData(viewer.username, eventId, query.group, phaseCode);
    if (data.latestSession?.status === "void") data.latestSession = null;
    return { kind: "qualifier" as const, data };
  })());
  if (!result.data) {
    return shell(<main className="backend-state backend-denied"><div className="backend-state-logo">签</div><small>抽签引擎</small><h1>当前还不能开始抽签</h1><p>{result.error instanceof Error ? result.error.message : "抽签数据读取失败。"}</p><a href={`/admin/competition?event=${encodeURIComponent(eventId)}`}>返回竞赛执行</a></main>, selectedGroupId, phaseTitle);
  }
  if (result.data.kind === "main") {
    const data = result.data.data;
    return shell(<MainStageWorkbenchClient initialData={data} />, data.selectedGroupId, data.phaseTitle);
  }
  const data = result.data.data;
  return shell(<DrawWorkbenchClient initialData={data} />, data.selectedGroupId, data.phaseTitle);
}
