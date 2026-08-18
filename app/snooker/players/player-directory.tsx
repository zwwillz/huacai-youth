"use client";

import { useEffect, useRef } from "react";
import type { SnookerPlayerListItem, SnookerPlayerStatus } from "@/lib/snooker/player-data";
import { prefetchPlayerExperience } from "./player-detail-client";
import styles from "./player.module.css";

export type PlayerFilter = "all" | "china" | "top16" | "current";

const filters: Array<{ id: PlayerFilter; label: string }> = [
  { id: "all", label: "全部" },
  { id: "china", label: "中国" },
  { id: "top16", label: "TOP 16" },
  { id: "current", label: "巡回" },
];

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function points(value: number | null) {
  return value === null ? "—" : `€${value.toLocaleString("en-GB")}`;
}

function isConcretePlayer(player: SnookerPlayerListItem) {
  const slug = player.slug.trim().toLowerCase();
  const nameEn = player.nameEn.trim();
  const nameZh = player.nameZh.trim();

  return !(
    /^china-wildcard-\d+(?:-|$)/i.test(slug) ||
    /(?:^|-)winner-(?:of-)?match-\d+(?:-|$)/i.test(slug) ||
    /^China Wildcard #?\d+$/i.test(nameEn) ||
    /^Winner of Match \d+$/i.test(nameEn) ||
    /^中国外卡\d+号$/.test(nameZh) ||
    /^第\d+场胜者$/.test(nameZh)
  );
}

function resolvedPlayerStatus(player: SnookerPlayerListItem): SnookerPlayerStatus {
  if (player.playerStatus && player.playerStatus !== "unknown") return player.playerStatus;
  if (player.isCurrentTour) return "tour";
  if (player.turnedPro !== null) return "former_pro";
  return "amateur";
}

function playerStatusLabel(status: SnookerPlayerStatus) {
  if (status === "tour") return "巡回球员";
  if (status === "former_pro") return "前职业";
  if (status === "amateur") return "业余球员";
  return null;
}

export function PlayerDirectoryContent({
  players,
  query,
  filter,
  onQueryChange,
  onFilterChange,
  onOpenPlayer,
  onPrefetchPlayer,
}: {
  players: SnookerPlayerListItem[];
  query: string;
  filter: PlayerFilter;
  onQueryChange: (value: string) => void;
  onFilterChange: (value: PlayerFilter) => void;
  onOpenPlayer: (player: SnookerPlayerListItem) => void;
  onPrefetchPlayer?: (player: SnookerPlayerListItem) => void;
}) {
  const directoryRef = useRef<HTMLDivElement | null>(null);
  const needle = query.trim().toLocaleLowerCase("zh-CN");
  const filtered = players.filter(isConcretePlayer).filter((player) => {
    const status = resolvedPlayerStatus(player);
    if (filter === "china" && player.countryCode !== "CHN" && player.countryCode !== "CN") return false;
    if (filter === "top16" && (player.currentRank === null || player.currentRank > 16)) return false;
    if (filter === "current" && status !== "tour") return false;
    if (!needle) return true;
    const haystack = `${player.nameZh} ${player.shortNameZh ?? ""} ${player.nameEn} ${player.nationalityZh ?? ""}`.toLocaleLowerCase("zh-CN");
    return haystack.includes(needle);
  });

  useEffect(() => {
    const root = directoryRef.current;
    if (!root) return;
    const playerBySlug = new Map(filtered.map((player) => [player.slug, player]));
    const warm = (player: SnookerPlayerListItem, priority: "low" | "high") => {
      prefetchPlayerExperience(player.slug, player.avatarUrl, priority);
      onPrefetchPlayer?.(player);
    };

    if (typeof IntersectionObserver === "undefined") {
      filtered.slice(0, 6).forEach((player) => warm(player, "low"));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const slug = (entry.target as HTMLElement).dataset.playerSlug;
        const player = slug ? playerBySlug.get(slug) : undefined;
        if (player) warm(player, "low");
        observer.unobserve(entry.target);
      }
    }, { rootMargin: "420px 0px", threshold: 0.01 });

    root.querySelectorAll<HTMLElement>("[data-player-slug]").forEach((row) => observer.observe(row));
    return () => observer.disconnect();
  }, [players, query, filter, onPrefetchPlayer]);

  const warmHighPriority = (player: SnookerPlayerListItem) => {
    prefetchPlayerExperience(player.slug, player.avatarUrl, "high");
    onPrefetchPlayer?.(player);
  };

  return (
    <>
      <section className={styles.pageIntro}>
        <small>PLAYER DATABASE</small>
        <h1>球员</h1>
        <p>世界斯诺克球员数据库。中文名、英文标准名、世界排名与球员资料统一由独立数据中心维护。</p>
      </section>

      <div className={styles.directoryToolbar}>
        <label className={styles.searchBox}>
          <span>⌕</span>
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="搜索中文名 / 英文名"
            aria-label="搜索球员"
          />
        </label>
        <div className={styles.filters}>
          {filters.map((item) => (
            <button className={filter === item.id ? styles.filterActive : ""} onClick={() => onFilterChange(item.id)} key={item.id}>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <section className={styles.card}>
        <div className={styles.directorySummary}>
          <span>按官方世界排名排列</span>
          <b>{filtered.length} 名球员</b>
        </div>
        <div className={styles.playerDirectory} ref={directoryRef}>
          {filtered.length ? filtered.map((player) => {
            const status = resolvedPlayerStatus(player);
            const statusLabel = playerStatusLabel(status);
            return (
              <button
                type="button"
                className={styles.playerRow}
                data-player-slug={player.slug}
                onPointerEnter={() => warmHighPriority(player)}
                onFocus={() => warmHighPriority(player)}
                onTouchStart={() => warmHighPriority(player)}
                onClick={() => onOpenPlayer(player)}
                key={player.id}
              >
                <span className={styles.listAvatar}>
                  {player.avatarUrl ? <img src={player.avatarUrl} alt="" loading="lazy" decoding="async" /> : <span>{initials(player.nameEn)}</span>}
                </span>
                <span className={styles.rowMain}>
                  <b>{player.nameZh}</b>
                  <small>{player.nameEn}</small>
                  <p>
                    {player.nationalityZh ?? "国籍待补充"}
                    {statusLabel ? <i data-player-status={status}>{statusLabel}</i> : null}
                  </p>
                </span>
                <span className={styles.rowEnd}>
                  <span className={styles.rankBlock}>
                    <b>{player.currentRank === null ? "—" : `#${player.currentRank}`}</b>
                    <small>{points(player.rankingPoints)}</small>
                  </span>
                  <span className={styles.rowArrow}>›</span>
                </span>
              </button>
            );
          }) : <div className={styles.emptyState}>没有找到匹配的球员。<br />可以尝试中文名、英文名或切换筛选条件。</div>}
        </div>
      </section>
    </>
  );
}
