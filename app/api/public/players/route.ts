import { unstable_cache } from "next/cache";
import { getPublicPlayerSummaries } from "@/db/player-data";
import { publicJson } from "../response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const getCachedPlayers = unstable_cache(getPublicPlayerSummaries, ["public-player-summaries-v2"], { revalidate: 300, tags: ["public-players"] });

export async function GET(request: Request) {
  const startedAt = performance.now();
  try {
    return publicJson(request, { data: await getCachedPlayers() }, { durationMs: performance.now() - startedAt });
  } catch (error) {
    return publicJson(request, { error: error instanceof Error ? error.message : "球员数据读取失败。" }, { status: 500, cache: false, durationMs: performance.now() - startedAt });
  }
}
