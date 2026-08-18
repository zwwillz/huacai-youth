"use client";

import { useEffect, useState } from "react";
import type { SnookerPlayer } from "@/lib/snooker/domain";
import type { SnookerPlayerDetail, SnookerPlayerListItem } from "@/lib/snooker/player-data";
import { PlayerDetailContent } from "./player-detail-content";
import { getCachedPlayerDetail, loadPlayerDetail, preloadPlayerDetailAvatar } from "./player-detail-client";
import styles from "./player.module.css";

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
    isCurrentTour: player.isCurrentTour ?? player.currentRank !== null,
    tourStatus: player.tourStatus ?? (player.currentRank !== null ? "professional" : "unknown"),
    playerStatus: player.playerStatus ?? (player.currentRank !== null ? "tour" : player.turnedPro ? "former_pro" : "amateur"),
  };
}

function partialDetail(summary: SnookerPlayerListItem): SnookerPlayerDetail {
  return {
    ...summary,
    nicknameEn: null,
    nicknameZh: null,
    biographyEn: null,
    biographyZh: null,
    quoteEn: null,
    quoteZh: null,
    career: null,
    seasons: [],
    highlights: [],
  };
}

export default function PlayerDetailInline({
  summaryPlayer,
  slug,
}: {
  summaryPlayer?: SnookerPlayer;
  slug: string;
}) {
  const summary = summaryPlayer ? toSummary(summaryPlayer) : null;
  const cached = getCachedPlayerDetail(slug);
  const [loadedPlayer, setLoadedPlayer] = useState<SnookerPlayerDetail | null>(() => cached);
  const [displayAvatarUrl, setDisplayAvatarUrl] = useState<string | null>(() => cached?.avatarUrl ?? summary?.avatarUrl ?? null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (getCachedPlayerDetail(slug)) return;
    let cancelled = false;
    void loadPlayerDetail(slug).then((detail) => {
      if (cancelled) return;
      if (!detail) {
        setLoadFailed(true);
        return;
      }
      setLoadedPlayer(detail);
    });
    return () => { cancelled = true; };
  }, [slug]);

  const basePlayer = loadedPlayer ?? (summary ? partialDetail(summary) : null);

  useEffect(() => {
    const candidate = basePlayer?.avatarUrl ?? null;
    if (!candidate || candidate === displayAvatarUrl) return;
    let cancelled = false;
    void preloadPlayerDetailAvatar(candidate, "high").then(() => {
      if (!cancelled) setDisplayAvatarUrl(candidate);
    });
    return () => { cancelled = true; };
  }, [basePlayer?.avatarUrl, displayAvatarUrl]);

  const player = basePlayer
    ? { ...basePlayer, avatarUrl: displayAvatarUrl ?? basePlayer.avatarUrl }
    : null;

  return (
    <div className={styles.content}>
      {player ? <PlayerDetailContent player={player} /> : <section className={styles.card}><div className={styles.emptyState}>正在加载球员资料…</div></section>}
      {loadFailed ? <section className={styles.card}><div className={styles.emptyState}>深度球员资料暂时未能加载，基础资料仍可正常查看。</div></section> : null}
    </div>
  );
}
