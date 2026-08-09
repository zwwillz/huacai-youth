"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { eventStatusLabel } from "./admin-status";
import type { AdminDashboardSummary } from "@/db/admin-structure-first";

type Props = { viewerRole: string };

type CachedSummary = { data: AdminDashboardSummary; at: number };
let persistedSummary: CachedSummary | null = null;
let summaryRequest: Promise<AdminDashboardSummary> | null = null;

async function loadSummary() {
  if (summaryRequest) return summaryRequest;
  summaryRequest = fetch("/api/admin/dashboard-summary", { cache: "no-store" })
    .then(async (response) => {
      const payload = await response.json() as { data?: AdminDashboardSummary; error?: string };
      if (response.status === 401) {
        window.location.assign("/admin/login");
        throw new Error("登录状态已失效，请重新登录。");
      }
      if (!response.ok || !payload.data) throw new Error(payload.error || "工作台数据读取失败。");
      persistedSummary = { data: payload.data, at: Date.now() };
      return payload.data;
    })
    .finally(() => { summaryRequest = null; });
  return summaryRequest;
}

function Metric({ label, value, hint, loading }: { label: string; value?: number; hint: string; loading: boolean }) {
  return <article>
    <span>{label}</span>
    <strong className={loading ? "admin-home-metric-value is-loading" : "admin-home-metric-value"}>{loading ? "—" : value ?? 0}</strong>
    <small>{hint}</small>
  </article>;
}

export default function DashboardClient({ viewerRole }: Props) {
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(() => persistedSummary?.data ?? null);
  const [loading, setLoading] = useState(!persistedSummary);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      setError("");
      if (!persistedSummary) setLoading(true);
      try {
        const next = await loadSummary();
        if (!cancelled) setSummary(next);
      } catch (failure) {
        if (!cancelled) setError(failure instanceof Error ? failure.message : "工作台数据读取失败。");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void refresh();
    return () => { cancelled = true; };
  }, []);

  const recentEvents = summary?.recentEvents ?? [];
  const currentEventId = recentEvents[0]?.id;
  const primary = viewerRole === "system_admin"
    ? { href: "/admin/events/new", label: "＋ 创建新赛事" }
    : viewerRole === "referee"
      ? { href: currentEventId ? `/admin/competition/scoring?event=${encodeURIComponent(currentEventId)}` : "/admin/competition/scoring", label: "进入比分录入" }
      : { href: currentEventId ? `/admin/competition?event=${encodeURIComponent(currentEventId)}` : "/admin/competition", label: "进入当前赛事" };
  const eventHref = (eventId: string) => viewerRole === "referee"
    ? `/admin/competition/scoring?event=${encodeURIComponent(eventId)}`
    : `/admin/competition?event=${encodeURIComponent(eventId)}`;

  return <main className="admin-home">
    <section className="admin-home-hero">
      <div><small>HUACAI EVENT ADMIN</small><h2>华彩赛事管理后台</h2><p>{viewerRole === "referee" ? "这里只显示分配给你的赛事。进入比分录入后，默认只看当前需要处理的比赛。" : "先选择一场赛事，再按内容发布、抽签、赛程、比分、晋级和排名的顺序处理。"}</p></div>
      <Link prefetch={false} href={primary.href}>{primary.label}</Link>
    </section>

    <section className="admin-home-metrics">
      <Metric label="可管理赛事" value={summary?.metrics.eventCount} loading={!summary} hint={viewerRole === "system_admin" ? "系统内全部赛事" : "已分配给当前账号"} />
      <Metric label="进行中赛事" value={summary?.metrics.activeEventCount} loading={!summary} hint="报名中或比赛中" />
      <Metric label="待审核报名" value={summary?.metrics.pendingRegistrationCount} loading={!summary} hint="后续报名模块接入后处理" />
      <Metric label="待发布内容" value={summary?.metrics.draftPublicationCount} loading={!summary} hint="仍处于草稿状态" />
    </section>

    {error && <div className="admin-home-inline-error">{error} 页面结构与常用入口仍可继续使用。</div>}

    <section className="admin-home-grid">
      <article className="admin-home-panel">
        <header><div><small>MY EVENTS</small><h3>{viewerRole === "system_admin" ? "最近赛事" : "已分配赛事"}</h3></div>{viewerRole === "system_admin" && <Link prefetch={false} href="/admin/events">查看全部赛事 →</Link>}</header>
        {recentEvents.length ? recentEvents.map((event) => <div className="admin-home-event" key={event.id}>
          <span>{event.stationNo}</span>
          <div><strong>{event.shortTitle}</strong><small>{event.city} · {event.venueName || "场馆待设置"} · {event.startDate} — {event.endDate}</small></div>
          <Link prefetch={false} href={eventHref(event.id)}>{viewerRole === "referee" ? "录入比分" : "继续处理"}</Link>
        </div>) : loading ? <div className="admin-home-event-loading" aria-label="正在读取最近赛事">{Array.from({ length: 3 }, (_, index) => <i key={index} />)}</div> : <div className="admin-simple-empty">{viewerRole === "system_admin" ? "尚未创建赛事。" : "当前账号尚未分配赛事，请联系系统管理员。"}</div>}
      </article>

      <article className="admin-home-panel">
        <header><div><small>NEXT ACTION</small><h3>常用入口</h3></div></header>
        <div className="admin-home-links">
          {viewerRole === "system_admin" && <Link prefetch={false} href="/admin/events"><span>赛事管理</span><b>创建 / 设置 →</b></Link>}
          {viewerRole !== "referee" && <Link prefetch={false} href={currentEventId ? `/admin/content/${currentEventId}` : "/admin/content"}><span>内容发布</span><b>概览 / 规程 →</b></Link>}
          <Link prefetch={false} href={currentEventId ? `/admin/competition?event=${encodeURIComponent(currentEventId)}` : "/admin/competition"}><span>竞赛执行</span><b>查看当前待办 →</b></Link>
          <Link prefetch={false} href={currentEventId ? `/admin/competition/scoring?event=${encodeURIComponent(currentEventId)}` : "/admin/competition/scoring"}><span>比分录入</span><b>进入工作台 →</b></Link>
        </div>
      </article>
    </section>
  </main>;
}
