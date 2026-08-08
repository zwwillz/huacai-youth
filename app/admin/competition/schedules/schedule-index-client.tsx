"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CompetitionContextData } from "@/db/competition-context";
import type { CompetitionBracketIndexItem } from "@/db/competition-tool-index";
import CompetitionContextBar from "../competition-context-bar";
import CompetitionPublicationBar from "../competition-publication-bar";

const PHASES = [
  ["qualifier-one", "资格赛第一场"],
  ["qualifier-two", "资格赛第二场"],
  ["main-one", "正赛第一阶段"],
  ["main-two", "正赛第二阶段"],
] as const;
const PHASE_ORDER: Record<string, number> = Object.fromEntries(PHASES.map(([code], index) => [code, index]));
const CACHE_TTL = 30_000;
type Payload = { context: CompetitionContextData; items: CompetitionBracketIndexItem[] };
const cache = new Map<string, { data: Payload; at: number }>();

function defaultPhase(items: CompetitionBracketIndexItem[], groupId: string, requested?: string) {
  if (requested && PHASES.some(([code]) => code === requested)) return requested;
  const available = [...new Set(items.filter((item) => item.groupId === groupId).map((item) => item.phaseCode))];
  return [...available].sort((a, b) => (PHASE_ORDER[b] ?? -1) - (PHASE_ORDER[a] ?? -1))[0] || "qualifier-one";
}

function replaceUrl(eventId: string, groupId: string, phase: string) {
  const params = new URLSearchParams({ event: eventId });
  if (groupId) params.set("group", groupId);
  if (phase) params.set("phase", phase);
  window.history.replaceState(window.history.state, "", `/admin/competition/schedules?${params.toString()}`);
}

export default function ScheduleIndexClient({ initialEventId, initialContext, initialItems, initialGroupId, initialPhase, viewerRole }: {
  initialEventId: string;
  initialContext: CompetitionContextData;
  initialItems: CompetitionBracketIndexItem[];
  initialGroupId: string;
  initialPhase: string;
  viewerRole: string;
}) {
  const [eventId, setEventId] = useState(initialEventId);
  const [context, setContext] = useState(initialContext);
  const [allItems, setAllItems] = useState(initialItems);
  const [selectedGroupId, setSelectedGroupId] = useState(initialGroupId);
  const [selectedPhase, setSelectedPhase] = useState(initialPhase);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  useEffect(() => { cache.set(initialEventId, { data: { context: initialContext, items: initialItems }, at: Date.now() }); }, [initialContext, initialEventId, initialItems]);

  useEffect(() => {
    const onSwitch = (event: Event) => {
      const detail = (event as CustomEvent<{ eventId?: string; previousEventId?: string; active?: string; competitionTool?: string }>).detail;
      if (detail?.active !== "competition" || detail.competitionTool !== "schedule" || !detail.eventId || detail.eventId === eventId) return;
      const nextEventId = detail.eventId;
      const previousEventId = detail.previousEventId || eventId;
      const currentRequest = ++requestId.current;
      const cached = cache.get(nextEventId);
      setError("");
      if (cached && Date.now() - cached.at < CACHE_TTL) {
        const groupId = cached.data.context.groups[0]?.id || "";
        const phase = defaultPhase(cached.data.items, groupId);
        setEventId(nextEventId); setContext(cached.data.context); setAllItems(cached.data.items); setSelectedGroupId(groupId); setSelectedPhase(phase);
        replaceUrl(nextEventId, groupId, phase);
        setLoading(false);
        return;
      }
      setLoading(true);
      void fetch(`/api/admin/competition/schedules-index?eventId=${encodeURIComponent(nextEventId)}`, { cache: "no-store" })
        .then(async (response) => {
          const payload = await response.json() as { data?: Payload; error?: string };
          if (!response.ok || !payload.data) throw new Error(payload.error || "赛程索引读取失败。");
          if (currentRequest !== requestId.current) return;
          cache.set(nextEventId, { data: payload.data, at: Date.now() });
          const groupId = payload.data.context.groups[0]?.id || "";
          const phase = defaultPhase(payload.data.items, groupId);
          setEventId(nextEventId); setContext(payload.data.context); setAllItems(payload.data.items); setSelectedGroupId(groupId); setSelectedPhase(phase);
          replaceUrl(nextEventId, groupId, phase);
        })
        .catch((failure) => {
          if (currentRequest !== requestId.current) return;
          setError(failure instanceof Error ? failure.message : "赛程索引读取失败。");
          if (previousEventId) window.dispatchEvent(new CustomEvent("admin:event-switch-revert", { detail: { eventId: previousEventId } }));
        })
        .finally(() => { if (currentRequest === requestId.current) setLoading(false); });
    };
    window.addEventListener("admin:event-switch", onSwitch);
    return () => window.removeEventListener("admin:event-switch", onSwitch);
  }, [eventId]);

  const items = useMemo(() => selectedGroupId ? allItems.filter((item) => item.groupId === selectedGroupId) : [], [allItems, selectedGroupId]);
  const current = useMemo(() => items.filter((item) => item.phaseCode === selectedPhase).sort((a, b) => b.drawVersion - a.drawVersion)[0] ?? null, [items, selectedPhase]);
  const phaseOptions = useMemo(() => PHASES.map(([code, title]) => {
    const item = items.filter((row) => row.phaseCode === code).sort((a, b) => b.drawVersion - a.drawVersion)[0];
    return { code, title, hint: item ? (item.scheduleId ? `${item.scheduledCount}/${item.playableMatchCount}场已排` : "签表已就绪") : "等待签表" };
  }), [items]);

  const chooseGroup = (groupId: string) => {
    setSelectedGroupId(groupId);
    const phase = PHASES.some(([code]) => code === selectedPhase) ? selectedPhase : defaultPhase(allItems, groupId);
    setSelectedPhase(phase);
    replaceUrl(eventId, groupId, phase);
  };
  const choosePhase = (phase: string) => { setSelectedPhase(phase); replaceUrl(eventId, selectedGroupId, phase); };
  const selectedGroupName = context.groups.find((group) => group.id === selectedGroupId)?.name || "当前组别";
  const selectedPhaseTitle = PHASES.find(([code]) => code === selectedPhase)?.[1] || "当前阶段";

  return <div className={loading ? "admin-local-workspace is-refreshing" : "admin-local-workspace"}>
    {loading && <div className="admin-local-refresh"><i />正在切换赛事赛程…</div>}
    {error && <div className="admin-local-error">{error}</div>}
    <main className="schedule-index-page">
      <CompetitionContextBar eventId={eventId} eventTitle={context.event.shortTitle} groups={context.groups} selectedGroupId={selectedGroupId} basePath="/admin/competition/schedules" phases={phaseOptions} selectedPhase={selectedPhase} eyebrow="赛程编排" title={`${selectedGroupName} · ${selectedPhaseTitle}`} description="组别和阶段切换只更新当前工作区；已经读取的签表索引会留在浏览器会话中。" onGroupChange={chooseGroup} onPhaseChange={choosePhase} />
      <CompetitionPublicationBar eventId={eventId} moduleType="schedule" title="签表与赛程" status={context.publications.schedule.status} hasUnpublishedChanges={context.publications.schedule.hasUnpublishedChanges} viewerRole={viewerRole} hint="抽签、时间、球台等后台调整不会直接覆盖用户端；点击发布更新后，用户端才整体切换到本次正式版本。" onChanged={(status, dirty) => setContext((currentContext) => ({ ...currentContext, publications: { ...currentContext.publications, schedule: { ...currentContext.publications.schedule, status, hasUnpublishedChanges: dirty } } }))} />

      {current ? <section className="schedule-current-stage">
        <article>
          <header><div><span>{current.groupName}</span><h3>{current.phaseTitle}</h3><p>抽签 V{current.drawVersion}</p></div><em>{current.scheduleId ? "已生成赛程" : "等待编排"}</em></header>
          <div className="schedule-current-metrics"><div><small>实际比赛</small><strong>{current.playableMatchCount}</strong><span>场</span></div><div><small>已排赛程</small><strong>{current.scheduledCount}</strong><span>场</span></div><div><small>完成度</small><strong>{current.playableMatchCount ? Math.round(current.scheduledCount / current.playableMatchCount * 100) : 0}</strong><span>%</span></div></div>
          <div className="schedule-index-actions"><Link prefetch={false} href={`/admin/competition/schedule?session=${encodeURIComponent(current.drawSessionId)}`}>{current.scheduleId ? "继续调整当前阶段" : "进入自动排程"}</Link><Link prefetch={false} className="secondary" href={`/admin/competition/print?session=${encodeURIComponent(current.drawSessionId)}`}>打印签表 / 赛程</Link></div>
        </article>
      </section> : <section className="schedule-index-empty"><strong>当前阶段还没有可编排的正式签表</strong><p>请先在“抽签与签表”中完成当前组别、当前阶段的正式抽签并生成比赛关系。赛程页面会自动开放，不需要手工创建阶段。</p><Link prefetch={false} href={`/admin/competition/draw?event=${encodeURIComponent(eventId)}&group=${encodeURIComponent(selectedGroupId)}&phase=${encodeURIComponent(selectedPhase)}`}>进入当前阶段抽签</Link></section>}
    </main>
  </div>;
}
