"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SnookerPlayerListItem } from "@/lib/snooker/player-data";
import PlayerShell from "./player-shell";
import styles from "./player.module.css";

type Filter = "all" | "china" | "top16" | "current";

const filters: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "全部" },
  { id: "china", label: "中国" },
  { id: "top16", label: "TOP 16" },
  { id: "current", label: "现役" },
];

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function points(value: number | null) {
  return value === null ? "—" : `€${value.toLocaleString("en-GB")}`;
}

export function PlayerDirectoryContent({ players }: { players: SnookerPlayerListItem[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("zh-CN");
    return players.filter((player) => {
      if (filter === "china" && player.countryCode !== "CHN" && player.countryCode !== "CN") return false;
      if (filter === "top16" && (player.currentRank === null || player.currentRank > 16)) return false;
      if (filter === "current" && !player.isCurrentTour) return false;
      if (!needle) return true;
      const haystack = `${player.nameZh} ${player.shortNameZh ?? ""} ${player.nameEn} ${player.nationalityZh ?? ""}`.toLocaleLowerCase("zh-CN");
      return haystack.includes(needle);
    });
  }, [filter, players, query]);

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
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索中文名 / 英文名"
            aria-label="搜索球员"
          />
        </label>
        <div className={styles.filters}>
          {filters.map((item) => (
            <button className={filter === item.id ? styles.filterActive : ""} onClick={() => setFilter(item.id)} key={item.id}>
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
        <div className={styles.playerDirectory}>
          {filtered.length ? filtered.map((player) => (
            <button className={styles.playerRow} onPointerDown={() => router.prefetch(`/snooker/players/${player.slug}`)} onClick={() => router.push(`/snooker/players/${player.slug}`)} key={player.id}>
              <span className={styles.listAvatar}>
                {player.avatarUrl ? <img src={player.avatarUrl} alt="" loading="lazy" decoding="async" /> : <span>{initials(player.nameEn)}</span>}
              </span>
              <span className={styles.rowMain}>
                <b>{player.nameZh}</b>
                <small>{player.nameEn}</small>
                <p>
                  {player.nationalityZh ?? "国籍待补充"}
                  {!player.isCurrentTour ? <i>非现役巡回赛</i> : null}
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
          )) : <div className={styles.emptyState}>没有找到匹配的球员。<br />可以尝试中文名、英文名或切换筛选条件。</div>}
        </div>
      </section>
    </>
  );
}

export default function PlayerDirectory({ players }: { players: SnookerPlayerListItem[] }) {
  return <PlayerShell><PlayerDirectoryContent players={players} /></PlayerShell>;
}
