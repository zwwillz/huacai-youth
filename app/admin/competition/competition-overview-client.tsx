"use client";

import { useEffect, useRef, useState } from "react";
import type { CompetitionDashboardData } from "@/db/competition-dashboard";
import CompetitionOverviewView, { type CompetitionOverviewViewModel } from "./competition-overview-view";

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
    groups: data.groups.map((group) => ({
      id: group.id,
      name: group.name,
      code: group.code,
      approvedCount: group.approvedCount,
      draws: group.draws,
    })),
    selectedGroupId,
  };
}

export default function CompetitionOverviewClient({ initialData, initialGroupId }: { initialData: CompetitionDashboardData; initialGroupId: string }) {
  const [data, setData] = useState(initialData);
  const [selectedGroupId, setSelectedGroupId] = useState(initialGroupId || initialData.groups[0]?.id || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  useEffect(() => { if (initialData.selectedEventId) cache.set(initialData.selectedEventId, { data: initialData, at: Date.now() }); }, [initialData]);

  useEffect(() => {
    const onSwitch = (event: Event) => {
      const detail = (event as CustomEvent<{ eventId?: string; previousEventId?: string; active?: string; competitionTool?: string }>).detail;
      if (detail?.active !== "competition" || detail.competitionTool !== "overview" || !detail.eventId || detail.eventId === data.selectedEventId) return;
      const eventId = detail.eventId;
      const previousEventId = detail.previousEventId || data.selectedEventId;
      const currentRequest = ++requestId.current;
      const cached = cache.get(eventId);
      setError("");
      if (cached && Date.now() - cached.at < CACHE_TTL) {
        setData(cached.data);
        const groupId = cached.data.groups[0]?.id || "";
        setSelectedGroupId(groupId);
        replaceUrl(eventId, groupId);
        setLoading(false);
        return;
      }
      setLoading(true);
      void fetch(`/api/admin/competition/overview?eventId=${encodeURIComponent(eventId)}`, { cache: "no-store" })
        .then(async (response) => {
          const payload = await response.json() as { data?: CompetitionDashboardData; error?: string };
          if (!response.ok || !payload.data) throw new Error(payload.error || "竞赛总览读取失败。");
          if (currentRequest !== requestId.current) return;
          cache.set(eventId, { data: payload.data, at: Date.now() });
          setData(payload.data);
          const groupId = payload.data.groups[0]?.id || "";
          setSelectedGroupId(groupId);
          replaceUrl(eventId, groupId);
        })
        .catch((failure) => {
          if (currentRequest !== requestId.current) return;
          setError(failure instanceof Error ? failure.message : "竞赛总览读取失败。");
          if (previousEventId) window.dispatchEvent(new CustomEvent("admin:event-switch-revert", { detail: { eventId: previousEventId } }));
        })
        .finally(() => { if (currentRequest === requestId.current) setLoading(false); });
    };
    window.addEventListener("admin:event-switch", onSwitch);
    return () => window.removeEventListener("admin:event-switch", onSwitch);
  }, [data.selectedEventId]);

  const chooseGroup = (groupId: string) => {
    setSelectedGroupId(groupId);
    replaceUrl(data.selectedEventId, groupId);
  };

  const model = toViewModel(data, selectedGroupId);

  return <div className={loading ? "admin-local-workspace is-refreshing" : "admin-local-workspace"}>
    {loading && <div className="admin-local-refresh"><i />正在切换竞赛赛事…</div>}
    {error && <div className="admin-local-error">{error}</div>}
    <CompetitionOverviewView model={model} onGroupChange={chooseGroup} />
  </div>;
}
