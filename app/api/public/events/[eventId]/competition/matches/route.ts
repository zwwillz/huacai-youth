import { getCompetitionPublicationVersion } from "@/db/public-competition-published";
import { publicJson } from "../../../../response";
import { competitionStaticParams, getCachedCompetitionEvent } from "../payload";

export const dynamic = "force-static";
export const dynamicParams = true;
export const revalidate = 300;
export const runtime = "nodejs";

export async function generateStaticParams() {
  return competitionStaticParams();
}

export async function GET(request: Request, context: { params: Promise<{ eventId: string }> }) {
  const startedAt = performance.now();
  try {
    const { eventId } = await context.params;
    if (!eventId) return publicJson(request, { error: "缺少赛事ID。" }, { status: 400, cache: false });
    const [version, event] = await Promise.all([
      getCompetitionPublicationVersion(eventId),
      getCachedCompetitionEvent(eventId),
    ]);
    return publicJson(request, { data: { version, event } }, { durationMs: performance.now() - startedAt });
  } catch (error) {
    return publicJson(request, { error: error instanceof Error ? error.message : "比赛数据读取失败。" }, { status: 500, cache: false, durationMs: performance.now() - startedAt });
  }
}
