"use client";

import { useEffect, useRef, useState } from "react";
import type { EventManagementData } from "@/db/event-management";
import type { EventWorkflowSummary } from "@/db/event-workflow";
import EventManagementClient from "./event-management-client";

const cache = new Map<string, { data: EventManagementData; workflow: EventWorkflowSummary; at: number }>();

function replaceUrl(eventId: string) {
  window.history.replaceState(window.history.state, "", `/admin/events/${encodeURIComponent(eventId)}`);
}

async function fetchEventWorkspace(eventId: string) {
  const [eventResponse, workflowResponse] = await Promise.all([
    fetch(`/api/admin/event-management?eventId=${encodeURIComponent(eventId)}`, { cache: "no-store" }),
    fetch(`/api/admin/workflow-summary?event=${encodeURIComponent(eventId)}`, { cache: "no-store" }),
  ]);
  const eventPayload = await eventResponse.json() as { data?: EventManagementData; error?: string };
  const workflowPayload = await workflowResponse.json() as { data?: EventWorkflowSummary; error?: string };
  if (!eventResponse.ok || !eventPayload.data) throw new Error(eventPayload.error || "赛事资料读取失败。");
  if (!workflowResponse.ok || !workflowPayload.data) throw new Error(workflowPayload.error || "赛事流程状态读取失败。");
  return { data: eventPayload.data, workflow: workflowPayload.data };
}

export default function EventEventWorkspaceClient({ initialData, initialWorkflow }: { initialData: EventManagementData; initialWorkflow: EventWorkflowSummary }) {
  const [data, setData] = useState(initialData);
  const [workflow, setWorkflow] = useState(initialWorkflow);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  useEffect(() => { cache.set(initialData.event.id, { data: initialData, workflow: initialWorkflow, at: Date.now() }); }, [initialData, initialWorkflow]);

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
        setWorkflow(cached.workflow);
        replaceUrl(eventId);
      }
      setLoading(true);
      void fetchEventWorkspace(eventId)
        .then((next) => {
          if (currentRequest !== requestId.current) return;
          cache.set(eventId, { ...next, at: Date.now() });
          setData(next.data);
          setWorkflow(next.workflow);
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
    {loading && <div className="admin-local-refresh"><i />正在同步赛事设置与流程状态…</div>}
    {error && <div className="admin-local-error">{error}{cache.has(data.event.id) ? " 当前显示上一次读取的数据。" : ""}</div>}
    <EventManagementClient key={editorKey} initialData={data} initialWorkflow={workflow} />
  </div>;
}
