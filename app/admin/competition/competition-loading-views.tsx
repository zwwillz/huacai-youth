"use client";

import Link from "next/link";
import type { DrawWorkspaceData } from "@/db/draw-engine";
import type { QualificationWorkspaceData } from "@/db/qualification-engine";
import type { MainRosterControlData } from "@/db/main-competition-flow";
import type { FinalRankingWorkspaceData } from "@/db/final-ranking-engine";
import CompetitionContextBar from "./competition-context-bar";
import CompetitionPublicationBar from "./competition-publication-bar";
import DrawWorkbenchClient from "./draw/draw-workbench-client";
import MainStageWorkbenchClient from "./draw/main-stage-workbench-client";
import QualificationWorkbenchClient from "./qualification/qualification-workbench-client";
import MainRosterControlClient from "./qualification/main-roster-control-client";
import FinalRankingClient from "./final-ranking/final-ranking-client";

const groups = [{ id: "u16", name: "少年组", code: "U16" }, { id: "u20", name: "青年组", code: "U20" }];
const phases = [{ code: "qualifier-one", title: "资格赛第一场", hint: "数据读取中" }, { code: "qualifier-two", title: "资格赛第二场", hint: "数据读取中" }, { code: "main-one", title: "正赛第一阶段", hint: "数据读取中" }, { code: "main-two", title: "正赛第二阶段", hint: "数据读取中" }];
function groupIdOf(input: string) { return input === "u20" ? "u20" : "u16"; }
function groupNameOf(input: string) { return groupIdOf(input) === "u20" ? "青年组" : "少年组"; }
function phaseOf(input: string) { return phases.some((phase) => phase.code === input) ? input : "qualifier-one"; }
function phaseTitleOf(input: string) { return phases.find((phase) => phase.code === phaseOf(input))?.title || "资格赛第一场"; }

export function DrawLoadingView({ eventId = "", groupId = "u16", phase = "qualifier-one" }: { eventId?: string; groupId?: string; phase?: string }) {
  const selectedGroupId = groupIdOf(groupId); const selectedPhase = phaseOf(phase); const groupName = groupNameOf(selectedGroupId); const phaseTitle = phaseTitleOf(selectedPhase);
  const qualifier: DrawWorkspaceData = { viewerRole: "referee", event: { id: eventId, shortTitle: "当前赛事", stationNo: 0, status: "draft" }, groups: [{ id: "u16", name: "少年组", code: "U16", approvedCount: 0 }, { id: "u20", name: "青年组", code: "U20", approvedCount: 0 }], selectedGroupId, selectedPhase: selectedPhase === "qualifier-two" ? "qualifier-two" : "qualifier-one", phaseTitle, settings: { bracketSize: 512, divisionSize: 32, rateQualifierCount: 8, seedsEnabled: false, seedTargetCount: 0, seedFillRule: "game_win_rate" }, plan: { entrantCount: 0, bracketSize: 512, divisionSize: 32, divisionCount: 16, directQualifierCount: 16, rateQualifierCount: 8, totalQualifierCount: 24, playoffMatchCount: 0, playoffPlayerCount: 0, directEntryCount: 0, byeCount: 512, roundsPerDivision: 5, sourceReady: false, sourceNote: "当前阶段名单与抽签状态正在读取。" }, latestSession: null };
  const mainData = { viewerRole: "referee", event: { id: eventId, shortTitle: "当前赛事" }, groups, selectedGroupId, selectedPhase: (selectedPhase === "main-two" ? "main-two" : "main-one") as "main-one" | "main-two", phaseTitle, sourceCount: 0, sourceReady: false, sourceNote: "当前阶段名单与抽签状态正在读取。", seedCount: 0, latestSession: null };
  return <div aria-busy="true" style={{ pointerEvents: "none" }}><CompetitionContextBar eventId={eventId} eventTitle="当前赛事" groups={groups} selectedGroupId={selectedGroupId} basePath="/admin/competition/draw" phases={phases} selectedPhase={selectedPhase} eyebrow="抽签与签表" title={`${groupName} · ${phaseTitle}`} description="抽签草稿只保存在后台；用户端始终保持上一版正式签表，直到再次点击发布更新。四个阶段使用同一套组别、阶段切换逻辑。" /><CompetitionPublicationBar eventId={eventId} moduleType="schedule" title="签表与赛程" status="draft" viewerRole="referee" hint="抽签与签表状态正在读取。" loading /><div className="unified-competition-context">{selectedPhase.startsWith("qualifier") ? <DrawWorkbenchClient initialData={qualifier} /> : <MainStageWorkbenchClient initialData={mainData} />}</div></div>;
}

export function QualificationLoadingView({ eventId = "", groupId = "u16", phase = "qualifier-one" }: { eventId?: string; groupId?: string; phase?: string }) {
  const selectedGroupId = groupIdOf(groupId); const selectedPhase = phaseOf(phase); const groupName = groupNameOf(selectedGroupId); const phaseTitle = phaseTitleOf(selectedPhase);
  const qualification: QualificationWorkspaceData = { viewerRole: "referee", event: { id: eventId, shortTitle: "当前赛事" }, stages: [{ drawSessionId: "loading", bracketId: "loading", eventId, groupId: selectedGroupId, groupName, phaseCode: selectedPhase, phaseTitle, drawVersion: 0, divisionCount: 16, divisionSize: 32, rateQualifierCount: 8, finalRoundNo: 0, finalCount: 16, completedFinalCount: 0, readyToConfirm: false, direct: [], candidates: [], confirmed: false, batchId: null, confirmedAt: null, nextPhaseCode: selectedPhase === "qualifier-one" ? "qualifier-two" : null, nextPhaseTitle: selectedPhase === "qualifier-one" ? "资格赛第二场" : null, nextPhaseEntryCount: 0 }] };
  const roster: MainRosterControlData = { viewerRole: "referee", event: { id: eventId, shortTitle: "当前赛事", year: new Date().getFullYear(), stationNo: 0 }, previousEvent: null, groups: [{ groupId: selectedGroupId, groupName, groupCode: selectedGroupId === "u20" ? "U20" : "U16", birthDateFrom: null, birthDateTo: null, qualifierOneCount: 0, qualifierTwoCount: 0, qualifierCount: 0, seedSeats: [], replacementPool: [], resolvedSeedCount: 0, replacementCount: 0, mainRosterCount: 0, duplicateCount: 0, currentLock: null, activeMainOneDraw: null, advancement: null, canInitializeSeeds: false, canLock: false }] };
  return <div aria-busy="true" style={{ pointerEvents: "none" }}><CompetitionContextBar eventId={eventId} eventTitle="当前赛事" groups={groups} selectedGroupId={selectedGroupId} basePath="/admin/competition/qualification" phases={phases} selectedPhase={selectedPhase} eyebrow="晋级" title={`${groupName} · ${phaseTitle}`} description="一次只处理一个组别、一个阶段。资格赛确认24人；正赛第一阶段负责种子/递补、64人锁定和32强确认；正赛第二阶段完成后直接进入最终排名。" /><CompetitionPublicationBar eventId={eventId} moduleType="schedule" title="签表、晋级与赛程" status="draft" viewerRole="referee" hint="晋级与名单状态正在读取。" loading />{selectedPhase.startsWith("qualifier") && <QualificationWorkbenchClient initialData={qualification} />}{selectedPhase === "main-one" && <MainRosterControlClient initialData={roster} />}{selectedPhase === "main-two" && <section className="qualification-main-two-note"><div><small>正赛第二阶段</small><h2>本阶段不再单独确认“晋级”</h2><p>32强名单已经在正赛第一阶段确认。第二阶段按照重新抽签后的单败签表一直比赛到冠军，并包含三、四名决赛。所有比赛结果确认完成后，系统自动生成本站最终排名草稿。</p></div><div><Link href="/admin/competition">进入正赛第二阶段抽签 / 签表</Link><Link href="/admin/competition/final-ranking">查看最终排名状态</Link></div></section>}</div>;
}

export function FinalRankingLoadingView({ eventId = "", groupId = "u16" }: { eventId?: string; groupId?: string }) {
  const selectedGroupId = groupIdOf(groupId); const groupName = groupNameOf(selectedGroupId);
  const data: FinalRankingWorkspaceData = { viewerRole: "referee", event: { id: eventId, shortTitle: "当前赛事" }, groups: [{ groupId: selectedGroupId, groupName, sourceReady: false, completedMatchCount: 0, requiredMatchCount: 32, mainOneEliminationCount: 0, batch: null, rows: [] }] };
  return <div aria-busy="true" style={{ pointerEvents: "none" }}><CompetitionContextBar eventId={eventId} eventTitle="当前赛事" groups={groups} selectedGroupId={selectedGroupId} basePath="/admin/competition/final-ranking" eyebrow="最终排名" title={`${groupName} · 本站最终成绩`} description="系统根据正式赛果自动生成64人排名。组委会可以在草稿阶段触发人工调整；确认后锁定，发布后用户端才显示正式排名。" /><FinalRankingClient initialData={data} /></div>;
}
