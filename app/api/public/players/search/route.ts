import { publicJson } from "../../response";
import { PUBLIC_PLAYER_PAGE_SIZE, getCachedPublicPlayerSummaries } from "../cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalizeGroup(value: string | null) {
  return value === "少年组" || value === "青年组" ? value : "全部";
}

export async function GET(request: Request) {
  const startedAt = performance.now();
  try {
    const url = new URL(request.url);
    const query = (url.searchParams.get("q") || "").trim();
    const group = normalizeGroup(url.searchParams.get("group"));
    const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
    if (!query) return publicJson(request, { data: [], total: 0, page, hasMore: false }, { durationMs: performance.now() - startedAt });

    const allPlayers = await getCachedPublicPlayerSummaries();
    const matched = allPlayers.filter((player) => {
      if (group !== "全部" && player.group !== group) return false;
      return player.name.includes(query) || player.displayName.includes(query);
    });
    const offset = (page - 1) * PUBLIC_PLAYER_PAGE_SIZE;
    const data = matched.slice(offset, offset + PUBLIC_PLAYER_PAGE_SIZE);
    return publicJson(request, {
      data,
      total: matched.length,
      page,
      pageSize: PUBLIC_PLAYER_PAGE_SIZE,
      hasMore: offset + data.length < matched.length,
    }, { durationMs: performance.now() - startedAt });
  } catch (error) {
    return publicJson(
      request,
      { error: error instanceof Error ? error.message : "球员搜索失败。" },
      { status: 500, cache: false, durationMs: performance.now() - startedAt },
    );
  }
}
