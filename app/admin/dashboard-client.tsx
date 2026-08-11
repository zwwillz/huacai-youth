"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { AdminDashboardSummary } from "@/db/admin-structure-first";
import type { EventWorkflowSummary, WorkflowNextAction } from "@/db/event-workflow";
import { useAdminActionDialog } from "./admin-action-dialog";

type Props = { viewerKey: string; viewerRole: string };
type CachedSummary = { data: AdminDashboardSummary; at: number };
const persistedSummaries = new Map<string, CachedSummary>();
const summaryRequests = new Map<string, Promise<AdminDashboardSummary>>();

function cacheKey(viewerKey: string, eventId = "") { return `${viewerKey}|${eventId}`; }
async function loadSummary(viewerKey: string, eventId = "", force = false) {
  const key = cacheKey(viewerKey, eventId);
  if (!force) {
    const cached = persistedSummaries.get(key);
    if (cached && Date.now() - cached.at < 30_000) return cached.data;
  }
  const existing = summaryRequests.get(key);
  if (existing) return existing;
  const url = eventId ? `/api/admin/dashboard-summary?event=${encodeURIComponent(eventId)}` : "/api/admin/dashboard-summary";
  const request = fetch(url, { cache: "no-store" })
    .then(async (response) => {
      const payload = await response.json() as { data?: AdminDashboardSummary; error?: string };
      if (response.status === 401) {
        persistedSummaries.clear();
        window.location.assign("/admin/login");
        throw new Error("登录状态已失效，请重新登录。");
      }
      if (!response.ok || !payload.data) throw new Error(payload.error || "工作台数据读取失败。");
      persistedSummaries.set(key, { data: payload.data, at: Date.now() });
      return payload.data;
    })
    .finally(() => { summaryRequests.delete(key); });
  summaryRequests.set(key, request);
  return request;
}

function Metric({ label, value, hint, loading }: { label: string; value?: number; hint: string; loading: boolean }) {
  return <article><span>{label}</span><strong className={loading ? "admin-home-metric-value is-loading" : "admin-home-metric-value"}>{loading ? "—" : value ?? 0}</strong><small>{hint}</small></article>;
}
function publicationLabel(status: string) { return status === "published" ? "已发布" : "未发布"; }
function rosterLabel(status: string) { return status === "locked" ? "已锁定" : status === "confirmed" ? "已确认" : "待确认"; }
function lifecycleProgress(workflow: EventWorkflowSummary) {
  if (workflow.event.status === "archived") return 6;
  if (workflow.event.status === "finished") return 5;
  if (workflow.event.status === "in_progress") return 4;
  if (workflow.event.status === "registration_closed") return workflow.groups.some((group) => group.roster.status === "locked") ? 3 : 2;
  if (workflow.event.status === "registration_open") return 1;
  return 0;
}
const FLOW_STEPS = ["赛事准备", "开放报名", "报名截止", "正式名单", "竞赛执行", "赛事收尾", "已归档"];
const ACTION_CONFIRM: Record<string, { title: string; description: string; label: string; danger?: boolean }> = {
  open_registration: { title: "开放赛事报名", description: "系统会再次检查赛事基础信息、参赛组别、报名时间、报名入口和已发布赛事概览。", label: "确认开放报名" },
  close_registration: { title: "确认报名截止", description: "结束报名后用户端不再提供报名入口，但报名审核仍可继续进行。", label: "确认结束报名" },
  start_competition: { title: "正式开始比赛", description: "至少一个组别的名单已锁定并产生正式竞赛数据后，赛事可进入“比赛中”。", label: "确认开始比赛" },
  finish_event: { title: "结束赛事", description: "少年组和青年组最终排名必须已经确认。排名是否发布会提示，但不会阻断正常结束。", label: "确认结束赛事" },
  archive: { title: "归档赛事", description: "归档后后台进入历史只读状态；归档不等于前端隐藏，也不会删除已经发布的数据。", label: "确认归档", danger: true },
};

function CurrentAction({ workflow, working, onLifecycle }: { workflow: EventWorkflowSummary; working: boolean; onLifecycle: (action: WorkflowNextAction) => void }) {
  const action = workflow.nextAction;
  const blocker = workflow.blockers.length > 0 || action.priority >= 95;
  return <section className={blocker ? "admin-command-action blocker" : "admin-command-action"}>
    <div><small>CURRENT ACTION</small><h3>{action.title}</h3><p>{action.description}</p>{workflow.blockers.length > 0 && <ul>{workflow.blockers.slice(0, 3).map((item) => <li key={item}>{item}</li>)}</ul>}</div>
    {action.kind === "link" && action.href ? <Link prefetch={false} href={action.href}>进入处理</Link> : action.kind === "lifecycle" ? <button type="button" disabled={working} onClick={() => onLifecycle(action)}>{working ? "正在处理…" : action.title}</button> : null}
  </section>;
}

export default function DashboardClient({ viewerKey, viewerRole }: Props) {
  const initialCached = persistedSummaries.get(cacheKey(viewerKey))?.data ?? null;
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(() => initialCached);
  const [loading, setLoading] = useState(!initialCached);
  const [switching, setSwitching] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const { ask, dialog } = useAdminActionDialog();

  useEffect(() => {
    let cancelled = false;
    const eventId = new URL(window.location.href).searchParams.get("event") || "";
    void loadSummary(viewerKey, eventId).then((next) => {
      if (!cancelled) { setSummary(next); setError(""); }
    }).catch((failure) => {
      if (!cancelled) setError(failure instanceof Error ? failure.message : "工作台数据读取失败。");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [viewerKey]);

  const workflow = summary?.currentWorkflow ?? null;
  const currentEventId = workflow?.event.id || "";
  const eventOptions = summary?.eventOptions ?? [];
  const progress = workflow ? lifecycleProgress(workflow) : 0;
  const primary = viewerRole === "system_admin" ? { href: "/admin/events/new", label: "＋ 创建新赛事" } : null;
  const roleCopy = viewerRole === "referee"
    ? "系统会优先显示你当前可以执行的比赛任务；赛事运营与生命周期推进仍由组委会负责。"
    : "系统会根据赛事当前进度告诉你下一步需要处理的工作。";

  const selectEvent = async (eventId: string) => {
    if (!eventId || eventId === currentEventId || switching) return;
    setSwitching(true); setError("");
    try {
      const next = await loadSummary(viewerKey, eventId);
      setSummary(next);
      const url = new URL(window.location.href);
      url.searchParams.set("event", eventId);
      window.history.replaceState(window.history.state, "", `${url.pathname}?${url.searchParams.toString()}`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "赛事状态读取失败。");
    } finally { setSwitching(false); }
  };

  const refresh = async () => {
    setSwitching(true); setError("");
    try { setSummary(await loadSummary(viewerKey, currentEventId, true)); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "赛事状态读取失败。"); }
    finally { setSwitching(false); }
  };

  const runLifecycle = async (action: WorkflowNextAction) => {
    if (!workflow || !action.lifecycleAction) return;
    const options = ACTION_CONFIRM[action.lifecycleAction] ?? { title: action.title, description: action.description, label: "确认执行" };
    const confirmed = await ask({ title: options.title, description: options.description, confirmLabel: options.label, tone: options.danger ? "danger" : "default" });
    if (!confirmed) return;
    setWorking(true); setError("");
    try {
      const response = await fetch(`/api/admin/events/${encodeURIComponent(workflow.event.id)}/lifecycle`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: action.lifecycleAction }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "赛事生命周期推进失败。");
      persistedSummaries.clear();
      setSummary(await loadSummary(viewerKey, workflow.event.id, true));
    } catch (failure) { setError(failure instanceof Error ? failure.message : "赛事生命周期推进失败。"); }
    finally { setWorking(false); }
  };

  const quickLinks = useMemo(() => {
    const eventParam = currentEventId ? `?event=${encodeURIComponent(currentEventId)}` : "";
    return [
      ...(viewerRole === "system_admin" ? [{ label: "赛事管理", hint: "创建 / 设置", href: "/admin/events" }] : []),
      ...(viewerRole !== "referee" ? [{ label: "内容发布", hint: "概览 / 规程", href: currentEventId ? `/admin/content/${currentEventId}` : "/admin/content" }] : []),
      { label: "竞赛执行", hint: "查看当前阶段", href: `/admin/competition${eventParam}` },
      { label: "比分录入", hint: "进入比赛工作区", href: `/admin/competition/scoring${eventParam}` },
    ];
  }, [currentEventId, viewerRole]);

  return <main className="admin-home">
    <section className="admin-home-hero">
      <div><small>HUACAI EVENT COMMAND</small><h2>华彩赛事管理后台</h2><p>{roleCopy}</p></div>
      {primary && <Link prefetch={false} href={primary.href}>{primary.label}</Link>}
    </section>

    {error && <div className="admin-home-inline-error">{error} <button type="button" onClick={refresh}>重新读取</button></div>}

    <section className="admin-command-context">
      <div className="admin-command-context-head">
        <div><small>当前重点赛事</small><h3>{workflow?.event.title || (loading ? "赛事状态正在读取" : "当前没有可管理赛事")}</h3><p>{workflow ? `${workflow.event.startDate} — ${workflow.event.endDate}` : "创建或分配赛事后，系统会在这里给出流程建议。"}</p></div>
        <label><span>切换赛事</span><select value={currentEventId} disabled={switching || !eventOptions.length} onChange={(event) => void selectEvent(event.target.value)}>{eventOptions.map((event) => <option key={event.id} value={event.id}>{event.title} · {event.lifecycleLabel}</option>)}</select></label>
      </div>
      {workflow && <div className="admin-command-status-grid">
        <article><span>生命周期</span><strong>{workflow.lifecycle.label}</strong><small>由赛事流程动作推进</small></article>
        <article><span>公众赛事</span><strong>{workflow.event.publishStatus === "published" && !workflow.event.isHidden ? "公开" : workflow.event.isHidden ? "已隐藏" : "未公开"}</strong><small>与生命周期独立</small></article>
        <article><span>赛事概览</span><strong>{publicationLabel(workflow.publications.overview)}</strong><small>正式内容</small></article>
        <article><span>报名信息</span><strong>{workflow.registration.timeState === "closed" && workflow.event.status === "registration_open" ? "时间已截止" : publicationLabel(workflow.publications.registration)}</strong><small>Publication + 时间</small></article>
        <article><span>主赛程</span><strong>{publicationLabel(workflow.publications.masterSchedule)}</strong><small>用户端总赛程</small></article>
      </div>}
    </section>

    {workflow ? <CurrentAction workflow={workflow} working={working} onLifecycle={runLifecycle} /> : <section className="admin-command-action loading"><div><small>CURRENT ACTION</small><h3>正在判断当前任务</h3><p>页面结构已经打开，赛事流程摘要会在这里补齐。</p></div></section>}

    {workflow && <section className="admin-command-flow"><header><div><small>EVENT WORKFLOW</small><h3>赛事总流程</h3></div><button type="button" disabled={switching} onClick={refresh}>{switching ? "刷新中…" : "刷新状态"}</button></header><div>{FLOW_STEPS.map((step, index) => <span className={index < progress ? "done" : index === progress ? "current" : "waiting"} key={step}><i>{index < progress ? "✓" : index + 1}</i><b>{step}</b></span>)}</div></section>}

    <section className="admin-command-groups">
      {(workflow?.groups ?? []).map((group) => <article key={group.groupId}>
        <header><div><small>{group.groupCode || "GROUP"}</small><h3>{group.groupName}</h3></div><b>{group.competition.label}</b></header>
        <dl><div><dt>报名人数</dt><dd>{group.roster.approvedCount}</dd></div><div><dt>正式名单</dt><dd>{rosterLabel(group.roster.status)}{group.roster.count ? ` · ${group.roster.count}人` : ""}</dd></div><div><dt>当前进度</dt><dd>{group.competition.label}</dd></div></dl>
        {group.nextAction?.href && <Link prefetch={false} href={group.nextAction.href}>{group.nextAction.title}</Link>}
      </article>)}
      {!workflow && Array.from({ length: 2 }, (_, index) => <article className="loading" key={index}><header><div><small>GROUP</small><h3>组别状态读取中</h3></div></header><p>报名、名单和竞赛进度将在原位置补齐。</p></article>)}
    </section>

    <section className="admin-home-metrics admin-command-secondary">
      <Metric label="可管理赛事" value={summary?.metrics.eventCount} loading={!summary} hint={viewerRole === "system_admin" ? "系统内全部赛事" : "已分配给当前账号"} />
      <Metric label="当前流程赛事" value={summary?.metrics.activeEventCount} loading={!summary} hint="报名中 / 报名截止 / 比赛中" />
      <Metric label="待审核报名" value={summary?.metrics.pendingRegistrationCount} loading={!summary} hint="当前可管理赛事的待审核记录" />
      <Metric label="待发布内容" value={summary?.metrics.draftPublicationCount} loading={!summary} hint="仍处于草稿状态的发布模块" />
    </section>

    <section className="admin-home-panel admin-command-tools"><header><div><small>QUICK TOOLS</small><h3>快捷工具</h3></div></header><div className="admin-home-links">{quickLinks.map((item) => <Link prefetch={false} href={item.href} key={item.label}><span>{item.label}</span><b>{item.hint} →</b></Link>)}</div></section>
    {dialog}
  </main>;
}
