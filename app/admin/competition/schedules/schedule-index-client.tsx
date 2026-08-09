"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CompetitionContextData } from "@/db/competition-context";
import type { CompetitionBracketIndexItem } from "@/db/competition-tool-index";
import ScheduleIndexView, { makeScheduleIndexLoadingModel, schedulePhases, type ScheduleIndexViewModel } from "./schedule-index-view";

const PHASE_ORDER: Record<string, number> = Object.fromEntries(schedulePhases.map(([code], index) => [code, index]));
const CACHE_TTL = 30_000;
type Payload = { context: CompetitionContextData; items: CompetitionBracketIndexItem[] };
const cache = new Map<string, { data: Payload; at: number }>();

function defaultPhase(items: CompetitionBracketIndexItem[], groupId: string, requested?: string) {
  if (requested && schedulePhases.some(([code]) => code === requested)) return requested;
  const available = [...new Set(items.filter((item) => item.groupId === groupId).map((item) => item.phaseCode))];
  return [...available].sort((a, b) => (PHASE_ORDER[b] ?? -1) - (PHASE_ORDER[a] ?? -1))[0] || "qualifier-one";
}

function replaceUrl(eventId: string, groupId: string, phase: string) {
  const params = new URLSearchParams({ event: eventId });
  if (groupId) params.set("group", groupId);
  if (phase) params.set("phase", phase);
  window.history.replaceState(window.history.state, "", `/admin/competition/schedules?${params.toString()}`);
}

type Props = {
  initialEventId: string;
  initialContext?: CompetitionContextData | null;
  initialItems?: CompetitionBracketIndexItem[];
  initialGroupId?: string;
  initialPhase?: string;
  viewerRole: string;
};

export default function ScheduleIndexClient({ initialEventId, initialContext = null, initialItems = [], initialGroupId = "", initialPhase = "qualifier-one", viewerRole }: Props) {
  const [eventId, setEventId] = useState(initialEventId);
  const [context, setContext] = useState<CompetitionContextData | null>(initialContext);
  const [allItems, setAllItems] = useState(initialItems);
  const [selectedGroupId, setSelectedGroupId] = useState(initialGroupId || initialContext?.groups[0]?.id || "");
  const [selectedPhase, setSelectedPhase] = useState(initialPhase || "qualifier-one");
  const [loading, setLoading] = useState(!initialContext);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  useEffect(() => {
    if (initialContext) cache.set(initialEventId, { data: { context: initialContext, items: initialItems }, at: Date.now() });
  }, [initialContext, initialEventId, initialItems]);

  const applyPayload = useCallback((nextEventId: string, payload: Payload, preferredGroupId = "", preferredPhase = "") => {
    const groupId = payload.context.groups.some((group) => group.id === preferredGroupId) ? preferredGroupId : payload.context.groups[0]?.id || "";
    const phase = defaultPhase(payload.items, groupId, preferredPhase);
    setEventId(nextEventId);
    setContext(payload.context);
    setAllItems(payload.items);
    setSelectedGroupId(groupId);
    setSelectedPhase(phase);
    replaceUrl(nextEventId, groupId, phase);
  }, []);

  const loadEvent = useCallback(async (nextEventId: string, previousEventId = "", preferredGroupId = "", preferredPhase = "") => {
    if (!nextEventId) return;
    const currentRequest = ++requestId.current;
    const cached = cache.get(nextEventId);
    setEventId(nextEventId);
    setError("");
    if (cached && Date.now() - cached.at < CACHE_TTL) {
      applyPayload(nextEventId, cached.data, preferredGroupId, preferredPhase);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/competition/schedules-index?eventId=${encodeURIComponent(nextEventId)}`, { cache: "no-store" });
      const result = await response.json() as { data?: Payload; error?: string };
      if (!response.ok || !result.data) throw new Error(result.error || "赛程索引读取失败。");
      if (currentRequest !== requestId.current) return;
      cache.set(nextEventId, { data: result.data, at: Date.now() });
      applyPayload(nextEventId, result.data, preferredGroupId, preferredPhase);
    } catch (failure) {
      if (currentRequest !== requestId.current) return;
      setError(failure instanceof Error ? failure.message : "赛程索引读取失败。");
      if (previousEventId) window.dispatchEvent(new CustomEvent("admin:event-switch-revert", { detail: { eventId: previousEventId } }));
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [applyPayload]);

  useEffect(() => {
    if (!initialContext && initialEventId) void loadEvent(initialEventId, "", initialGroupId, initialPhase);
  }, [initialContext, initialEventId, initialGroupId, initialPhase, loadEvent]);

  useEffect(() => {
    const onSwitch = (event: Event) => {
      const detail = (event as CustomEvent<{ eventId?: string; previousEventId?: string; active?: string; competitionTool?: string }>).detail;
      if (detail?.active !== "competition" || detail.competitionTool !== "schedule" || !detail.eventId || detail.eventId === eventId) return;
      void loadEvent(detail.eventId, detail.previousEventId || eventId);
    };
    window.addEventListener("admin:event-switch", onSwitch);
    return () => window.removeEventListener("admin:event-switch", onSwitch);
  }, [eventId, loadEvent]);

  const items = useMemo(() => selectedGroupId ? allItems.filter((item) => item.groupId === selectedGroupId) : [], [allItems, selectedGroupId]);
  const current = useMemo(() => items.filter((item) => item.phaseCode === selectedPhase).sort((a, b) => b.drawVersion - a.drawVersion)[0] ?? null, [items, selectedPhase]);
  const phaseOptions = useMemo(() => schedulePhases.map(([code, title]) => {
    const item = items.filter((row) => row.phaseCode === code).sort((a, b) => b.drawVersion - a.drawVersion)[0];
    return { code, title, hint: item ? (item.scheduleId ? `${item.scheduledCount}/${item.playableMatchCount}场已排` : "签表已就绪") : "等待签表" };
  }), [items]);

  const chooseGroup = (groupId: string) => {
    if (!context) return;
    setSelectedGroupId(groupId);
    const phase = schedulePhases.some(([code]) => code === selectedPhase) ? selectedPhase : defaultPhase(allItems, groupId);
    setSelectedPhase(phase);
    replaceUrl(eventId, groupId, phase);
  };
  const choosePhase = (phase: string) => {
    setSelectedPhase(phase);
    replaceUrl(eventId, selectedGroupId, phase);
  };

  const model: ScheduleIndexViewModel = context ? {
    eventId,
    eventTitle: context.event.shortTitle,
    groups: context.groups,
    selectedGroupId: selectedGroupId || context.groups[0]?.id || "",
    selectedPhase,
    phaseOptions,
    current,
    publicationStatus: context.publications.schedule.status,
    publicationDirty: context.publications.schedule.hasUnpublishedChanges,
    viewerRole,
  } : makeScheduleIndexLoadingModel(eventId, selectedGroupId, selectedPhase);

  return <div className={loading && context ? "admin-local-workspace is-refreshing" : "admin-local-workspace"}>
    {loading && context && <div className="admin-local-refresh"><i />正在切换赛事赛程…</div>}
    {error && <div className="admin-local-error">{error}</div>}
    <ScheduleIndexView model={model} onGroupChange={chooseGroup} onPhaseChange={choosePhase} onPublicationChanged={context ? (status, dirty) => setContext((currentContext) => currentContext ? ({ ...currentContext, publications: { ...currentContext.publications, schedule: { ...currentContext.publications.schedule, status, hasUnpublishedChanges: dirty } } }) : currentContext) : undefined} />
  </div>;
}
