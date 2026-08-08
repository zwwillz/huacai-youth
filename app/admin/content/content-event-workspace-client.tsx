"use client";

import { useEffect, useRef, useState } from "react";
import type { ContentManagementData } from "@/db/content-management";
import ContentManagementClient from "./content-management-client";

const CACHE_TTL = 60_000;
const cache = new Map<string, { data: ContentManagementData; at: number }>();

function replaceUrl(eventId: string) {
  window.history.replaceState(window.history.state, "", `/admin/content/${encodeURIComponent(eventId)}`);
}

export default function ContentEventWorkspaceClient({ initialData }: { initialData: ContentManagementData }) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  useEffect(() => { cache.set(initialData.event.id, { data: initialData, at: Date.now() }); }, [initialData]);

  useEffect(() => {
    const onSwitch = (event: Event) => {
      const detail = (event as CustomEvent<{ eventId?: string; previousEventId?: string; active?: string }>).detail;
      if (detail?.active !== "content" || !detail.eventId || detail.eventId === data.event.id) return;
      const eventId = detail.eventId;
      const previousEventId = detail.previousEventId || data.event.id;
      const currentRequest = ++requestId.current;
      const cached = cache.get(eventId);
      setError("");
      if (cached) {
        setData(cached.data);
        replaceUrl(eventId);
        if (Date.now() - cached.at < CACHE_TTL) { setLoading(false); return; }
      }
      setLoading(true);
      void fetch(`/api/admin/content-management?eventId=${encodeURIComponent(eventId)}`, { cache: "no-store" })
        .then(async (response) => {
          const payload = await response.json() as { data?: ContentManagementData; error?: string };
          if (!response.ok || !payload.data) throw new Error(payload.error || "内容读取失败。");
          if (currentRequest !== requestId.current) return;
          cache.set(eventId, { data: payload.data, at: Date.now() });
          setData(payload.data);
          replaceUrl(eventId);
        })
        .catch((failure) => {
          if (currentRequest !== requestId.current) return;
          setError(failure instanceof Error ? failure.message : "内容读取失败。");
          window.dispatchEvent(new CustomEvent("admin:event-switch-revert", { detail: { eventId: previousEventId } }));
        })
        .finally(() => { if (currentRequest === requestId.current) setLoading(false); });
    };
    window.addEventListener("admin:event-switch", onSwitch);
    return () => window.removeEventListener("admin:event-switch", onSwitch);
  }, [data.event.id]);

  return <div className={loading ? "admin-local-workspace is-refreshing" : "admin-local-workspace"}>
    {loading && <div className="admin-local-refresh"><i />正在切换赛事内容…</div>}
    {error && <div className="admin-local-error">{error}</div>}
    <ContentManagementClient key={data.event.id} initialData={data} />
  </div>;
}
