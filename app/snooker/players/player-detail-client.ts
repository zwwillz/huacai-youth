"use client";

import type { SnookerPlayerDetail } from "@/lib/snooker/player-data";

type PlayerDetailResponse = {
  ok?: boolean;
  player?: SnookerPlayerDetail | null;
};

const detailCache = new Map<string, SnookerPlayerDetail>();
const inflightCache = new Map<string, Promise<SnookerPlayerDetail | null>>();

export function getCachedPlayerDetail(slug: string) {
  return detailCache.get(slug) ?? null;
}

export async function loadPlayerDetail(slug: string): Promise<SnookerPlayerDetail | null> {
  const cached = detailCache.get(slug);
  if (cached) return cached;

  const inflight = inflightCache.get(slug);
  if (inflight) return inflight;

  const promise = fetch(`/api/snooker/v1/player-detail?slug=${encodeURIComponent(slug)}`, {
    cache: "force-cache",
  })
    .then(async (response) => {
      if (!response.ok) return null;
      const payload = await response.json() as PlayerDetailResponse;
      const player = payload.ok && payload.player ? payload.player : null;
      if (player) detailCache.set(slug, player);
      return player;
    })
    .catch(() => null)
    .finally(() => {
      inflightCache.delete(slug);
    });

  inflightCache.set(slug, promise);
  return promise;
}

export function prefetchPlayerDetail(slug: string) {
  void loadPlayerDetail(slug);
}
