"use client";

import styles from "./data-ops.module.css";

export type SyncTask = {
  jobKey: string;
  groupKey: string;
  displayNameZh: string | null;
  descriptionZh: string | null;
  sourceName: string | null;
  enabled: boolean;
  intervalSeconds: number;
  prestartIntervalSeconds: number | null;
  prestartWindowMinutes: number | null;
  scheduleMode: string;
  configurable: boolean;
  allowedIntervals: number[];
  sortOrder: number;
  parentJobKey: string | null;
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  lastSuccessAt: string | null;
  lastChangeAt: string | null;
  lastStatus: string | null;
  lastFetchedCount: number | null;
  lastChangedCount: number | null;
  lastDurationMs: number | null;
  consecutiveFailures: number;
  nextRunAt: string | null;
  lastMessage: string | null;
  lastError: string | null;
  lastResult: Record<string, unknown> | null;
};

export type RankingRow = {
  listKey: string;
  titleZh: string;
  sourceName: string;
  sourceUrl: string | null;
  isLive: boolean;
  isCurrent: boolean;
  syncStatus: string;
  latestCapturedAt: string | null;
};

export type CronJob = { jobId: number; jobName: string; schedule: string; command: string; active: boolean };

type Props = {
  tasks: SyncTask[];
  rankings: RankingRow[];
  cronJobs: CronJob[];
  pendingAction: string | null;
  runAction: (action: string, payload?: Record<string, unknown>, confirmText?: string) => Promise<void>;
};

const nf = new Intl.NumberFormat("zh-CN");
const groupMeta: Record<string, { label: string; eyebrow: string; text: string }> = {
  events: { label: "赛事与比赛", eyebrow: "EVENTS & MATCHES", text: "WST 赛事目录、未来赛程、实时比赛与赛后最终确认。比赛 Finalize 后自动退出实时同步。" },
  players: { label: "球员数据", eyebrow: "PLAYERS", text: "WST 球员目录、个人资料，以及随资料同步的官方赛季和职业生涯统计。" },
  rankings: { label: "排名数据", eyebrow: "RANKINGS", text: "WPBSA 为排名主源。全部排名任务统一调度，单榜可以独立开关和手动同步。" },
  analytics: { label: "Analytics", eyebrow: "CALCULATED DATA", text: "将事实仓库转换为产品统计。默认每天一次；事实层没有变化时自动跳过重算。" },
  system: { label: "系统监控", eyebrow: "SYSTEM", text: "控制台刷新和调度器运行状态。这一组不属于外部数据同步。" },
};

function fmtTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}
function fmtInterval(seconds: number | null | undefined) {
  if (!seconds) return "—";
  if (seconds < 60) return `${seconds} 秒`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} 分钟`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} 小时`;
  return `${Math.round(seconds / 86400)} 天`;
}
function fmtDuration(ms: number | null | undefined) {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(ms >= 10000 ? 0 : 1)} s`;
}
function tone(status: string | null | undefined) {
  if (["success", "synced", "completed"].includes(status || "")) return styles.toneGood;
  if (["running", "partial", "pending", "skipped"].includes(status || "")) return styles.toneWarn;
  if (["failed", "unavailable"].includes(status || "")) return styles.toneBad;
  return styles.toneMuted;
}
function statusLabel(task: SyncTask) {
  if (!task.enabled) return "自动关闭";
  if (task.scheduleMode === "covered_by_parent") return "随父任务";
  if (task.scheduleMode === "child") return "由组任务调度";
  if (task.scheduleMode === "client") return "页面级";
  if (task.lastStatus === "failed") return "失败";
  if (task.lastStatus === "running") return "运行中";
  if (task.lastStatus === "skipped") return "已检查 · 无需更新";
  if (task.lastStatus === "success") return "正常";
  return "待首次运行";
}
function rankingPolicyKey(row: RankingRow) {
  if (row.listKey === "world_official") return "ranking_world_official";
  if (row.listKey === "provisional_seeding") return "ranking_provisional_seeding";
  if (row.listKey === "one_year") return "ranking_one_year";
  if (row.listKey === "provisional_eos") return "ranking_provisional_eos";
  if (row.listKey.startsWith("race_masters")) return "ranking_race_masters";
  if (row.listKey.startsWith("race_crucible")) return "ranking_race_crucible";
  if (row.listKey === "race_players_championship") return "ranking_race_players";
  if (row.listKey === "race_tour_championship") return "ranking_race_tour";
  if (row.listKey === "world_live") return "ranking_world_live";
  return null;
}

export default function SyncCenterV2({ tasks, rankings, cronJobs, pendingAction, runAction }: Props) {
  const scheduled = tasks.filter((task) => task.enabled && ["interval", "adaptive"].includes(task.scheduleMode)).length;
  const failed = tasks.filter((task) => task.lastStatus === "failed").length;
  const lastChange = tasks.map((task) => task.lastChangeAt).filter(Boolean).sort().at(-1) || null;
  const liveCron = cronJobs.find((job) => job.jobName === "snooker-live-sync-v2");
  const supervisorCron = cronJobs.find((job) => job.jobName === "snooker-sync-supervisor-v2");

  return <div className={styles.stack}>
    <section className={styles.syncSummaryGrid}>
      <article><small>AUTO TASKS</small><strong>{scheduled}</strong><span>自动调度任务</span></article>
      <article><small>LAST DATA CHANGE</small><strong>{fmtTime(lastChange)}</strong><span>最近一次检测到数据变化</span></article>
      <article><small>FAILURES</small><strong>{failed}</strong><span>当前失败任务</span></article>
      <article><small>SCHEDULER</small><strong>{liveCron?.active && supervisorCron?.active ? "正常" : "检查"}</strong><span>Live 30s + Supervisor 5m</span></article>
    </section>

    <section className={styles.schedulerInfo}>
      <div><span className={`${styles.dot} ${liveCron?.active ? styles.dotGood : styles.dotMuted}`} /><div><b>Live Scheduler</b><small>{liveCron?.schedule || "未启用"} · 只负责高频 Live tick</small></div></div>
      <div><span className={`${styles.dot} ${supervisorCron?.active ? styles.dotGood : styles.dotMuted}`} /><div><b>Sync Supervisor</b><small>{supervisorCron?.schedule || "未启用"} · 每5分钟检查低频任务是否到期，不代表每5分钟都抓数据</small></div></div>
    </section>

    {(["events", "players"] as const).map((groupKey) => <SyncGroup key={groupKey} groupKey={groupKey} tasks={tasks.filter((task) => task.groupKey === groupKey)} pendingAction={pendingAction} runAction={runAction} />)}

    <RankingGroup tasks={tasks} rankings={rankings.filter((row) => row.isCurrent)} pendingAction={pendingAction} runAction={runAction} />
    <SyncGroup groupKey="analytics" tasks={tasks.filter((task) => task.groupKey === "analytics")} pendingAction={pendingAction} runAction={runAction} />
    <SyncGroup groupKey="system" tasks={tasks.filter((task) => task.groupKey === "system")} pendingAction={pendingAction} runAction={runAction} />
  </div>;
}

function SyncGroup({ groupKey, tasks, pendingAction, runAction }: { groupKey: string; tasks: SyncTask[]; pendingAction: string | null; runAction: Props["runAction"] }) {
  const meta = groupMeta[groupKey] || { label: groupKey, eyebrow: "SYNC", text: "" };
  return <section className={styles.syncGroup}>
    <header className={styles.syncGroupHead}><div><small>{meta.eyebrow}</small><h2>{meta.label}</h2><p>{meta.text}</p></div><span>{tasks.filter((task) => task.enabled).length}/{tasks.length} 已启用</span></header>
    <div className={styles.syncTaskList}>{tasks.sort((a, b) => a.sortOrder - b.sortOrder).map((task) => <SyncTaskRow key={task.jobKey} task={task} pendingAction={pendingAction} runAction={runAction} />)}</div>
  </section>;
}

function SyncTaskRow({ task, pendingAction, runAction }: { task: SyncTask; pendingAction: string | null; runAction: Props["runAction"] }) {
  const canRun = !["client"].includes(task.scheduleMode);
  const inherited = task.scheduleMode === "covered_by_parent";
  const child = task.scheduleMode === "child";
  const busy = pendingAction === "sync_task" || pendingAction === "sync_policy_update";
  const lastResult = task.lastResult || {};
  const resultText = task.lastStatus === "failed" ? task.lastError || "执行失败" : task.lastStatus === "skipped" ? task.lastMessage || "无变化" : task.lastFinishedAt ? `读取 ${nf.format(task.lastFetchedCount || 0)} · 变化 ${nf.format(task.lastChangedCount || 0)}` : "尚未运行";

  return <article className={styles.syncTaskCard}>
    <div className={styles.syncTaskMain}>
      <div className={styles.syncTaskTitleLine}>
        <span className={`${styles.dot} ${task.enabled ? styles.dotGood : styles.dotMuted}`} />
        <div><h3>{task.displayNameZh || task.jobKey}</h3><code>{task.jobKey}</code></div>
        <span className={`${styles.badge} ${task.enabled ? tone(task.lastStatus) : styles.toneMuted}`}>{statusLabel(task)}</span>
      </div>
      <p>{task.descriptionZh || "—"}</p>
      {task.scheduleMode === "adaptive" && <div className={styles.syncHint}>自适应：平时 {fmtInterval(task.intervalSeconds)}；开赛前 {task.prestartWindowMinutes || 120} 分钟自动提高到 {fmtInterval(task.prestartIntervalSeconds)}。</div>}
      {task.jobKey === "post_match_finalize" && <div className={styles.syncHint}>比赛结束后进入确认期；确认期内补齐 Frame / 50+ / Match Stats / H2H，Finalize 后永久退出自动同步。</div>}
      {inherited && <div className={styles.syncHint}>本项不单独请求 WST，随“球员资料”一次请求共同更新，减少 Free 版资源消耗。</div>}
      {child && <div className={styles.syncHint}>本项由组级任务统一调度；仍可单独关闭或手动立即同步。</div>}
    </div>

    <div className={styles.syncTaskMeta}>
      <div><small>来源</small><b>{task.sourceName || "—"}</b></div>
      <div><small>上次成功</small><b>{fmtTime(task.lastSuccessAt)}</b></div>
      <div><small>上次变化</small><b>{fmtTime(task.lastChangeAt)}</b></div>
      <div><small>结果</small><b title={task.lastError || task.lastMessage || ""}>{resultText}</b></div>
      <div><small>耗时</small><b>{fmtDuration(task.lastDurationMs)}</b></div>
      <div><small>下次执行</small><b>{task.enabled && !inherited && !child && task.scheduleMode !== "client" ? fmtTime(task.nextRunAt) : "—"}</b></div>
    </div>

    <div className={styles.syncTaskControls}>
      {task.configurable ? <label>频率<select value={String(task.intervalSeconds)} disabled={busy || !task.enabled} onChange={(event) => void runAction("sync_policy_update", { jobKey: task.jobKey, enabled: task.enabled, intervalSeconds: Number(event.target.value) })}>{task.allowedIntervals.map((seconds) => <option key={seconds} value={seconds}>{fmtInterval(seconds)}</option>)}</select></label> : <div className={styles.coveredLabel}>{inherited ? "由父任务控制" : child ? "由组任务控制" : fmtInterval(task.intervalSeconds)}</div>}
      <label className={styles.switchLabel}><input type="checkbox" checked={task.enabled} disabled={busy || inherited} onChange={(event) => void runAction("sync_policy_update", { jobKey: task.jobKey, enabled: event.target.checked })} /><span />{task.enabled ? "自动" : "仅手动"}</label>
      {canRun && !inherited && <button disabled={busy} onClick={() => void runAction("sync_task", { jobKey: task.jobKey })}>{pendingAction === "sync_task" ? "执行中…" : "立即同步"}</button>}
    </div>
    {task.lastError && <div className={styles.syncTaskError}>{task.lastError}</div>}
    {Object.keys(lastResult).length > 0 && <details className={styles.syncDetails}><summary>查看最近一次详细结果</summary><pre>{JSON.stringify(lastResult, null, 2)}</pre></details>}
  </article>;
}

function RankingGroup({ tasks, rankings, pendingAction, runAction }: { tasks: SyncTask[]; rankings: RankingRow[]; pendingAction: string | null; runAction: Props["runAction"] }) {
  const allTask = tasks.find((task) => task.jobKey === "rankings_all");
  const busy = pendingAction === "sync_task" || pendingAction === "sync_policy_update";
  return <section className={styles.syncGroup}>
    <header className={styles.syncGroupHead}><div><small>RANKINGS</small><h2>排名数据</h2><p>“全部排名”是组级 Orchestrator：每天检查所有已启用榜单。直接榜单来自 WPBSA，Players/Tour 资格榜从 One-Year Ranking 派生。</p></div><span>WPBSA 优先</span></header>
    {allTask && <div className={styles.rankingsMaster}><div><span className={`${styles.dot} ${allTask.enabled ? styles.dotGood : styles.dotMuted}`} /><div><b>全部排名</b><small>rankings_all · 上次成功 {fmtTime(allTask.lastSuccessAt)} · 上次变化 {fmtTime(allTask.lastChangeAt)}</small></div></div><div className={styles.rankingsMasterActions}><select value={String(allTask.intervalSeconds)} disabled={busy || !allTask.enabled} onChange={(event) => void runAction("sync_policy_update", { jobKey: allTask.jobKey, enabled: allTask.enabled, intervalSeconds: Number(event.target.value) })}>{allTask.allowedIntervals.map((seconds) => <option key={seconds} value={seconds}>{fmtInterval(seconds)}</option>)}</select><label className={styles.switchLabel}><input type="checkbox" checked={allTask.enabled} disabled={busy} onChange={(event) => void runAction("sync_policy_update", { jobKey: allTask.jobKey, enabled: event.target.checked })} /><span />{allTask.enabled ? "自动" : "仅手动"}</label><button disabled={busy} onClick={() => void runAction("sync_task", { jobKey: "rankings_all" })}>同步全部排名</button></div></div>}

    <div className={styles.rankingV2Rows}>{rankings.map((row) => {
      const key = rankingPolicyKey(row); const task = tasks.find((item) => item.jobKey === key);
      return <article key={row.listKey}>
        <div><b>{row.titleZh}</b><small>{row.listKey}</small></div>
        <div><small>来源</small><span>{row.sourceName}</span></div>
        <div><small>最后快照</small><span>{fmtTime(row.latestCapturedAt)}</span></div>
        <span className={`${styles.badge} ${tone(row.syncStatus)}`}>{row.syncStatus}</span>
        {task ? <label className={styles.switchLabel}><input type="checkbox" checked={task.enabled} disabled={busy || row.isLive && row.syncStatus === "unavailable"} onChange={(event) => void runAction("sync_policy_update", { jobKey: task.jobKey, enabled: event.target.checked })} /><span />{task.enabled ? "启用" : "停用"}</label> : <span />}
        {task && <button disabled={busy || row.isLive && row.syncStatus === "unavailable"} onClick={() => void runAction("sync_task", { jobKey: task.jobKey })}>{row.isLive && row.syncStatus === "unavailable" ? "源暂不可用" : "立即同步"}</button>}
      </article>;
    })}</div>
    <p className={styles.panelNote}>世界排名为 WPBSA 官方两年滚动榜；临时排名用于下一排名节点的种子预测；单赛季排名只统计本赛季排名赛奖金；Masters/Crucible 为对应资格 Race；Players/Tour 资格榜由 One-Year 数据派生。WST 即时排名源尚未稳定开放，因此默认停用。</p>
  </section>;
}
