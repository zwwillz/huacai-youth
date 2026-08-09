"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CompetitionDashboardData } from "@/db/competition-dashboard";
import CompetitionOverviewView, { makeCompetitionOverviewLoadingModel, type CompetitionOverviewViewModel } from "./competition-overview-view";

const CACHE_TTL = 30_000;
const cache = new Map<string, { data: CompetitionDashboardData; at: number }>();

function replaceUrl(eventId: string, groupId: string) {
  const params = new URLSearchParams({ event: eventId });
  if (groupId) params.set("group", groupId);
  window.history.replaceState(window.history.state, "", `/admin/competition?${params.toString()}`);
}

function toViewModel(data: CompetitionDashboardData, selectedGroupId: string): CompetitionOverviewViewModel {
  const currentEvent = data.events.find((event) => event.id === data.selectedEventId);
  return {
    eventId: data.selectedEventId,
    eventTitle: currentEvent?.shortTitle || "竞赛执行",
    groups: data.groups.map((group) => ({ id: group.id, name: group.name, code: group.code, approvedCount: group.approvedCount, draws: group.draws })),
    selectedGroupId,
  };
}

type Props = {
  initialData?: CompetitionDashboardData | null;
  initialEventId: string;
  initialGroupId?: string;
};

export default function CompetitionOverviewClient({ initialData = null, initialEventId, initialGroupId = "" }: Props) {
  const [data, setData] = useState<CompetitionDashboardData | null>(initialData);
  const [eventId, setEventId] = useState(initialData?.selectedEventId || initialEventId);
  const [selectedGroupId, setSelectedGroupId] = useState(initialGroupId || initialData?.groups[0]?.id || "");
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  useEffect(() => {
    if (initialData?.selectedEventId) cache.set(initialData.selectedEventId, { data: initialData, at: Date.now() });
  }, [initialData]);

  const loadEvent = useCallback(async (nextEventId: string, previousEventId = "", preferredGroupId = "") => {
    if (!nextEventId) return;
    const currentRequest = ++requestId.current;
    const cached = cache.get(nextEventId);
    setEventId(nextEventId);
    setError("");
    if (cached && Date.now() - cached.at < CACHE_TTL) {
      setData(cached.data);
      const groupId = cached.data.groups.some((group) => group.id === preferredGroupId) ? preferredGroupId : cached.data.groups[0]?.id || "";
      setSelectedGroupId(groupId);
      replaceUrl(nextEventId, groupId);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/competition/overview?eventId=${encodeURIComponent(nextEventId)}`, { cache: "no-store" });
      const payload = await response.json() as { data?: CompetitionDashboardData; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || "竞赛总览读取失败。");
      if (currentRequest !== requestId.current) return;
      cache.set(nextEventId, { data: payload.data, at: Date.now() });
      setData(payload.data);
      const groupId = payload.data.groups.some((group) => group.id === preferredGroupId) ? preferredGroupId : payload.data.groups[0]?.id || "";
      setSelectedGroupId(groupId);
      replaceUrl(nextEventId, groupId);
    } catch (failure) {
      if (currentRequest !== requestId.current) return;
      setError(failure instanceof Error ? failure.message : "竞赛总览读取失败。");
      if (previousEventId) window.dispatchEvent(new CustomEvent("admin:event-switch-revert", { detail: { eventId: previousEventId } }));
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialData && initialEventId) void loadEvent(initialEventId, "", initialGroupId);
  }, [initialData, initialEventId, initialGroupId, loadEvent]);

  useEffect(() => {
    const onSwitch = (event: Event) => {
      const detail = (event as CustomEvent<{ eventId?: string; previousEventId?: string; active?: string; competitionTool?: string }>).detail;
      if (detail?.active !== "competition" || detail.competitionTool !== "overview" || !detail.eventId || detail.eventId === eventId) return;
      void loadEvent(detail.eventId, detail.previousEventId || eventId);
    };
    window.addEventListener("admin:event-switch", onSwitch);
    return () => window.removeEventListener("admin:event-switch", onSwitch);
  }, [eventId, loadEvent]);

  const chooseGroup = (groupId: string) => {
    if (!data) return;
    setSelectedGroupId(groupId);
    replaceUrl(data.selectedEventId, groupId);
  };

  const model = data
    ? toViewModel(data, selectedGroupId || data.groups[0]?.id || "")
    : makeCompetitionOverviewLoadingModel(eventId, selectedGroupId);

  return <div className={loading && data ? "admin-local-workspace is-refreshing" : "admin-local-workspace"}>
    {loading && data && <div className="admin-local-refresh"><i />正在切换竞赛赛事…</div>}
    {error && <div className="admin-local-error">{error}</div>}
    <CompetitionOverviewView model={model} onGroupChange={chooseGroup} />
  </div>;
}
