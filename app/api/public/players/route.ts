import { unstable_cache } from "next/cache";
import { getPublicPlayerSummaries } from "@/db/player-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const getCachedPlayers = unstable_cache(getPublicPlayerSummaries, ["public-player-summaries-v2"], { revalidate: 300, tags: ["public-players"] });

export async function GET() {
  try {
    return Response.json({ data: await getCachedPlayers() }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "球员数据读取失败。" }, { status: 500 });
  }
}
