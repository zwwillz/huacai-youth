"use client";

import type { SnookerPlayerDetail } from "@/lib/snooker/player-data";

type PlayerDetailResponse = {
  ok?: boolean;
  player?: SnookerPlayerDetail | null;
};

export type PlayerPrefetchPriority = "low" | "high";

type NetworkInformationLike = {
  saveData?: boolean;
  effectiveType?: string;
};

type NavigatorWithConnection = Navigator & {
  connection?: NetworkInformationLike;
};

const detailCache = new Map<string, SnookerPlayerDetail>();
const inflightCache = new Map<string, Promise<SnookerPlayerDetail | null>>();
const avatarPreloadCache = new Map<string, Promise<void>>();

export function detailAvatarUrl(value: string | null) {
  if (!value) return null;
  return value.includes("/wst/256/") ? value.replace("/wst/256/", "/wst/512/") : value;
}

function normalizePlayerDetail(player: SnookerPlayerDetail) {
  return { ...player, avatarUrl: detailAvatarUrl(player.avatarUrl) };
}

function shouldConserveLowPriorityData() {
  if (typeof navigator === "undefined") return false;
  const connection = (navigator as NavigatorWithConnection).connection;
  return Boolean(connection?.saveData || connection?.effectiveType === "slow-2g" || connection?.effectiveType === "2g");
}

export function preloadPlayerDetailAvatar(value: string | null, priority: PlayerPrefetchPriority = "low") {
  const target = detailAvatarUrl(value);
  if (!target || typeof window === "undefined") return Promise.resolve();
  if (priority === "low" && shouldConserveLowPriorityData()) return Promise.resolve();

  const existing = avatarPreloadCache.get(target);
  if (existing) return existing;

  const promise = new Promise<void>((resolve) => {
    const image = new Image();
    image.decoding = "async";
    image.fetchPriority = priority === "high" ? "high" : "low";
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    image.onload = finish;
    image.onerror = finish;
    image.src = target;
    if (typeof image.decode === "function") void image.decode().then(finish).catch(() => undefined);
  });

  avatarPreloadCache.set(target, promise);
  return promise;
}

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
      const player = payload.ok && payload.player ? normalizePlayerDetail(payload.player) : null;
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

export function prefetchPlayerExperience(
  slug: string,
  avatarUrl: string | null,
  priority: PlayerPrefetchPriority = "low",
) {
  if (priority === "low" && shouldConserveLowPriorityData()) return;
  void preloadPlayerDetailAvatar(avatarUrl, priority);
  void loadPlayerDetail(slug);
}

export function prefetchPlayerDetail(slug: string) {
  void loadPlayerDetail(slug);
}
