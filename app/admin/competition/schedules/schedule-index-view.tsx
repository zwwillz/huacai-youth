"use client";

import Link from "next/link";
import type { CompetitionContextGroup } from "@/db/competition-context";
import type { CompetitionBracketIndexItem } from "@/db/competition-tool-index";
import CompetitionContextBar, { type CompetitionPhaseOption } from "../competition-context-bar";
import CompetitionPublicationBar from "../competition-publication-bar";

export type ScheduleIndexViewModel = {
  eventId: string;
  eventTitle: string;
  groups: CompetitionContextGroup[];
  selectedGroupId: string;
  selectedPhase: string;
  phaseOptions: CompetitionPhaseOption[];
  current: CompetitionBracketIndexItem | null;
  publicationStatus: string;
  publicationDirty: boolean;
  viewerRole: string;
  loading?: boolean;
};

type Props = {
  model: ScheduleIndexViewModel;
  onGroupChange?: (groupId: string) => void;
  onPhaseChange?: (phaseCode: string) => void;
  onPublicationChanged?: (status: string, dirty: boolean) => void;
};

export const schedulePhases = [
  ["qualifier-one", "资格赛第一场"],
  ["qualifier-two", "资格赛第二场"],
  ["main-one", "正赛第一阶段"],
  ["main-two", "正赛第二阶段"],
] as const;

export function makeScheduleIndexLoadingModel(eventId = "", selectedGroupId = "u16", selectedPhase = "qualifier-one"): ScheduleIndexViewModel {
  const groupId = selectedGroupId === "u20" ? "u20" : "u16";
  return {
    eventId,
    eventTitle: "当前赛事",
    groups: [{ id: "u16", code: "U16", name: "少年组" }, { id: "u20", code: "U20", name: "青年组" }],
    selectedGroupId: groupId,
    selectedPhase: schedulePhases.some(([code]) => code === selectedPhase) ? selectedPhase : "qualifier-one",
    phaseOptions: schedulePhases.map(([code, title]) => ({ code, title, hint: "数据读取中" })),
    current: null,
    publicationStatus: "draft",
    publicationDirty: false,
    viewerRole: "system_admin",
    loading: true,
  };
}

export default function ScheduleIndexView({ model, onGroupChange, onPhaseChange, onPublicationChanged }: Props) {
  const selectedGroupName = model.groups.find((group) => group.id === model.selectedGroupId)?.name || "当前组别";
  const selectedPhaseTitle = schedulePhases.find(([code]) => code === model.selectedPhase)?.[1] || "当前阶段";
  const loading = Boolean(model.loading);
  const current = model.current;
  const playable = current?.playableMatchCount ?? null;
  const scheduled = current?.scheduledCount ?? null;
  const percent = playable == null || scheduled == null ? null : playable ? Math.round(scheduled / playable * 100) : 0;
  const sessionId = current?.drawSessionId || "";

  return <main className="schedule-index-page" aria-busy={loading} style={loading ? { pointerEvents: "none" } : undefined}>
    <CompetitionContextBar
      eventId={model.eventId}
      eventTitle={model.eventTitle}
      groups={model.groups}
      selectedGroupId={model.selectedGroupId}
      basePath="/admin/competition/schedules"
      phases={model.phaseOptions}
      selectedPhase={model.selectedPhase}
      eyebrow="赛程编排"
      title={`${selectedGroupName} · ${selectedPhaseTitle}`}
      description="组别和阶段切换只更新当前工作区；已经读取的签表索引会留在浏览器会话中。"
      onGroupChange={loading ? undefined : onGroupChange}
      onPhaseChange={loading ? undefined : onPhaseChange}
    />
    <CompetitionPublicationBar
      eventId={model.eventId}
      moduleType="schedule"
      title="签表与赛程"
      status={model.publicationStatus}
      hasUnpublishedChanges={model.publicationDirty}
      viewerRole={model.viewerRole}
      hint="抽签、时间、球台等后台调整不会直接覆盖用户端；点击发布更新后，用户端才整体切换到本次正式版本。"
      loading={loading}
      onChanged={onPublicationChanged}
    />

    {loading || current ? <section className="schedule-current-stage">
      <article>
        <header><div><span>{loading ? selectedGroupName : current?.groupName}</span><h3>{loading ? selectedPhaseTitle : current?.phaseTitle}</h3><p>{loading ? "抽签版本读取中" : `抽签 V${current?.drawVersion}`}</p></div><em>{loading ? "状态读取中" : current?.scheduleId ? "已生成赛程" : "等待编排"}</em></header>
        <div className="schedule-current-metrics"><div><small>实际比赛</small><strong>{playable ?? "—"}</strong><span>场</span></div><div><small>已排赛程</small><strong>{scheduled ?? "—"}</strong><span>场</span></div><div><small>完成度</small><strong>{percent ?? "—"}</strong><span>%</span></div></div>
        <div className="schedule-index-actions"><Link prefetch={false} href={sessionId ? `/admin/competition/schedule?session=${encodeURIComponent(sessionId)}` : "/admin/competition/schedules"}>{loading ? "赛程状态读取中" : current?.scheduleId ? "继续调整当前阶段" : "进入自动排程"}</Link><Link prefetch={false} className="secondary" href={sessionId ? `/admin/competition/print?session=${encodeURIComponent(sessionId)}` : "/admin/competition/schedules"}>打印签表 / 赛程</Link></div>
      </article>
    </section> : <section className="schedule-index-empty"><strong>当前阶段还没有可编排的正式签表</strong><p>请先在“抽签与签表”中完成当前组别、当前阶段的正式抽签并生成比赛关系。赛程页面会自动开放，不需要手工创建阶段。</p><Link prefetch={false} href={`/admin/competition/draw?event=${encodeURIComponent(model.eventId)}&group=${encodeURIComponent(model.selectedGroupId)}&phase=${encodeURIComponent(model.selectedPhase)}`}>进入当前阶段抽签</Link></section>}
  </main>;
}
