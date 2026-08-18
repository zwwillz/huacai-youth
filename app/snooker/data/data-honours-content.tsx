"use client";

import { useEffect, useMemo } from "react";
import type { SnookerPlayerListItem } from "@/lib/snooker/player-data";
import type { SnookerHonoursHub, SnookerHonoursList, SnookerHonoursMetricKey } from "@/lib/snooker/honours-hub";
import shellStyles from "../snooker-data-center.module.css";
import styles from "./data.module.css";

const leaderKeys: SnookerHonoursMetricKey[] = ["ranking_titles", "triple_crown_titles", "world_championship_titles", "career_147s"];

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function playerMap(players: SnookerPlayerListItem[]) {
  return new Map(players.map((player) => [player.slug, player]));
}

function metricFor(hub: SnookerHonoursHub, key: SnookerHonoursMetricKey) {
  return hub.lists.find((list) => list.key === key) ?? null;
}

function formatHonoursValue(list: SnookerHonoursList, value: number) {
  const suffix = list.key === "ranking_finals" ? "次" : list.key === "career_147s" ? "杆" : "冠";
  return `${Math.round(value).toLocaleString("en-GB")}${suffix}`;
}

function capturedLabel(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function HonoursAvatar({ player, compact = false }: { player?: SnookerPlayerListItem; compact?: boolean }) {
  return <span className={`${styles.technicalAvatar} ${compact ? styles.technicalAvatarCompact : ""}`}>
    {player?.avatarUrl ? <img src={player.avatarUrl} alt="" loading="lazy" decoding="async" /> : <span>{initials(player?.nameEn ?? "Player")}</span>}
  </span>;
}

export function HonoursLeadersSection({
  hub,
  players,
  onOpenHonours,
}: {
  hub: SnookerHonoursHub;
  players: SnookerPlayerListItem[];
  onOpenHonours: (key: SnookerHonoursMetricKey) => void;
}) {
  const bySlug = useMemo(() => playerMap(players), [players]);

  return <section className={styles.card}>
    <div className={styles.sectionHeader}>
      <div><small>CAREER HONOURS</small><h2>荣誉榜</h2></div>
    </div>
    <div className={styles.seasonLeaderGrid}>
      {leaderKeys.map((key) => {
        const list = metricFor(hub, key);
        const leader = list?.rows[0];
        const player = leader ? bySlug.get(leader.playerSlug) : undefined;
        const tieCount = leader && list ? list.rows.filter((row) => row.value === leader.value).length : 0;
        return <button type="button" className={styles.seasonLeaderCard} onClick={() => onOpenHonours(key)} key={key}>
          <div className={styles.seasonLeaderLabel}><span>{list?.shortLabelZh ?? key}</span><small>{list?.labelEn ?? ""}</small></div>
          {leader && list ? <>
            <div className={styles.seasonLeaderMain}>
              <HonoursAvatar player={player} compact />
              <span><strong>{player?.nameZh ?? leader.playerSlug}</strong><small>{player?.nameEn ?? leader.playerSlug}</small></span>
            </div>
            <div className={styles.seasonLeaderValue}><b>{formatHonoursValue(list, leader.value)}</b><span>{tieCount > 1 ? `${tieCount} 人并列` : "当前领先"}</span></div>
          </> : <div className={styles.seasonLeaderEmpty}>数据准备中</div>}
        </button>;
      })}
    </div>
    <button className={styles.primaryAction} type="button" onClick={() => onOpenHonours("ranking_titles")}>查看完整荣誉榜 <span>›</span></button>
  </section>;
}

export function HonoursDetailContent({
  hub,
  players,
  selectedKey,
  onSelectKey,
  onOpenPlayer,
}: {
  hub: SnookerHonoursHub;
  players: SnookerPlayerListItem[];
  selectedKey: SnookerHonoursMetricKey;
  onSelectKey: (key: SnookerHonoursMetricKey) => void;
  onOpenPlayer: (slug: string) => void;
}) {
  const bySlug = useMemo(() => playerMap(players), [players]);
  const selected = metricFor(hub, selectedKey) ?? hub.lists[0] ?? null;
  const updated = capturedLabel(hub.capturedAt);

  return <div className={styles.detailContent}>
    <div className={styles.technicalMetricNav} role="tablist" aria-label="荣誉榜指标">
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
            <HonoursAvatar player={player} compact />
            <span><b>{player?.nameZh ?? row.playerSlug}</b><small>{player?.nameEn ?? row.playerSlug}</small></span>
            <em>{formatHonoursValue(selected, row.value)}</em>
            <i>›</i>
          </button>;
        })}
        {!selected.rows.length ? <div className={styles.emptyState}>当前数据库暂无该项荣誉数据。</div> : null}
      </div>
      <div className={styles.rankingFooterMeta}>
        <span>来源：{hub.sourceName}{updated ? ` · 更新 ${updated}` : ""}</span>
        <span>口径：本站已入库职业生涯统计</span>
      </div>
    </section> : <section className={styles.card}><div className={styles.emptyState}>荣誉榜数据正在准备中。</div></section>}
  </div>;
}

export function HonoursDetailOverlay({
  hub,
  players,
  selectedKey,
  onSelectKey,
  onOpenPlayer,
  onClose,
}: {
  hub: SnookerHonoursHub;
  players: SnookerPlayerListItem[];
  selectedKey: SnookerHonoursMetricKey;
  onSelectKey: (key: SnookerHonoursMetricKey) => void;
  onOpenPlayer: (slug: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, []);

  return <div className={styles.technicalOverlay}>
    <div className={styles.technicalOverlayScroll}>
      <header className={shellStyles.detailHeader}><button onClick={onClose}>‹</button><strong>荣誉榜</strong><span>DATA</span></header>
      <HonoursDetailContent hub={hub} players={players} selectedKey={selectedKey} onSelectKey={onSelectKey} onOpenPlayer={onOpenPlayer} />
    </div>
  </div>;
}
