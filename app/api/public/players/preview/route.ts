import { unstable_cache } from "next/cache";
import { getCompetitionMatches } from "@/db/competition-matches";
import { getPublicPlayerDetail } from "@/db/player-data";
import { publicJson } from "../../response";
import { getCachedPublicPlayerSummaries } from "../cache";

export const dynamic = "force-static";
export const revalidate = 300;
export const runtime = "nodejs";

const getCachedPreview = unstable_cache(async () => {
  const summaries = await getCachedPublicPlayerSummaries();
  const summary = summaries[0] ?? null;
  const player = summary ? await getPublicPlayerDetail(summary.id) : null;
  const eventId = player?.events[0]?.eventId;
  const eventMatches = eventId ? await getCompetitionMatches(eventId) : [];
  const matches = summary ? eventMatches.filter((match) => match.playerAId === summary.id || match.playerBId === summary.id) : [];
  return { player, matches };
}, ["public-player-preview-v3"], { revalidate: 300, tags: ["public-players"] });

export async function GET(request: Request) {
  const startedAt = performance.now();
  try {
    const useCiBuildFallback = process.env.GITHUB_ACTIONS === "true"
      && (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY);
    const data = useCiBuildFallback ? { player: null, matches: [] } : await getCachedPreview();
    return publicJson(request, { data }, { durationMs: performance.now() - startedAt });
  } catch (error) {
    return publicJson(
      request,
      { error: error instanceof Error ? error.message : "球员模式预览读取失败。" },
      { status: 500, cache: false, durationMs: performance.now() - startedAt },
    );
  }
}
