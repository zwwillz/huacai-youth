"use client";

import { useState } from "react";
import styles from "./sync-center-v2.module.css";

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
  rankings: { label: "排名数据", eyebrow: "RANKINGS", text: "每个排名都是独立同步任务，可单独设置频率、自动开关和立即同步；“全部排名”只作为批量手动操作。" },
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
  if (["queued", "running", "partial", "pending", "skipped"].includes(status || "")) return styles.toneWarn;
  if (["failed", "unavailable"].includes(status || "")) return styles.toneBad;
  return styles.toneMuted;
}
function statusLabel(task: SyncTask) {
  if (!task.enabled) return "自动关闭";
  if (task.scheduleMode === "covered_by_parent") return "随父任务";
  if (task.scheduleMode === "client") return "页面级";
  if (task.lastStatus === "queued") return "已排队";
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
  const changes = tasks.map((task) => task.lastChangeAt).filter((value): value is string => Boolean(value)).sort();
  const lastChange = changes.length ? changes[changes.length - 1] : null;
  const liveCron = cronJobs.find((job) => job.jobName === "snooker-live-sync-v2");
  const supervisorCron = cronJobs.find((job) => job.jobName === "snooker-sync-supervisor-v2");
  const manualWorker = cronJobs.find((job) => job.jobName === "snooker-manual-sync-worker-v2");

  return <div className={styles.stack}>
    <section className={styles.syncSummaryGrid}>
      <article><small>AUTO TASKS</small><strong>{scheduled}</strong><span>自动调度任务</span></article>
      <article><small>LAST DATA CHANGE</small><strong>{fmtTime(lastChange)}</strong><span>最近一次检测到数据变化</span></article>
      <article><small>FAILURES</small><strong>{failed}</strong><span>当前失败任务</span></article>
      <article><small>SCHEDULER</small><strong>{liveCron?.active && supervisorCron?.active && manualWorker?.active ? "正常" : "检查"}</strong><span>Live + Supervisor + Manual Worker</span></article>
    </section>

    <section className={styles.schedulerInfo}>
      <div><span className={`${styles.dot} ${liveCron?.active ? styles.dotGood : styles.dotMuted}`} /><div><b>Live Scheduler</b><small>{liveCron?.schedule || "未启用"} · 只负责高频 Live tick</small></div></div>
      <div><span className={`${styles.dot} ${supervisorCron?.active ? styles.dotGood : styles.dotMuted}`} /><div><b>Sync Supervisor</b><small>{supervisorCron?.schedule || "未启用"} · 每5分钟检查低频任务是否到期，不代表每5分钟都抓数据</small></div></div>
      <div><span className={`${styles.dot} ${manualWorker?.active ? styles.dotGood : styles.dotMuted}`} /><div><b>Manual Sync Worker</b><small>{manualWorker?.schedule || "未启用"} · 处理后台手动同步队列，避免网页请求等待和超时</small></div></div>
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
    <div className={styles.syncTaskList}>{[...tasks].sort((a, b) => a.sortOrder - b.sortOrder).map((task) => <SyncTaskRow key={task.jobKey} task={task} pendingAction={pendingAction} runAction={runAction} />)}</div>
  </section>;
}

function SyncTaskRow({ task, pendingAction, runAction, ranking }: { task: SyncTask; pendingAction: string | null; runAction: Props["runAction"]; ranking?: RankingRow }) {
  const [localBusy, setLocalBusy] = useState(false);
  const canRun = task.scheduleMode !== "client";
  const inherited = task.scheduleMode === "covered_by_parent";
  const configBusy = pendingAction === "sync_policy_update";
  const sourceUnavailable = ranking?.syncStatus === "unavailable";
  const lastResult = task.lastResult || {};
  const resultText = task.lastStatus === "queued" ? "等待后台执行" : task.lastStatus === "failed" ? task.lastError || "执行失败" : task.lastStatus === "skipped" ? task.lastMessage || "无变化" : task.lastFinishedAt ? `读取 ${nf.format(task.lastFetchedCount || 0)} · 变化 ${nf.format(task.lastChangedCount || 0)}` : "尚未运行";
  async function runNow() {
    setLocalBusy(true);
    try { await runAction("sync_task", { jobKey: task.jobKey }); }
    finally { setLocalBusy(false); }
  }

  return <article className={styles.syncTaskCard}>
    <div className={styles.syncTaskMain}>
      <div className={styles.syncTaskTitleLine}>
        <span className={`${styles.dot} ${task.enabled ? styles.dotGood : styles.dotMuted}`} />
        <div><h3>{task.displayNameZh || ranking?.titleZh || task.jobKey}</h3><code>{ranking?.listKey || task.jobKey}</code></div>
        {ranking && <span className={`${styles.badge} ${tone(ranking.syncStatus)}`}>{ranking.syncStatus}</span>}
        <span className={`${styles.badge} ${task.enabled ? tone(task.lastStatus) : styles.toneMuted}`}>{statusLabel(task)}</span>
      </div>
      <p>{task.descriptionZh || "—"}</p>
      {task.scheduleMode === "adaptive" && <div className={styles.syncHint}>自适应：平时 {fmtInterval(task.intervalSeconds)}；开赛前 {task.prestartWindowMinutes || 120} 分钟自动提高到 {fmtInterval(task.prestartIntervalSeconds)}。</div>}
      {task.jobKey === "post_match_finalize" && <div className={styles.syncHint}>比赛结束后进入确认期；确认期内补齐 Frame / 50+ / Match Stats / H2H，Finalize 后永久退出自动同步。</div>}
      {inherited && <div className={styles.syncHint}>本项不单独请求 WST，随“球员资料”一次请求共同更新，减少 Free 版资源消耗。</div>}
      {ranking && <div className={styles.syncHint}>“上次成功”表示最近一次检查成功；“上次变化”表示最近一次发现榜单内容改变；“最新数据版本”是最近一次写入排名快照的时间。无变化时会检查成功，但不会重复写快照。</div>}
    </div>

    <div className={styles.syncTaskMeta}>
      <div><small>来源</small><b>{ranking?.sourceName || task.sourceName || "—"}</b></div>
      <div><small>上次成功</small><b>{fmtTime(task.lastSuccessAt)}</b></div>
      <div><small>上次变化</small><b>{fmtTime(task.lastChangeAt)}</b></div>
      {ranking && <div><small>最新数据版本</small><b>{fmtTime(ranking.latestCapturedAt)}</b></div>}
      <div><small>结果</small><b title={task.lastError || task.lastMessage || ""}>{resultText}</b></div>
      <div><small>耗时</small><b>{fmtDuration(task.lastDurationMs)}</b></div>
      <div><small>下次执行</small><b>{task.enabled && !inherited && task.scheduleMode !== "client" && task.scheduleMode !== "manual" ? fmtTime(task.nextRunAt) : "—"}</b></div>
    </div>

    <div className={styles.syncTaskControls}>
      {task.configurable ? <label>频率<select value={String(task.intervalSeconds)} disabled={configBusy || localBusy || !task.enabled} onChange={(event) => void runAction("sync_policy_update", { jobKey: task.jobKey, enabled: task.enabled, intervalSeconds: Number(event.target.value) })}>{task.allowedIntervals.map((seconds) => <option key={seconds} value={seconds}>{fmtInterval(seconds)}</option>)}</select></label> : <div className={styles.coveredLabel}>{inherited ? "由父任务控制" : task.scheduleMode === "manual" ? "仅手动" : fmtInterval(task.intervalSeconds)}</div>}
      <label className={styles.switchLabel}><input type="checkbox" checked={task.enabled} disabled={configBusy || localBusy || inherited || sourceUnavailable} onChange={(event) => void runAction("sync_policy_update", { jobKey: task.jobKey, enabled: event.target.checked })} /><span />{task.enabled ? "自动" : "仅手动"}</label>
      {canRun && !inherited && <button disabled={configBusy || localBusy || sourceUnavailable} onClick={() => void runNow()}>{sourceUnavailable ? "源暂不可用" : localBusy ? "提交中…" : task.lastStatus === "queued" ? "已排队" : "立即同步"}</button>}
    </div>
    {task.lastError && <div className={styles.syncTaskError}>{task.lastError}</div>}
    {Object.keys(lastResult).length > 0 && <details className={styles.syncDetails}><summary>查看最近一次详细结果</summary><pre>{JSON.stringify(lastResult, null, 2)}</pre></details>}
  </article>;
}

function RankingGroup({ tasks, rankings, pendingAction, runAction }: { tasks: SyncTask[]; rankings: RankingRow[]; pendingAction: string | null; runAction: Props["runAction"] }) {
  const allTask = tasks.find((task) => task.jobKey === "rankings_all");
  const [batchBusy, setBatchBusy] = useState(false);
  const configBusy = pendingAction === "sync_policy_update";
  async function runAll() {
    setBatchBusy(true);
    try { await runAction("sync_task", { jobKey: "rankings_all" }); }
    finally { setBatchBusy(false); }
  }
  return <section className={styles.syncGroup}>
    <header className={styles.syncGroupHead}><div><small>RANKINGS</small><h2>排名数据</h2><p>每个排名独立自动调度；“全部排名”只用于需要时一次性批量检查所有已启用榜单，不参与日常自动调度。</p></div><span>WPBSA 优先</span></header>
    {allTask && <div className={styles.rankingsMaster}><div><span className={`${styles.dot} ${styles.dotGood}`} /><div><b>同步全部排名</b><small>批量手动任务 · 上次成功 {fmtTime(allTask.lastSuccessAt)} · 上次变化 {fmtTime(allTask.lastChangeAt)} · 耗时 {fmtDuration(allTask.lastDurationMs)}</small></div></div><div className={styles.rankingsMasterActions}><button disabled={configBusy || batchBusy} onClick={() => void runAll()}>{batchBusy ? "提交中…" : allTask.lastStatus === "queued" ? "已排队" : "同步全部排名"}</button></div></div>}

    <div className={styles.syncTaskList}>{rankings.map((row) => {
      const key = rankingPolicyKey(row);
      const task = tasks.find((item) => item.jobKey === key);
      return task ? <SyncTaskRow key={row.listKey} task={task} ranking={row} pendingAction={pendingAction} runAction={runAction} /> : null;
    })}</div>
    <p className={styles.panelNote}><b>时间字段说明：</b>“上次成功”= 最近一次成功检查数据源；“上次变化”= 最近一次发现排名内容改变；“最新数据版本”= 最近一次实际写入快照。由于系统只在数据变化时创建新快照，所以没有变化时“上次成功”会更新，而“上次变化 / 最新数据版本”保持不变。世界排名为 WPBSA 官方两年滚动榜；Players/Tour 资格榜由 One-Year 数据派生；WST 即时排名源尚未稳定开放，因此默认停用。</p>
  </section>;
}
