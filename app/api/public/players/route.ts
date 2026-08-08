import { publicJson } from "../response";
import {
  getCachedPublicPlayerSummaries,
  publicPlayerCounts,
  publicPlayerPage,
} from "./cache";

export const dynamic = "force-static";
export const revalidate = 300;
export const runtime = "nodejs";

export async function GET(request: Request) {
  const startedAt = performance.now();
  try {
    const useCiBuildFallback = process.env.GITHUB_ACTIONS === "true"
      && (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY);
    const allPlayers = useCiBuildFallback ? [] : await getCachedPublicPlayerSummaries();
    return publicJson(request, {
      data: publicPlayerPage(allPlayers, 1),
      counts: publicPlayerCounts(allPlayers),
      page: 1,
    }, { durationMs: performance.now() - startedAt });
  } catch (error) {
    return publicJson(
      request,
      { error: error instanceof Error ? error.message : "球员数据读取失败。" },
      { status: 500, cache: false, durationMs: performance.now() - startedAt },
    );
  }
}
