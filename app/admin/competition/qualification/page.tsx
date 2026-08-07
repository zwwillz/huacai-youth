import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminViewer } from "../../admin-viewer";
import { getAdminNavigationEvents } from "@/db/admin-ui";
import { getQualificationWorkspaceData } from "@/db/qualification-engine";
import { getMainRosterControlData } from "@/db/main-competition-flow";
import { getCompetitionContextData } from "@/db/competition-context";
import AdminWorkspaceShell from "../../admin-workspace-shell";
import CompetitionContextBar from "../competition-context-bar";
import CompetitionPublicationBar from "../competition-publication-bar";
import QualificationWorkbenchClient from "./qualification-workbench-client";
import MainRosterControlClient from "./main-roster-control-client";
import { captureAdminLoad } from "../../capture-admin-load";
import "../competition-context-bar.css";
import "./qualification.css";
import "./main-roster-control.css";

export const dynamic = "force-dynamic";
const PHASES = [
  { code: "qualifier-one", title: "资格赛第一场" },
  { code: "qualifier-two", title: "资格赛第二场" },
  { code: "main-one", title: "正赛第一阶段" },
  { code: "main-two", title: "正赛第二阶段" },
];

export default async function QualificationPage({ searchParams }: { searchParams: Promise<{ event?: string; group?: string; phase?: string }> }) {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  const query = await searchParams;
  const events = await getAdminNavigationEvents(viewer.username);
  const eventId = events.some((event) => event.id === query.event) ? String(query.event) : events[0]?.id;
  if (!eventId) redirect("/admin/competition");

  const result = await captureAdminLoad((async () => {
    const [data, context] = await Promise.all([
      getQualificationWorkspaceData(viewer.username, eventId),
      getCompetitionContextData(viewer.username, eventId),
    ]);
    const selectedGroupId = context.groups.some((group) => group.id === query.group) ? String(query.group) : context.groups[0]?.id || "";
    const groupStages = data.stages.filter((stage) => stage.groupId === selectedGroupId);
    const q1 = groupStages.find((stage) => stage.phaseCode === "qualifier-one");
    const q2 = groupStages.find((stage) => stage.phaseCode === "qualifier-two");
    const requestedPhase = PHASES.some((phase) => phase.code === query.phase) ? String(query.phase) : "";
    const qualificationDone = Boolean(q1?.confirmed && q2?.confirmed);
    const needsMainData = requestedPhase.startsWith("main-") || (!requestedPhase && qualificationDone);
    const mainRosterControl = needsMainData ? await getMainRosterControlData(viewer.username, eventId) : null;
    const rosterGroup = mainRosterControl?.groups.find((group) => group.groupId === selectedGroupId);
    const suggestedPhase = !q1 || !q1.confirmed
      ? "qualifier-one"
      : !q2 || !q2.confirmed
        ? "qualifier-two"
        : !rosterGroup?.currentLock || rosterGroup.currentLock.status !== "locked" || rosterGroup.advancement?.status !== "confirmed"
          ? "main-one"
          : "main-two";
    const selectedPhase = requestedPhase || suggestedPhase;
    const phaseOptions = PHASES.map((phase) => {
      if (phase.code.startsWith("qualifier")) {
        const stage = groupStages.find((item) => item.phaseCode === phase.code);
        return { ...phase, hint: stage ? (stage.confirmed ? "晋级已确认" : stage.readyToConfirm ? "可以确认" : `${stage.completedFinalCount}/${stage.divisionCount}区完成`) : "等待签表" };
      }
      if (!qualificationDone) return { ...phase, hint: "资格赛完成后开放" };
      if (!mainRosterControl) return { ...phase, hint: "点击进入查看" };
      if (phase.code === "main-one") return { ...phase, hint: rosterGroup?.advancement?.status === "confirmed" ? "32强已确认" : rosterGroup?.currentLock?.status === "locked" ? "64人已锁定" : `${rosterGroup?.mainRosterCount ?? 0}/64人` };
      return { ...phase, hint: rosterGroup?.advancement?.status === "confirmed" ? "等待最终比赛" : "等待32强" };
    });
    const groupName = context.groups.find((group) => group.id === selectedGroupId)?.name || "当前组别";
    const filteredQualification = { ...data, stages: groupStages.filter((stage) => stage.phaseCode === selectedPhase) };
    const filteredRoster = mainRosterControl ? { ...mainRosterControl, groups: rosterGroup ? [rosterGroup] : [] } : null;
    return { context, selectedGroupId, selectedPhase, phaseOptions, groupName, filteredQualification, filteredRoster };
  })());
  if (!result.data) {
    return <AdminWorkspaceShell viewer={{ displayName: viewer.displayName, role: viewer.role }} events={events} active="competition" pageTitle="晋级" pageHint="竞赛执行 · 当前阶段晋级确认" currentEventId={eventId} eventScoped competitionTool="qualification"><main className="backend-state backend-denied"><div className="backend-state-logo">晋</div><small>晋级</small><h1>暂时不能进入晋级工作区</h1><p>{result.error instanceof Error ? result.error.message : "竞赛名单数据读取失败。"}</p><a href="/admin/competition">返回竞赛执行</a></main></AdminWorkspaceShell>;
  }
  const { context, selectedGroupId, selectedPhase, phaseOptions, groupName, filteredQualification, filteredRoster } = result.data;
  return <AdminWorkspaceShell viewer={{ displayName: viewer.displayName, role: viewer.role }} events={events} active="competition" pageTitle="晋级" pageHint="竞赛执行 · 当前阶段晋级确认" currentEventId={eventId} eventScoped competitionTool="qualification">
      <CompetitionContextBar eventId={eventId} eventTitle={context.event.shortTitle} groups={context.groups} selectedGroupId={selectedGroupId} basePath="/admin/competition/qualification" phases={phaseOptions} selectedPhase={selectedPhase} eyebrow="晋级" title={`${groupName} · ${PHASES.find((phase) => phase.code === selectedPhase)?.title || "当前阶段"}`} description="一次只处理一个组别、一个阶段。资格赛确认24人；正赛第一阶段负责种子/递补、64人锁定和32强确认；正赛第二阶段完成后直接进入最终排名。" />
      <CompetitionPublicationBar eventId={eventId} moduleType="schedule" title="签表、晋级与赛程" status={context.publications.schedule.status} hasUnpublishedChanges={context.publications.schedule.hasUnpublishedChanges} viewerRole={viewer.role} hint="晋级、种子、递补、64人锁定或32强确认只更新后台；用户端保持上一版正式名单和签表，直到再次发布更新。" />
      {selectedPhase.startsWith("qualifier") && <QualificationWorkbenchClient initialData={filteredQualification} />}
      {selectedPhase === "main-one" && filteredRoster && <MainRosterControlClient initialData={filteredRoster} />}
      {selectedPhase === "main-two" && <section className="qualification-main-two-note"><div><small>正赛第二阶段</small><h2>本阶段不再单独确认“晋级”</h2><p>32强名单已经在正赛第一阶段确认。第二阶段按照重新抽签后的单败签表一直比赛到冠军，并包含三、四名决赛。所有比赛结果确认完成后，系统自动生成本站最终排名草稿。</p></div><div><Link href={`/admin/competition/draw?event=${encodeURIComponent(eventId)}&group=${encodeURIComponent(selectedGroupId)}&phase=main-two`}>进入正赛第二阶段抽签 / 签表</Link><Link href={`/admin/competition/final-ranking?event=${encodeURIComponent(eventId)}&group=${encodeURIComponent(selectedGroupId)}`}>查看最终排名状态</Link></div></section>}
  </AdminWorkspaceShell>;
}
