"use client";

import { useEffect, useMemo, useState } from "react";
import type { SnookerPlayer } from "@/lib/snooker/domain";
import type { SnookerPlayerDetail, SnookerPlayerListItem } from "@/lib/snooker/player-data";
import { PlayerDetailContent } from "./[slug]/player-detail";
import { getCachedPlayerDetail, loadPlayerDetail } from "./player-detail-client";
import PlayerShell, { type PlayerShellView } from "./player-shell";
import styles from "./player.module.css";

export type PlayerRootView = PlayerShellView;

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
    <PlayerShell onNavigate={onNavigate}>
      {player ? <PlayerDetailContent player={player} /> : <section className={styles.card}><div className={styles.emptyState}>正在加载球员资料…</div></section>}
    </PlayerShell>
  );
}
