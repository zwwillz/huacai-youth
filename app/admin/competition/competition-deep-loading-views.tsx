"use client";

import Link from "next/link";
import type { DrawSessionDetail } from "@/db/draw-engine";
import type { BracketDetail, BracketMatch } from "@/db/bracket-engine";
import type { ScheduleWorkspaceData } from "@/db/schedule-engine";
import CompetitionContextBar from "./competition-context-bar";
import CompetitionPublicationBar from "./competition-publication-bar";
import BracketWorkbenchClient from "./bracket/bracket-workbench-client";
import ScheduleWorkbenchClient from "./schedule/schedule-workbench-client";

const groups = [{ id: "u16", name: "少年组", code: "U16" }, { id: "u20", name: "青年组", code: "U20" }];
const phases = [
  { code: "qualifier-one", title: "资格赛第一场" },
  { code: "qualifier-two", title: "资格赛第二场" },
  { code: "main-one", title: "正赛第一阶段" },
  { code: "main-two", title: "正赛第二阶段" },
];

export function ScheduleWorkbenchLoadingView({ sessionId = "" }: { sessionId?: string }) {
  const data: ScheduleWorkspaceData = {
    viewerRole: "referee",
    drawSessionId: sessionId,
    bracket: {
      id: "loading-bracket", eventId: "", groupId: "u16", phaseCode: "qualifier-one",
      eventTitle: "当前赛事", groupName: "少年组", phaseTitle: "资格赛第一场",
      playableMatchCount: 0, totalNodeCount: 0, eventStartDate: "", eventEndDate: "", venueTableCount: 32,
    },
    tables: [], timeSlots: [], referees: [], schedule: null, assignments: [],
  };
  return <div aria-busy="true" style={{ pointerEvents: "none" }}>
    <CompetitionContextBar eventId="" eventTitle="当前赛事" groups={groups} selectedGroupId="u16" basePath="/admin/competition/schedules" phases={phases} selectedPhase="qualifier-one" eyebrow="赛程编排" title="少年组 · 资格赛第一场" description="当前页面只编辑这一组别、这一阶段的时间、球台与裁判。保存后先在后台检查；用户端保持上一版正式赛程，确认无误后再发布更新。" />
    <CompetitionPublicationBar eventId="" moduleType="schedule" title="签表与赛程" status="draft" viewerRole="referee" hint="赛程发布状态正在读取。" loading />
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 10 }}><Link href="/admin/competition/schedules" tabIndex={-1} style={{ padding: "9px 12px", borderRadius: 9, background: "#f1ebf7", color: "#67478f", fontSize: 9, fontWeight: 900, textDecoration: "none" }}>打印签表 / 赛程</Link></div>
    <ScheduleWorkbenchClient initialData={data} />
  </div>;
}

function placeholderMatch(id: string, roundNo: number, roundName: string, index: number): BracketMatch {
  return {
    id, matchType: "division", divisionNo: 1, roundNo, roundName, matchNo: index + 1,
    matchCode: `—${index + 1}`, playerAId: null, playerAName: null, playerBId: null, playerBName: null,
    sourceAType: "winner", sourceARef: null, sourceBType: "winner", sourceBRef: null, status: "pending",
    winnerPlayerId: null, winnerPlayerName: null, resultType: null, sortOrder: index,
  };
}

export function BracketLoadingView({ sessionId = "", eventId = "" }: { sessionId?: string; eventId?: string }) {
  const draw: DrawSessionDetail = {
    viewerRole: "referee",
    session: {
      id: sessionId || "loading-session", eventId, eventTitle: "当前赛事", groupId: "u16", groupName: "少年组",
      phaseCode: "qualifier-one", phaseTitle: "资格赛第一场", versionNo: 0, status: "confirmed", entrantCount: 0,
      bracketSize: 512, divisionSize: 32, divisionCount: 16, directQualifierCount: 16, rateQualifierCount: 8,
      totalQualifierCount: 24, playoffMatchCount: 0, playoffPlayerCount: 0, byeCount: 0, seedsEnabled: false,
      seedTargetCount: 0, seedFillRule: "game_win_rate", randomCommitment: "", randomSeed: "", createdAt: "", confirmedAt: null,
    },
    participants: [], prelimMatches: [], slots: [],
  };
  const matches = [
    placeholderMatch("loading-r1", 1, "32进16", 0),
    placeholderMatch("loading-r2", 2, "16进8", 1),
    placeholderMatch("loading-r3", 3, "8进4", 2),
    placeholderMatch("loading-r4", 4, "4进2", 3),
    placeholderMatch("loading-r5", 5, "分区决胜", 4),
  ];
  const bracket: BracketDetail = {
    bracket: {
      id: "loading-bracket", drawSessionId: sessionId || "loading-session", eventId, groupId: "u16", phaseCode: "qualifier-one",
      status: "active", divisionCount: 16, divisionSize: 32, playoffMatchCount: 0, playableMatchCount: 0, totalNodeCount: 0,
      generatedAt: "正在读取", eventTitle: "当前赛事", groupName: "少年组", phaseTitle: "资格赛第一场",
    },
    matches,
    links: [],
  };
  return <div aria-busy="true" style={{ pointerEvents: "none" }}>
    <div className="bracket-next-step"><div><small>NEXT STEP</small><strong>完整比赛关系正在读取</strong><span>下一步配置比赛日期、时间段、球台和后台裁判。</span></div><Link href="/admin/competition/schedules" tabIndex={-1}>进入赛程与球台 →</Link></div>
    <BracketWorkbenchClient draw={draw} initialBracket={bracket} />
  </div>;
}
