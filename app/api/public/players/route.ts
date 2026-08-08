import { unstable_cache } from "next/cache";
import { getPublicPlayerSummaries } from "@/db/player-data";

export const dynamic = "force-static";
export const revalidate = 300;
export const runtime = "nodejs";

const getCachedPlayers = unstable_cache(getPublicPlayerSummaries, ["public-player-summaries-v2"], { revalidate: 300, tags: ["public-players"] });

export async function GET() {
  const startedAt = performance.now();
  try {
    const useCiBuildFallback = process.env.GITHUB_ACTIONS === "true"
      && (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY);
    const data = useCiBuildFallback ? [] : await getCachedPlayers();
    return Response.json({ data }, {
      headers: {
        "cache-control": "public, max-age=60, s-maxage=300, stale-while-revalidate=86400",
        "server-timing": `app;dur=${(performance.now() - startedAt).toFixed(1)}`,
      },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "球员数据读取失败。" },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
