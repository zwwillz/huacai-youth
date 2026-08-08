import { unstable_cache } from "next/cache";
import { getPublicPlayerSummaries, type PublicPlayerSummary } from "@/db/player-data";

export const PUBLIC_PLAYER_PAGE_SIZE = 120;

export const getCachedPublicPlayerSummaries = unstable_cache(
  getPublicPlayerSummaries,
  ["public-player-summaries-v2"],
  { revalidate: 300, tags: ["public-players"] },
);

export type PublicPlayerCounts = {
  全部: number;
  少年组: number;
  青年组: number;
};

export function publicPlayerCounts(players: PublicPlayerSummary[]): PublicPlayerCounts {
  const youth = players.filter((player) => player.group === "少年组").length;
  const young = players.filter((player) => player.group === "青年组").length;
  return { 全部: players.length, 少年组: youth, 青年组: young };
}

export function publicPlayerPage(players: PublicPlayerSummary[], page: number) {
  const offset = Math.max(page - 1, 0) * PUBLIC_PLAYER_PAGE_SIZE;
  const global = players.slice(offset, offset + PUBLIC_PLAYER_PAGE_SIZE);
  const youth = players.filter((player) => player.group === "少年组").slice(offset, offset + PUBLIC_PLAYER_PAGE_SIZE);
  const young = players.filter((player) => player.group === "青年组").slice(offset, offset + PUBLIC_PLAYER_PAGE_SIZE);
  const ids = new Set([...global, ...youth, ...young].map((player) => player.id));
  return players.filter((player) => ids.has(player.id));
}
