"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { SnookerDashboardSnapshot, SnookerMatch } from "@/lib/snooker/domain";
import type { SnookerSourceHealth } from "@/lib/snooker/live-overlay";
import styles from "./site-monitor.module.css";

type DashboardResponse = {
  ok?: boolean;
  snapshot?: SnookerDashboardSnapshot;
  sourceHealth?: SnookerSourceHealth;
};

type Props = {
  initialSnapshot: SnookerDashboardSnapshot;
  initialSourceHealth: SnookerSourceHealth;
};

type HealthLevel = "ok" | "warning" | "error";

function allMatches(snapshot: SnookerDashboardSnapshot) {
  return snapshot.event.rounds.flatMap((round) => round.matches);
}

function isActive(match: SnookerMatch) {
  return match.status === "live" || match.status === "session-break";
}

function formatChinaTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function healthLevel(health: SnookerSourceHealth, activeCount: number): HealthLevel {
  if (!health.online) return "error";
  if (!health.eventAccepted) return "warning";
  if (activeCount > 0 && !health.liveAccepted) return "warning";
  return "ok";
}

function healthLabel(level: HealthLevel) {
  if (level === "ok") return "运行正常";
  if (level === "warning") return "部分降级";
  return "数据异常";
}

function StatusDot({ level }: { level: HealthLevel }) {
  return <i className={`${styles.dot} ${styles[`dot_${level}`]}`} aria-hidden="true" />;
}

function booleanLevel(value: boolean, optional = false): HealthLevel {
  if (value) return "ok";
  return optional ? "warning" : "error";
}

export default function SnookerSiteMonitor({ initialSnapshot, initialSourceHealth }: Props) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [sourceHealth, setSourceHealth] = useState(initialSourceHealth);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState(initialSourceHealth.fetchedAt);

  const refresh = useCallback(async () => {
    if (typeof document !== "undefined" && document.hidden) return;
    setRefreshing(true);
    try {
      const response = await fetch(`/api/snooker/v1/dashboard?monitor=${Date.now()}`, {
        cache: "no-store",
        headers: { "cache-control": "no-cache" },
      });
      const data = await response.json() as DashboardResponse;
      if (!response.ok || !data.ok || !data.snapshot || !data.sourceHealth) {
        throw new Error("监测接口返回异常");
      }
      setSnapshot(data.snapshot);
      setSourceHealth(data.sourceHealth);
      setCheckedAt(data.sourceHealth.fetchedAt);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "监测接口暂不可用");
      setCheckedAt(new Date().toISOString());
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => void refresh(), 15_000);
    const onVisibility = () => { if (!document.hidden) void refresh(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  const matches = useMemo(() => allMatches(snapshot), [snapshot]);
  const activeMatches = useMemo(() => matches.filter(isActive), [matches]);
  const completedCount = matches.filter((match) => match.status === "completed" || match.status === "walkover").length;
  const upcomingCount = matches.filter((match) => match.status === "upcoming").length;
  const playerMap = useMemo(() => new Map(snapshot.players.map((player) => [player.id, player])), [snapshot.players]);
  const level = error ? "error" : healthLevel(sourceHealth, activeMatches.length);
  const mappingRate = sourceHealth.parsedMatchCount > 0
    ? Math.round((sourceHealth.overlayCount / sourceHealth.parsedMatchCount) * 100)
    : 0;

  const cards = [
    {
      label: "整体状态",
      value: error ? "接口异常" : healthLabel(level),
      note: error ?? "WST → 服务端 → 页面",
      level,
    },
    {
      label: "WST 数据源",
      value: sourceHealth.online ? "在线" : "不可用",
      note: sourceHealth.source,
      level: booleanLevel(sourceHealth.online),
    },
    {
      label: "赛事映射",
      value: `${sourceHealth.overlayCount}/${sourceHealth.parsedMatchCount || "—"}`,
      note: `${mappingRate}% 对阵已匹配`,
      level: sourceHealth.eventAccepted ? "ok" : "warning" as HealthLevel,
    },
    {
      label: "进行中比赛",
      value: String(activeMatches.length),
      note: activeMatches.length ? (sourceHealth.liveAccepted ? "逐局实时已接入" : "逐局源待恢复") : "当前没有进行中比赛",
      level: activeMatches.length === 0 || sourceHealth.liveAccepted ? "ok" : "warning" as HealthLevel,
    },
    {
      label: "源响应耗时",
      value: `${sourceHealth.latencyMs} ms`,
      note: sourceHealth.latencyMs <= 3000 ? "当前响应正常" : "响应偏慢",
      level: sourceHealth.latencyMs <= 3000 ? "ok" : "warning" as HealthLevel,
    },
    {
      label: "最近同步",
      value: formatChinaTime(sourceHealth.fetchedAt).split(" ").at(-1) ?? "—",
      note: formatChinaTime(sourceHealth.fetchedAt),
      level: "ok" as HealthLevel,
    },
  ];

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <div className={styles.titleLine}>
              <h1 className={styles.title}>斯诺克数据监测</h1>
              <span className={`${styles.overallBadge} ${styles[`badge_${level}`]}`}>
                <StatusDot level={level} />
                {error ? "监测异常" : healthLabel(level)}
              </span>
            </div>
            <p className={styles.subtitle}>POC 阶段 · WST 官方数据源、赛事比分与 Match Centre 逐局实时同步监测</p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.refreshButton} onClick={() => void refresh()} disabled={refreshing}>
              {refreshing ? "检测中…" : "立即刷新"}
            </button>
            <Link className={styles.back} href="/snooker">返回斯诺克首页</Link>
          </div>
        </header>

        <div className={styles.syncLine}>
          <span><i className={styles.pulse} />每 15 秒自动检测</span>
          <span>页面检查时间：{formatChinaTime(checkedAt)}</span>
          <span>数据快照：{formatChinaTime(snapshot.event.snapshotAt)}</span>
        </div>

        {error ? <div className={styles.errorBanner}>监测接口暂时读取失败：{error}。页面保留上一次成功数据，可点击“立即刷新”重试。</div> : null}

        <section className={styles.summaryGrid} aria-label="监测概览">
          {cards.map((card) => (
            <article className={styles.summaryCard} key={card.label}>
              <div className={styles.cardLabel}><StatusDot level={card.level} />{card.label}</div>
              <strong>{card.value}</strong>
              <small>{card.note}</small>
            </article>
          ))}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div><small>CURRENT EVENT</small><h2>当前赛事</h2></div>
            <span className={styles.eventStatus}>{snapshot.event.statusLabelZh}</span>
          </div>
          <div className={styles.eventGrid}>
            <div><span>赛事</span><b>{snapshot.event.nameZh}</b></div>
            <div><span>赛季 / 类型</span><b>{snapshot.event.season} · {snapshot.event.typeZh}</b></div>
            <div><span>比赛总数</span><b>{matches.length}</b></div>
            <div><span>已结束</span><b>{completedCount}</b></div>
            <div><span>进行中</span><b>{activeMatches.length}</b></div>
            <div><span>待开始</span><b>{upcomingCount}</b></div>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div><small>LIVE MATCHES</small><h2>正在进行的比赛</h2></div>
            <span>{activeMatches.length ? `${activeMatches.length} 场` : "暂无"}</span>
          </div>

          {activeMatches.length ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>轮次 / 时间</th>
                    <th>对阵</th>
                    <th>总比分</th>
                    <th>当前局</th>
                    <th>当前局比分</th>
                    <th>50+ 单杆</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {activeMatches.map((match) => {
                    const p1 = playerMap.get(match.player1Id);
                    const p2 = playerMap.get(match.player2Id);
                    const latestFrame = match.frames?.[match.frames.length - 1];
                    const breakText = latestFrame
                      ? [latestFrame.break1, latestFrame.break2].filter((value): value is number => typeof value === "number").join(" / ") || "—"
                      : "—";
                    return (
                      <tr key={match.id}>
                        <td><b>{match.roundLabelZh}</b><small>{match.timeLabelZh ?? "—"}</small></td>
                        <td>{p1?.nameZh ?? match.player1Id} <em>vs</em> {p2?.nameZh ?? match.player2Id}</td>
                        <td className={styles.score}>{match.score1 ?? "-"} : {match.score2 ?? "-"}</td>
                        <td>{latestFrame ? `第 ${latestFrame.frameNo} 局` : "—"}</td>
                        <td className={styles.frameScore}>{latestFrame ? `${latestFrame.score1} : ${latestFrame.score2}` : "—"}</td>
                        <td>{breakText}</td>
                        <td><span className={styles.liveBadge}>{match.status === "session-break" ? "阶段休息" : "进行中"}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.empty}>当前没有正在进行的比赛。赛事数据源仍会继续按 15 秒周期检查。</div>
          )}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div><small>DATA PIPELINE</small><h2>数据链路</h2></div>
            <span>WST 官方源</span>
          </div>
          <div className={styles.healthRows}>
            <div>
              <span><StatusDot level={booleanLevel(sourceHealth.online)} />WST 网络连接</span>
              <b>{sourceHealth.online ? "正常" : "异常"}</b>
              <small>官方赛事服务可访问</small>
            </div>
            <div>
              <span><StatusDot level={sourceHealth.eventAccepted ? "ok" : "warning"} />赛事 REST 数据</span>
              <b>{sourceHealth.eventAccepted ? "已通过完整性校验" : "未通过完整性校验"}</b>
              <small>{sourceHealth.overlayCount} 场已覆盖 · {sourceHealth.parsedMatchCount} 场源数据</small>
            </div>
            <div>
              <span><StatusDot level={activeMatches.length === 0 ? "ok" : booleanLevel(sourceHealth.liveAccepted, true)} />Match Centre 逐局数据</span>
              <b>{activeMatches.length === 0 ? "当前无需逐局源" : sourceHealth.liveAccepted ? "实时同步正常" : "暂未接入"}</b>
              <small>用于当前未结束局比分与 50+ 单杆</small>
            </div>
            <div>
              <span><StatusDot level="ok" />页面实时接口</span>
              <b>/api/snooker/v1/dashboard</b>
              <small>15 秒轮询 · no-store</small>
            </div>
          </div>
          <div className={styles.sourceMessage}>
            <b>源状态说明</b>
            <p>{sourceHealth.message}</p>
            <span>本次检测发现 {sourceHealth.changedCount} 项数据变化 · 请求耗时 {sourceHealth.latencyMs} ms</span>
          </div>
        </section>

        <footer className={styles.footer}>POC 监测页暂不设置访问密码，正式上线前再接入权限保护。</footer>
      </div>
    </main>
  );
}
