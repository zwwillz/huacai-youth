import { publicJson } from "../../../response";
import {
  PUBLIC_PLAYER_PAGE_SIZE,
  getCachedPublicPlayerSummaries,
  publicPlayerCounts,
  publicPlayerPage,
} from "../../cache";

export const dynamic = "force-static";
export const dynamicParams = true;
export const revalidate = 300;
export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ page: string }> }) {
  const startedAt = performance.now();
  try {
    const { page: rawPage } = await context.params;
    const page = Math.max(1, Number.parseInt(rawPage, 10) || 1);
    const useCiBuildFallback = process.env.GITHUB_ACTIONS === "true"
      && (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY);
    const allPlayers = useCiBuildFallback ? [] : await getCachedPublicPlayerSummaries();
    const counts = publicPlayerCounts(allPlayers);
    const maxGroupCount = Math.max(counts.少年组, counts.青年组);
    const totalPages = Math.max(1, Math.ceil(maxGroupCount / PUBLIC_PLAYER_PAGE_SIZE));
    return publicJson(request, {
      data: publicPlayerPage(allPlayers, page),
      counts,
      page,
      pageSize: PUBLIC_PLAYER_PAGE_SIZE,
      hasMore: page < totalPages,
    }, { durationMs: performance.now() - startedAt });
  } catch (error) {
    return publicJson(
      request,
      { error: error instanceof Error ? error.message : "更多球员数据读取失败。" },
      { status: 500, cache: false, durationMs: performance.now() - startedAt },
    );
  }
}
