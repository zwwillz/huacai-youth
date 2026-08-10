import { unstable_cache } from "next/cache";
import { getPublicSiteData, getPublishedEventIds } from "@/db/public";
import { getPublicContentState } from "@/db/public-content";
import { publicJson } from "../../../response";

export const dynamic = "force-static";
export const dynamicParams = true;
export const revalidate = 300;
export const runtime = "nodejs";

export async function generateStaticParams() {
  const useCiBuildFallback = process.env.GITHUB_ACTIONS === "true"
    && (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (useCiBuildFallback) return [];
  const eventIds = await getPublishedEventIds();
  return eventIds.map((eventId) => ({ eventId }));
}

function getCachedEventDetail(eventId: string) {
  return unstable_cache(async () => {
    const data = await getPublicSiteData();
    const station = data.stations.find((item) => item.eventId === eventId) ?? null;
    if (!station) return null;
    const [contentState] = await getPublicContentState([
      { id: station.id, eventId: station.eventId, title: station.title },
    ]);
    return { station, contentState: contentState ?? null };
  }, ["public-event-detail-v4", eventId], {
    revalidate: 300,
    tags: ["public-site", "public-content", `public-event-detail-${eventId}`],
  })();
}

export async function GET(request: Request, context: { params: Promise<{ eventId: string }> }) {
  const startedAt = performance.now();
  try {
    const { eventId } = await context.params;
    if (!eventId) return publicJson(request, { error: "缺少赛事ID。" }, { status: 400, cache: false });
    const data = await getCachedEventDetail(eventId);
    if (!data) return publicJson(request, { error: "EVENT_NOT_FOUND" }, { status: 404, cache: false, durationMs: performance.now() - startedAt });
    return publicJson(request, { data }, { durationMs: performance.now() - startedAt });
  } catch (error) {
    return publicJson(request, {
      error: error instanceof Error ? error.message : "赛事详情读取失败。",
    }, { status: 500, cache: false, durationMs: performance.now() - startedAt });
  }
}
