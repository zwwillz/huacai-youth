"use client";

import { useEffect, useRef, useState } from "react";
import type { EventManagementData } from "@/db/event-management";
import EventManagementClient from "./event-management-client";

const cache = new Map<string, { data: EventManagementData; at: number }>();

function replaceUrl(eventId: string) {
  window.history.replaceState(window.history.state, "", `/admin/events/${encodeURIComponent(eventId)}`);
}

export default function EventEventWorkspaceClient({ initialData }: { initialData: EventManagementData }) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  useEffect(() => { cache.set(initialData.event.id, { data: initialData, at: Date.now() }); }, [initialData]);

  useEffect(() => {
    const onSwitch = (event: Event) => {
      const detail = (event as CustomEvent<{ eventId?: string; previousEventId?: string; active?: string }>).detail;
      if (detail?.active !== "events" || !detail.eventId || detail.eventId === data.event.id) return;
      const eventId = detail.eventId;
      const previousEventId = detail.previousEventId || data.event.id;
      const currentRequest = ++requestId.current;
      const cached = cache.get(eventId);
      const restoredFromCache = Boolean(cached);
      setError("");
      if (cached) {
        setData(cached.data);
        replaceUrl(eventId);
      }
      setLoading(true);
      void fetch(`/api/admin/event-management?eventId=${encodeURIComponent(eventId)}`, { cache: "no-store" })
        .then(async (response) => {
          const payload = await response.json() as { data?: EventManagementData; error?: string };
          if (!response.ok || !payload.data) throw new Error(payload.error || "赛事资料读取失败。");
          if (currentRequest !== requestId.current) return;
          cache.set(eventId, { data: payload.data, at: Date.now() });
          setData(payload.data);
          replaceUrl(eventId);
        })
        .catch((failure) => {
          if (currentRequest !== requestId.current) return;
          setError(failure instanceof Error ? failure.message : "赛事资料读取失败。");
          if (!restoredFromCache) window.dispatchEvent(new CustomEvent("admin:event-switch-revert", { detail: { eventId: previousEventId } }));
        })
        .finally(() => { if (currentRequest === requestId.current) setLoading(false); });
    };
    window.addEventListener("admin:event-switch", onSwitch);
    return () => window.removeEventListener("admin:event-switch", onSwitch);
  }, [data.event.id]);

  const editorKey = `${data.event.id}:${cache.get(data.event.id)?.at ?? "initial"}`;
  return <div className={loading ? "admin-local-workspace is-refreshing" : "admin-local-workspace"}>
    {loading && <div className="admin-local-refresh"><i />正在同步赛事设置…</div>}
    {error && <div className="admin-local-error">{error}{cache.has(data.event.id) ? " 当前显示上一次读取的数据。" : ""}</div>}
    <EventManagementClient key={editorKey} initialData={data} />
  </div>;
}
