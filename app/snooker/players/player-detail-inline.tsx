"use client";

import { useEffect, useMemo, useState } from "react";
import type { SnookerPlayer } from "@/lib/snooker/domain";
import type { SnookerPlayerDetail, SnookerPlayerListItem } from "@/lib/snooker/player-data";
import { PlayerDetailContent } from "./player-detail-content";
import { getCachedPlayerDetail, loadPlayerDetail } from "./player-detail-client";
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
}: {
  summaryPlayer?: SnookerPlayer;
  slug: string;
}) {
  const summary = useMemo(() => summaryPlayer ? toSummary(summaryPlayer) : null, [summaryPlayer]);
  const [player, setPlayer] = useState<SnookerPlayerDetail | null>(() => getCachedPlayerDetail(slug) ?? (summary ? partialDetail(summary) : null));
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    setLoadFailed(false);
    const cached = getCachedPlayerDetail(slug);
    if (cached) {
      setPlayer(summary?.avatarUrl && !cached.avatarUrl ? { ...cached, avatarUrl: summary.avatarUrl } : cached);
      return;
    }

    setPlayer(summary ? partialDetail(summary) : null);
    let cancelled = false;
    void loadPlayerDetail(slug).then((detail) => {
      if (cancelled) return;
      if (!detail) {
        setLoadFailed(true);
        return;
      }
      setPlayer(summary?.avatarUrl && !detail.avatarUrl ? { ...detail, avatarUrl: summary.avatarUrl } : detail);
    });
    return () => { cancelled = true; };
  }, [slug, summary]);

  return (
    <div className={styles.content}>
      {player ? <PlayerDetailContent player={player} /> : <section className={styles.card}><div className={styles.emptyState}>正在加载球员资料…</div></section>}
      {loadFailed ? <section className={styles.card}><div className={styles.emptyState}>深度球员资料暂时未能加载，基础资料仍可正常查看。</div></section> : null}
    </div>
  );
}
