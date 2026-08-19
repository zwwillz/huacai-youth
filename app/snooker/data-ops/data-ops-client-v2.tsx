"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import SyncCenterV2, { type CronJob, type RankingRow, type SyncTask } from "./sync-center-v2";
import styles from "./data-ops.module.css";

type Viewer = { username: string; displayName: string; mustChangePassword: boolean };
type Overview = { databaseSize: string; databaseBytes: number; events: number; matches: number; frames: number; breaks: number; players: number; currentTourPlayers: number; careerAggregates: number; h2hPairs: number; titles: number; warehouseStart: string | null; warehouseEnd: string | null };
type SeasonRow = { season: string; events: number; matches: number; frames: number; breaks: number; centuries: number; maximums: number; framesCompleteMatches: number; walkovers: number; seasonPlayerRows: number; avgFrameCoverage: number; calculatedAt: string | null };
type AnalyticsRow = { key: string; label: string; table: string; rows: number; updatedAt: string | null };
type AuditRow = { season: string; status: string; finishedAt: string | null; metrics: Record<string, unknown> | null };
type Quality = { currentTourMissingAvatar: number; currentTourMissingChineseName: number; completedWstEventsMissingSourceId: number; completedMatchesWithoutFrames: number; currentRankingListsNotSynced: number; rankingConflictsOpen: number };
type SyncLog = { id: string; source_name: string; job_type: string; status: string; started_at: string; finished_at: string | null; fetched_count: number | null; changed_count: number | null; error_message: string | null; event_name: string | null };
type AnalyticsLog = { id: number; run_type: string; scope_type: string | null; scope_value: string | null; aggregation_version: string; status: string; started_at: string; finished_at: string | null; metrics: Record<string, unknown> | null; error_message: string | null };
type ActionLog = { id: number; action: string; status: string; payload: Record<string, unknown>; result: Record<string, unknown> | null; error_message: string | null; started_at: string; finished_at: string | null };
export type DataOpsSnapshot = { ok: true; generatedAt: string; overview: Overview; seasons: SeasonRow[]; analytics: AnalyticsRow[]; rankings: RankingRow[]; syncTasks: SyncTask[]; cronJobs: CronJob[]; syncLogs: SyncLog[]; analyticsLogs: AnalyticsLog[]; actionLogs: ActionLog[]; audits: AuditRow[]; quality: Quality };
type Tab = "overview" | "analytics" | "sync" | "quality" | "logs";

const tabs: Array<{ key: Tab; label: string; short: string }> = [
  { key: "overview", label: "数据概览", short: "概览" },
  { key: "analytics", label: "Analytics Engine", short: "Analytics" },
  { key: "sync", label: "数据同步", short: "同步" },
  { key: "quality", label: "数据质量", short: "质量" },
  { key: "logs", label: "运行日志", short: "日志" },
];
const nf = new Intl.NumberFormat("zh-CN");
const num = (value: number | null | undefined) => nf.format(value || 0);
function time(value: string | null | undefined) { if (!value) return "—"; return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)); }
function intervalText(seconds: number | null | undefined) { if (!seconds) return "—"; if (seconds < 60) return `${seconds} 秒`; if (seconds < 3600) return `${Math.round(seconds / 60)} 分钟`; if (seconds < 86400) return `${Math.round(seconds / 3600)} 小时`; return `${Math.round(seconds / 86400)} 天`; }
function coverageTone(value: number) { if (value >= 95) return styles.toneGood; if (value >= 60) return styles.toneWarn; return styles.toneInfo; }
function statusTone(status: string) { if (["success", "completed", "synced", "active"].includes(status)) return styles.toneGood; if (["partial", "pending", "running", "skipped"].includes(status)) return styles.toneWarn; if (["failed", "unavailable", "disabled"].includes(status)) return styles.toneBad; return styles.toneMuted; }

export default function DataOpsClientV2({ initialViewer, initialSnapshot }: { initialViewer: Viewer | null; initialSnapshot: DataOpsSnapshot | null }) {
  const [viewer, setViewer] = useState<Viewer | null>(initialViewer);
  const [snapshot, setSnapshot] = useState<DataOpsSnapshot | null>(initialSnapshot);
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadSnapshot = useCallback(async (showLoading = false) => {
    if (!viewer || viewer.mustChangePassword) return;
    if (showLoading) setLoading(true);
    try {
      const response = await fetch("/api/snooker/data-ops/snapshot", { cache: "no-store" });
      if (response.status === 401) { setViewer(null); setSnapshot(null); return; }
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "数据读取失败。");
      setSnapshot(body as DataOpsSnapshot);
      if (showLoading) setError("");
    } catch (e) { if (showLoading) setError(e instanceof Error ? e.message : "数据读取失败。"); }
    finally { if (showLoading) setLoading(false); }
  }, [viewer]);

  useEffect(() => {
    if (!viewer || viewer.mustChangePassword || !snapshot) return;
    const monitor = snapshot.syncTasks?.find((task) => task.jobKey === "site_monitor");
    if (!monitor?.enabled || !monitor.intervalSeconds) return;
    const timer = window.setInterval(() => { void loadSnapshot(false); }, monitor.intervalSeconds * 1000);
    return () => window.clearInterval(timer);
  }, [viewer, snapshot, loadSnapshot]);

  async function logout() { await fetch("/api/snooker/data-ops/auth/logout", { method: "POST" }); setViewer(null); setSnapshot(null); setTab("overview"); }
  async function runAction(action: string, payload: Record<string, unknown> = {}, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setPendingAction(action); setMessage(""); setError("");
    try {
      const response = await fetch("/api/snooker/data-ops/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, payload }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "操作执行失败。");
      setMessage(action === "sync_policy_update" ? "同步配置已保存并立即生效。" : "操作已完成，状态已刷新。");
      await loadSnapshot(false);
    } catch (e) { setError(e instanceof Error ? e.message : "操作执行失败。"); }
    finally { setPendingAction(null); }
  }

  if (!viewer) return <LoginView onLogin={async (v) => { setViewer(v); if (!v.mustChangePassword) setTimeout(() => void loadSnapshot(false), 0); }} />;
  if (viewer.mustChangePassword) return <PasswordSetupView viewer={viewer} onChanged={(v) => { setViewer(v); setTimeout(() => void loadSnapshot(false), 0); }} onLogout={logout} />;

  const analyticsTask = snapshot?.syncTasks?.find((task) => task.jobKey === "analytics_current");
  return <main className={styles.root}>
    <header className={styles.topbar}>
      <div className={styles.brand}><span>147</span><div><strong>斯诺克数据运维中心</strong><small>SNOOKER DATA OPS · SYNC CENTER V2</small></div></div>
      <div className={styles.topActions}><span className={styles.viewer}><b>{viewer.displayName}</b><small>{viewer.username}</small></span><button className={styles.ghostButton} onClick={() => void loadSnapshot(true)} disabled={loading}>{loading ? "刷新中" : "刷新"}</button><button className={styles.logoutButton} onClick={() => void logout()}>退出</button></div>
    </header>
    <div className={styles.shell}>
      <section className={styles.pageHead}><div><small>DATA PLATFORM CONTROL CENTER</small><h1>数据运维中心</h1><p>统一查看事实仓库、Analytics、数据同步、质量审计与运行日志。</p></div><div className={styles.engineStatus}><i /><span><b>Sync Center v2 · Analytics v1</b><small>{snapshot ? `快照 ${time(snapshot.generatedAt)}` : "正在读取状态"}</small></span></div></section>
      <nav className={styles.tabs}>{tabs.map((item) => <button key={item.key} className={tab === item.key ? styles.tabActive : ""} onClick={() => setTab(item.key)}><span>{item.label}</span><em>{item.short}</em></button>)}</nav>
      {(message || error) && <div className={`${styles.notice} ${error ? styles.noticeError : styles.noticeGood}`}>{error || message}<button onClick={() => { setMessage(""); setError(""); }}>×</button></div>}
      {!snapshot ? <LoadingPanel onRetry={() => void loadSnapshot(true)} /> : <>
        {tab === "overview" && <OverviewTab snapshot={snapshot} />}
        {tab === "analytics" && <AnalyticsTab snapshot={snapshot} analyticsTask={analyticsTask} pendingAction={pendingAction} runAction={runAction} />}
        {tab === "sync" && <SyncCenterV2 tasks={snapshot.syncTasks || []} rankings={snapshot.rankings || []} cronJobs={snapshot.cronJobs || []} pendingAction={pendingAction} runAction={runAction} />}
        {tab === "quality" && <QualityTab snapshot={snapshot} pendingAction={pendingAction} runAction={runAction} />}
        {tab === "logs" && <LogsTab snapshot={snapshot} />}
      </>}
    </div>
  </main>;
}

function LoginView({ onLogin }: { onLogin: (viewer: Viewer) => void | Promise<void> }) {
  const [password, setPassword] = useState(""); const [pending, setPending] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent) { event.preventDefault(); setPending(true); setError(""); try { const response = await fetch("/api/snooker/data-ops/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "admin", password }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error || "登录失败。"); await onLogin(body.viewer as Viewer); } catch (e) { setError(e instanceof Error ? e.message : "登录失败。"); } finally { setPending(false); } }
  return <main className={styles.loginRoot}><section className={styles.loginCard}><div className={styles.loginBrand}><span>147</span><div><strong>世界斯诺克数据中心</strong><small>DATA OPERATIONS</small></div></div><div className={styles.loginCopy}><small>ADMIN CONSOLE</small><h1>数据运维中心</h1><p>Analytics、赛事、球员、排名、同步任务与数据质量的专用管理入口。</p></div><form className={styles.loginForm} onSubmit={submit}><label>管理员账号<input value="admin" readOnly /></label><label>密码<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="请输入管理员密码" autoFocus /></label>{error && <p className={styles.formError}>{error}</p>}<button type="submit" disabled={pending || !password}>{pending ? "正在验证…" : "登录数据运维中心"}</button></form><footer><span>独立 Snooker Admin</span><span>HttpOnly Session</span><a href="/snooker">返回前端</a></footer></section></main>;
}
function PasswordSetupView({ viewer, onChanged, onLogout }: { viewer: Viewer; onChanged: (viewer: Viewer) => void; onLogout: () => void }) {
  const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState(""); const [pending, setPending] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent) { event.preventDefault(); if (password !== confirm) { setError("两次输入的密码不一致。"); return; } setPending(true); setError(""); try { const response = await fetch("/api/snooker/data-ops/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error || "密码设置失败。"); onChanged(body.viewer as Viewer); } catch (e) { setError(e instanceof Error ? e.message : "密码设置失败。"); } finally { setPending(false); } }
  return <main className={styles.loginRoot}><section className={styles.loginCard}><div className={styles.loginBrand}><span>147</span><div><strong>首次登录安全设置</strong><small>{viewer.username}</small></div></div><div className={styles.loginCopy}><small>PASSWORD REQUIRED</small><h1>设置正式管理员密码</h1><p>临时密码仅用于首次进入。新密码设置完成后，临时密码立即失效。</p></div><form className={styles.loginForm} onSubmit={submit}><label>新密码<input type="password" autoComplete="new-password" minLength={8} maxLength={72} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8–72 个字符" autoFocus /></label><label>再次确认<input type="password" autoComplete="new-password" minLength={8} maxLength={72} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="再次输入新密码" /></label>{error && <p className={styles.formError}>{error}</p>}<button type="submit" disabled={pending || password.length < 8 || confirm.length < 8}>{pending ? "正在保存…" : "保存密码并进入"}</button></form><button className={styles.backButton} onClick={() => void onLogout()}>退出本次登录</button></section></main>;
}
function LoadingPanel({ onRetry }: { onRetry: () => void }) { return <section className={styles.loadingCard}><div className={styles.spinner} /><h2>正在读取数据平台状态</h2><p>正在汇总事实仓库、Analytics、同步任务与质量信息。</p><button onClick={onRetry}>重新加载</button></section>; }

function OverviewTab({ snapshot }: { snapshot: DataOpsSnapshot }) {
  const o = snapshot.overview; const cards = [["数据库", o.databaseSize, "PostgreSQL 总占用"], ["赛事", num(o.events), "全部赛事实体"], ["比赛", num(o.matches), "事实比赛记录"], ["局", num(o.frames), "Frame records"], ["50+", num(o.breaks), "Break records"], ["球员", num(o.players), `当前巡回 ${num(o.currentTourPlayers)}`], ["生涯聚合", num(o.careerAggregates), "Calculated players"], ["H2H", num(o.h2hPairs), "球员对组合"]];
  return <div className={styles.stack}><section className={styles.metricGrid}>{cards.map(([label, value, hint]) => <article className={styles.metricCard} key={label}><small>{label}</small><strong>{value}</strong><span>{hint}</span></article>)}</section><Panel title="历史数据仓库" eyebrow="FACT WAREHOUSE" side={`${o.warehouseStart || "—"} → ${o.warehouseEnd || "—"}`}><SeasonTable rows={snapshot.seasons} /></Panel><Panel title="数据来源与职责" eyebrow="SOURCE OF TRUTH"><div className={styles.sourceGrid}><SourceCard name="WST" badge="OFFICIAL" text="当前赛事、赛程、比赛、实时比分、逐局和球员官方资料。" /><SourceCard name="WPBSA" badge="RANKINGS" text="世界排名、临时排名、赛季末预测和资格 Race 的官方优先来源。" /><SourceCard name="CueTracker" badge="HISTORY" text="WST 历史结构化数据不足时的历史比赛、逐局和 Break 补档。" /><SourceCard name="Analytics Engine" badge="CALCULATED" text="由本站事实仓库重算赛季、生涯、冠军、技术指标和 H2H。" /></div></Panel></div>;
}
function AnalyticsTab({ snapshot, analyticsTask, pendingAction, runAction }: { snapshot: DataOpsSnapshot; analyticsTask?: SyncTask; pendingAction: string | null; runAction: (action: string, payload?: Record<string, unknown>, confirmText?: string) => Promise<void> }) {
  const seasons = snapshot.seasons.map((row) => row.season); const [season, setSeason] = useState(seasons[0] || "2026/27");
  return <div className={styles.stack}><section className={styles.engineHero}><div><small>ANALYTICS ENGINE</small><h2>v1.0.0</h2><p>事实层 → 聚合层 → 产品数据。自动任务默认 {intervalText(analyticsTask?.intervalSeconds)}；事实层无变化时自动跳过重算。</p></div><div className={styles.engineHeroStatus}><i /><b>{analyticsTask?.enabled ? "自动运行" : "仅手动"}</b><span>上次成功 {time(analyticsTask?.lastSuccessAt)}</span></div></section><Panel title="聚合数据表" eyebrow="PRODUCT DATA"><div className={styles.analyticsGrid}>{snapshot.analytics.map((row) => <article key={row.key}><div><small>{row.label}</small><b>{row.table}</b></div><strong>{num(row.rows)}</strong><span>最后计算 {time(row.updatedAt)}</span></article>)}</div></Panel><Panel title="手动操作" eyebrow="CONTROL" side="历史重建需二次确认"><div className={styles.actionGrid}><ActionCard title="刷新当前赛季" text="立即强制重算当前赛季，即使事实层没有变化也会执行。" button="立即刷新" pending={pendingAction === "analytics_refresh_current"} onClick={() => runAction("analytics_refresh_current")} /><ActionCard title="数据一致性审计" text="核对事实层与聚合层的比赛参与、破百等关键指标。" button="立即审计" pending={pendingAction === "analytics_audit"} onClick={() => runAction("analytics_audit")} /><article className={styles.actionCard}><small>REBUILD SEASON</small><h3>重建指定赛季</h3><p>历史补档、算法升级或数据修复后执行。</p><div className={styles.inlineAction}><select value={season} onChange={(e) => setSeason(e.target.value)}>{seasons.map((s) => <option key={s}>{s}</option>)}</select><button disabled={pendingAction === "analytics_rebuild_season"} onClick={() => void runAction("analytics_rebuild_season", { season }, `确认重新计算 ${season}？`)}>重建</button></div></article><ActionCard title="重建生涯统计" text="重新汇总全部球员已入库赛季的生涯数据。" button="重建生涯" danger pending={pendingAction === "analytics_rebuild_career"} onClick={() => runAction("analytics_rebuild_career", {}, "确认重建全部球员生涯统计？")} /><ActionCard title="重建 H2H" text="重新计算全部球员对的历史交手汇总。" button="重建 H2H" danger pending={pendingAction === "analytics_rebuild_h2h"} onClick={() => runAction("analytics_rebuild_h2h", {}, "确认重建全部 H2H？")} /></div></Panel></div>;
}
function QualityTab({ snapshot, pendingAction, runAction }: { snapshot: DataOpsSnapshot; pendingAction: string | null; runAction: (action: string, payload?: Record<string, unknown>, confirmText?: string) => Promise<void> }) {
  const q = snapshot.quality; const metrics = [["当前球员缺头像", q.currentTourMissingAvatar, "需补充"], ["当前球员缺中文名", q.currentTourMissingChineseName, "需补充"], ["WST完赛赛事缺Source ID", q.completedWstEventsMissingSourceId, "检查"], ["比赛无逐局记录", q.completedMatchesWithoutFrames, "含源数据不提供"], ["当前排名未完全同步", q.currentRankingListsNotSynced, "Partial/Pending"], ["排名冲突未处理", q.rankingConflictsOpen, "待核对"]] as const;
  return <div className={styles.stack}><section className={styles.metricGrid}>{metrics.map(([label, value, hint]) => <article className={styles.metricCard} key={label}><small>{label}</small><strong>{num(value)}</strong><span>{value === 0 ? "正常" : hint}</span></article>)}</section><Panel title="赛季数据覆盖" eyebrow="COVERAGE"><SeasonTable rows={snapshot.seasons} quality /></Panel><Panel title="Analytics 审计" eyebrow="FACT ↔ AGGREGATE"><div className={styles.auditRows}>{snapshot.audits.map((row) => { const matchOk = row.metrics?.matches_ok === true; const centuryOk = row.metrics?.centuries_ok === true; const pass = row.status === "completed" && matchOk && centuryOk; return <article key={row.season}><b>{row.season}</b><span>比赛参与 {matchOk ? "PASS" : "CHECK"}</span><span>破百 {centuryOk ? "PASS" : "CHECK"}</span><span className={`${styles.badge} ${pass ? styles.toneGood : styles.toneWarn}`}>{pass ? "PASS" : "CHECK"}</span><time>{time(row.finishedAt)}</time></article>; })}</div><div className={styles.qualityAction}><p>“源数据逐局覆盖不足”不等于同步失败。历史页面没有 Frame History 时，比赛比分仍然保留。</p><button disabled={pendingAction === "analytics_audit"} onClick={() => void runAction("analytics_audit")}>立即重新审计</button></div></Panel></div>;
}
function LogsTab({ snapshot }: { snapshot: DataOpsSnapshot }) { return <div className={styles.stack}><Panel title="数据同步日志" eyebrow="SYNC RUNS"><LogTable rows={snapshot.syncLogs.map((row) => ({ time: row.started_at, type: `${row.source_name} · ${row.job_type}`, scope: row.event_name || "全局", status: row.status, detail: `读取 ${num(row.fetched_count)} / 变更 ${num(row.changed_count)}`, error: row.error_message }))} /></Panel><Panel title="Analytics 日志" eyebrow="ANALYTICS RUNS"><LogTable rows={snapshot.analyticsLogs.map((row) => ({ time: row.started_at, type: row.run_type, scope: row.scope_value || row.scope_type || "全局", status: row.status, detail: `v${row.aggregation_version}`, error: row.error_message }))} /></Panel><Panel title="后台手动操作" eyebrow="ADMIN ACTIONS"><LogTable rows={snapshot.actionLogs.map((row) => ({ time: row.started_at, type: row.action, scope: Object.keys(row.payload || {}).length ? JSON.stringify(row.payload) : "全局", status: row.status, detail: row.finished_at ? `完成 ${time(row.finished_at)}` : "执行中", error: row.error_message }))} empty="尚无手动操作记录。" /></Panel></div>; }

function Panel({ title, eyebrow, side, children }: { title: string; eyebrow: string; side?: string; children: React.ReactNode }) { return <section className={styles.panel}><header><div><small>{eyebrow}</small><h2>{title}</h2></div>{side && <span>{side}</span>}</header>{children}</section>; }
function SourceCard({ name, badge, text }: { name: string; badge: string; text: string }) { return <article className={styles.sourceCard}><span>{badge}</span><h3>{name}</h3><p>{text}</p></article>; }
function ActionCard({ title, text, button, pending, danger, onClick }: { title: string; text: string; button: string; pending: boolean; danger?: boolean; onClick: () => void | Promise<void> }) { return <article className={styles.actionCard}><small>{danger ? "ADVANCED" : "ACTION"}</small><h3>{title}</h3><p>{text}</p><button className={danger ? styles.dangerButton : ""} disabled={pending} onClick={() => void onClick()}>{pending ? "执行中…" : button}</button></article>; }
function SeasonTable({ rows, quality = false }: { rows: SeasonRow[]; quality?: boolean }) { return <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>赛季</th><th>赛事</th><th>比赛</th><th>局</th><th>50+</th><th>破百</th><th>147</th><th>Frame覆盖</th>{quality && <th>质量状态</th>}</tr></thead><tbody>{rows.map((row) => <tr key={row.season}><td><b>{row.season}</b></td><td>{num(row.events)}</td><td>{num(row.matches)}</td><td>{num(row.frames)}</td><td>{num(row.breaks)}</td><td>{num(row.centuries)}</td><td>{num(row.maximums)}</td><td><span className={`${styles.badge} ${coverageTone(Number(row.avgFrameCoverage))}`}>{Number(row.avgFrameCoverage).toFixed(1)}%</span></td>{quality && <td><span className={`${styles.badge} ${coverageTone(Number(row.avgFrameCoverage))}`}>{row.avgFrameCoverage >= 95 ? "完整" : row.avgFrameCoverage >= 60 ? "部分覆盖" : "源数据有限"}</span></td>}</tr>)}</tbody></table></div>; }
function LogTable({ rows, empty = "暂无日志。" }: { rows: Array<{ time: string; type: string; scope: string; status: string; detail: string; error: string | null }>; empty?: string }) { if (!rows.length) return <div className={styles.empty}>{empty}</div>; return <div className={styles.logRows}>{rows.map((row, index) => <article key={`${row.time}-${index}`}><time>{time(row.time)}</time><div><b>{row.type}</b><small>{row.scope}</small></div><span>{row.detail}</span><span className={`${styles.badge} ${statusTone(row.status)}`}>{row.status}</span>{row.error && <p>{row.error}</p>}</article>)}</div>; }
