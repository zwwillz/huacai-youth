"use client";

import { useEffect, useMemo, useState } from "react";
import type { SnookerPlayer } from "@/lib/snooker/domain";
import type { SnookerPlayerDetail, SnookerPlayerListItem } from "@/lib/snooker/player-data";
import { PlayerDetailContent } from "./[slug]/player-detail";
import { getCachedPlayerDetail, loadPlayerDetail } from "./player-detail-client";
import styles from "../snooker-data-center.module.css";
import polish from "../snooker-ui-polish.module.css";

export type PlayerRootView = "home" | "matches" | "players" | "data";

const navItems: Array<{ id: PlayerRootView; label: string; icon: string }> = [
  { id: "home", label: "首页", icon: "⌂" },
  { id: "matches", label: "赛事", icon: "◫" },
  { id: "players", label: "球员", icon: "◎" },
  { id: "data", label: "数据", icon: "▥" },
];

function toSummary(player: SnookerPlayer): SnookerPlayerListItem {
  return {
    id: player.id,
    slug: player.slug,
    nameEn: player.nameEn,
    nameZh: player.nameZh,
    shortNameZh: player.shortNameZh || null,
    nationalityZh: player.nationalityZh || null,
    countryCode: player.countryCode || null,
    dateOfBirth: player.dateOfBirth ?? null,
    turnedPro: player.turnedPro ?? null,
    currentRank: player.currentRank,
    rankingPoints: player.rankingPoints,
    avatarUrl: player.avatarUrl || player.avatar?.url || null,
    isCurrentTour: player.currentRank !== null,
    tourStatus: player.currentRank !== null ? "current" : "unknown",
  };
}

function partialDetail(summary: SnookerPlayerListItem): SnookerPlayerDetail {
  return {
    ...summary,
    nicknameEn: null,
    biographyEn: null,
    quoteEn: null,
    career: null,
    seasons: [],
    highlights: [],
  };
}

export default function PlayerDetailInline({
  summaryPlayer,
  slug,
  onNavigate,
}: {
  summaryPlayer?: SnookerPlayer;
  slug: string;
  onNavigate: (view: PlayerRootView) => void;
}) {
  const [theme, setTheme] = useState<"green" | "red">("green");
  const summary = useMemo(() => summaryPlayer ? toSummary(summaryPlayer) : null, [summaryPlayer]);
  const [player, setPlayer] = useState<SnookerPlayerDetail | null>(() => getCachedPlayerDetail(slug) ?? (summary ? partialDetail(summary) : null));

  useEffect(() => {
    const cached = getCachedPlayerDetail(slug);
    if (cached) {
      setPlayer(summary?.avatarUrl && !cached.avatarUrl ? { ...cached, avatarUrl: summary.avatarUrl } : cached);
      return;
    }

    if (summary) setPlayer(partialDetail(summary));
    let cancelled = false;
    void loadPlayerDetail(slug).then((detail) => {
      if (cancelled || !detail) return;
      setPlayer(summary?.avatarUrl && !detail.avatarUrl ? { ...detail, avatarUrl: summary.avatarUrl } : detail);
    });
    return () => { cancelled = true; };
  }, [slug, summary]);

  return (
    <main className={styles.appRoot} data-theme={theme}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <button className={styles.brand} onClick={() => onNavigate("home")} aria-label="返回世界斯诺克数据中心首页">
            <span>S</span>
            <div><strong>世界斯诺克数据中心</strong><small>WORLD SNOOKER DATA</small></div>
          </button>
          <div className={styles.headerRight}>
            <span className={styles.versionBadge}>DATA v0.9</span>
            <div className={styles.themeSwitch} aria-label="主题色">
              <button className={theme === "green" ? styles.themeActive : ""} onClick={() => setTheme("green")}>绿</button>
              <button className={theme === "red" ? styles.themeActive : ""} onClick={() => setTheme("red")}>红</button>
            </div>
          </div>
        </header>

        <div className={styles.content}>
          {player ? <PlayerDetailContent player={player} /> : <section className={styles.card}><div className={styles.emptyState}>正在加载球员资料…</div></section>}
        </div>

        <nav className={`${styles.bottomNav} ${polish.fastNav}`} aria-label="世界斯诺克数据中心主导航">
          {navItems.map((item) => (
            <button key={item.id} className={item.id === "players" ? styles.activeNav : ""} onClick={() => onNavigate(item.id)}>
              <span>{item.icon}</span><b>{item.label}</b>
            </button>
          ))}
        </nav>
      </div>
    </main>
  );
}
