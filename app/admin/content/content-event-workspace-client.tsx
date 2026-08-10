"use client";

import { useEffect, useRef, useState } from "react";
import type { ContentManagementData } from "@/db/content-management";
import type { EventManagementData } from "@/db/event-management";
import ContentManagementClient from "./content-management-client";

type Bundle = { content: ContentManagementData; event: EventManagementData; at: number };
const cache = new Map<string, Bundle>();

function replaceUrl(eventId: string) {
  window.history.replaceState(window.history.state, "", `/admin/content/${encodeURIComponent(eventId)}`);
}

export default function ContentEventWorkspaceClient({ initialData, initialEventData }: { initialData: ContentManagementData; initialEventData: EventManagementData }) {
  const [bundle, setBundle] = useState<Bundle>({ content: initialData, event: initialEventData, at: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  useEffect(() => {
    const next = { content: initialData, event: initialEventData, at: Date.now() };
    cache.set(initialData.event.id, next);
  }, [initialData, initialEventData]);

  useEffect(() => {
    const onSwitch = (event: Event) => {
      const detail = (event as CustomEvent<{ eventId?: string; previousEventId?: string; active?: string }>).detail;
      if (detail?.active !== "content" || !detail.eventId || detail.eventId === bundle.content.event.id) return;
      const eventId = detail.eventId;
      const previousEventId = detail.previousEventId || bundle.content.event.id;
      const currentRequest = ++requestId.current;
      const cached = cache.get(eventId);
      const restoredFromCache = Boolean(cached);
      setError("");
      if (cached) { setBundle(cached); replaceUrl(eventId); }
      setLoading(true);

      void Promise.all([
        fetch(`/api/admin/content-management?eventId=${encodeURIComponent(eventId)}`, { cache: "no-store" }),
        fetch(`/api/admin/event-management?eventId=${encodeURIComponent(eventId)}`, { cache: "no-store" }),
      ]).then(async ([contentResponse, eventResponse]) => {
        const contentPayload = await contentResponse.json() as { data?: ContentManagementData; error?: string };
        const eventPayload = await eventResponse.json() as { data?: EventManagementData; error?: string };
        if (!contentResponse.ok || !contentPayload.data) throw new Error(contentPayload.error || "内容读取失败。");
        if (!eventResponse.ok || !eventPayload.data) throw new Error(eventPayload.error || "赛事概览资料读取失败。");
        if (currentRequest !== requestId.current) return;
        const next = { content: contentPayload.data, event: eventPayload.data, at: Date.now() };
        cache.set(eventId, next);
        setBundle(next);
        replaceUrl(eventId);
      }).catch((failure) => {
        if (currentRequest !== requestId.current) return;
        setError(failure instanceof Error ? failure.message : "内容读取失败。");
        if (!restoredFromCache) window.dispatchEvent(new CustomEvent("admin:event-switch-revert", { detail: { eventId: previousEventId } }));
      }).finally(() => { if (currentRequest === requestId.current) setLoading(false); });
    };
    window.addEventListener("admin:event-switch", onSwitch);
    return () => window.removeEventListener("admin:event-switch", onSwitch);
  }, [bundle.content.event.id]);

  const editorKey = `${bundle.content.event.id}:${bundle.at}`;
  return <div className={loading ? "admin-local-workspace is-refreshing" : "admin-local-workspace"}>
    {loading && <div className="admin-local-refresh"><i />正在同步赛事运营内容…</div>}
    {error && <div className="admin-local-error">{error}{cache.has(bundle.content.event.id) ? " 当前显示上一次读取的数据。" : ""}</div>}
    <ContentManagementClient key={editorKey} initialData={bundle.content} initialEventData={bundle.event} />
  </div>;
}