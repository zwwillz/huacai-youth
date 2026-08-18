"use client";

import { useMemo } from "react";
import type { SnookerPlayerListItem } from "@/lib/snooker/player-data";
import type { SnookerTechnicalHub, SnookerTechnicalList, SnookerTechnicalMetricKey } from "@/lib/snooker/technical-hub";
import styles from "./data.module.css";

const leaderKeys: SnookerTechnicalMetricKey[] = ["centuries", "win_rate", "shot_time", "maximums"];

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function playerMap(players: SnookerPlayerListItem[]) {
  return new Map(players.map((player) => [player.slug, player]));
}

function metricFor(hub: SnookerTechnicalHub, key: SnookerTechnicalMetricKey) {
  return hub.lists.find((list) => list.key === key) ?? null;
}

function formatMetricValue(list: SnookerTechnicalList, value: number) {
  if (list.unit === "percent") return `${value.toFixed(1)}%`;
  if (list.unit === "seconds") return `${value.toFixed(1)}s`;
  if (list.unit === "points") return value.toLocaleString("en-GB");
  if (list.key === "average_break") return value.toFixed(1);
  return Math.round(value).toLocaleString("en-GB");
}

function eligibilityLabel(list: SnookerTechnicalList) {
  return list.minMatches > 0 ? `至少 ${list.minMatches} 场` : null;
}

function TechnicalAvatar({ player, compact = false }: { player?: SnookerPlayerListItem; compact?: boolean }) {
  return <span className={`${styles.technicalAvatar} ${compact ? styles.technicalAvatarCompact : ""}`}>
    {player?.avatarUrl ? <img src={player.avatarUrl} alt="" loading="lazy" decoding="async" /> : <span>{initials(player?.nameEn ?? "Player")}</span>}
  </span>;
}

export function SeasonLeadersSection({
  hub,
  players,
  onOpenTechnical,
  onOpenPlayer,
}: {
  hub: SnookerTechnicalHub;
  players: SnookerPlayerListItem[];
  onOpenTechnical: (key: SnookerTechnicalMetricKey) => void;
  onOpenPlayer: (slug: string) => void;
}) {
  const bySlug = useMemo(() => playerMap(players), [players]);

  return <section className={styles.card}>
    <div className={styles.sectionHeader}>
      <div><small>SEASON LEADERS</small><h2>{hub.seasonLabel} 本赛季领跑者</h2></div>
    </div>
    <div className={styles.seasonLeaderGrid}>
      {leaderKeys.map((key) => {
        const list = metricFor(hub, key);
        const leader = list?.rows[0];
        const player = leader ? bySlug.get(leader.playerSlug) : undefined;
        const tieCount = leader && list ? list.rows.filter((row) => row.value === leader.value).length : 0;
        return <button type="button" className={styles.seasonLeaderCard} onClick={() => onOpenTechnical(key)} key={key}>
          <div className={styles.seasonLeaderLabel}><span>{list?.shortLabelZh ?? key}</span><small>{list?.labelEn ?? ""}</small></div>
          {leader && list ? <>
            <div className={styles.seasonLeaderMain}>
              <TechnicalAvatar player={player} compact />
              <span><strong>{player?.nameZh ?? leader.playerSlug}</strong><small>{player?.nameEn ?? leader.playerSlug}</small></span>
            </div>
            <div className={styles.seasonLeaderValue}><b>{formatMetricValue(list, leader.value)}</b><span>{tieCount > 1 ? `${tieCount} 人并列` : eligibilityLabel(list) ?? "当前领先"}</span></div>
          </> : <div className={styles.seasonLeaderEmpty}>数据准备中</div>}
        </button>;
      })}
    </div>
    <button className={styles.primaryAction} type="button" onClick={() => onOpenTechnical("centuries")}>查看完整技术榜 <span>›</span></button>
  </section>;
}

export function TechnicalDetailContent({
  hub,
  players,
  selectedKey,
  onSelectKey,
  onOpenPlayer,
}: {
  hub: SnookerTechnicalHub;
  players: SnookerPlayerListItem[];
  selectedKey: SnookerTechnicalMetricKey;
  onSelectKey: (key: SnookerTechnicalMetricKey) => void;
  onOpenPlayer: (slug: string) => void;
}) {
  const bySlug = useMemo(() => playerMap(players), [players]);
  const selected = metricFor(hub, selectedKey) ?? hub.lists[0] ?? null;

  return <div className={styles.detailContent}>
    <div className={styles.technicalMetricNav} role="tablist" aria-label="技术榜指标">
      {hub.lists.map((list) => <button
        type="button"
        role="tab"
        aria-selected={selected?.key === list.key}
        className={selected?.key === list.key ? styles.technicalMetricActive : ""}
        onClick={() => onSelectKey(list.key)}
        key={list.key}
      >{list.shortLabelZh}</button>)}
    </div>

    {selected ? <section className={`${styles.card} ${styles.technicalTableCard}`}>
      <div className={styles.technicalTableHeader}><span>排名</span><span>球员</span><span>{selected.shortLabelZh}</span></div>
      <div className={styles.technicalRankingList}>
        {selected.rows.map((row) => {
          const player = bySlug.get(row.playerSlug);
          return <button type="button" onClick={() => onOpenPlayer(row.playerSlug)} key={`${selected.key}-${row.playerId}`}>
            <strong>{row.rank}</strong>
            <TechnicalAvatar player={player} compact />
            <span><b>{player?.nameZh ?? row.playerSlug}</b><small>{player?.nameEn ?? row.playerSlug}{row.matchesPlayed ? ` · ${row.matchesPlayed}场` : ""}</small></span>
            <em>{formatMetricValue(selected, row.value)}</em>
            <i>›</i>
          </button>;
        })}
        {!selected.rows.length ? <div className={styles.emptyState}>当前赛季暂无该项数据。</div> : null}
      </div>
      <div className={styles.rankingFooterMeta}>
        <span>{hub.seasonLabel} · {hub.sourceName}</span>
        {selected.minMatches > 0 ? <span>口径：至少完成 {selected.minMatches} 场比赛</span> : <span>仅统计当前职业巡回赛球员</span>}
      </div>
    </section> : <section className={styles.card}><div className={styles.emptyState}>技术榜数据正在准备中。</div></section>}
  </div>;
}
