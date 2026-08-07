import { unstable_cache } from "next/cache";
import { getCompetitionMatches } from "@/db/competition-matches";
import { getPublicPlayerDetail, getPublicPlayerSummaries } from "@/db/player-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const getCachedPreview = unstable_cache(async () => {
  const summaries = await getPublicPlayerSummaries();
  const summary = summaries[0] ?? null;
  const player = summary ? await getPublicPlayerDetail(summary.id) : null;
  const eventId = player?.events[0]?.eventId;
  const eventMatches = eventId ? await getCompetitionMatches(eventId) : [];
  const matches = summary ? eventMatches.filter((match) => match.playerAId === summary.id || match.playerBId === summary.id) : [];
  return { player, matches };
}, ["public-player-preview-v2"], { revalidate: 300, tags: ["public-players"] });

export async function GET() {
  try {
    return Response.json({ data: await getCachedPreview() }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "球员模式预览读取失败。" }, { status: 500 });
  }
}
