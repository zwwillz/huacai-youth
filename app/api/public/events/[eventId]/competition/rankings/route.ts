import { getCompetitionPublicationVersion } from "@/db/public-competition-published";
import { publicJson } from "../../../../response";
import { competitionStaticParams, getCachedCompetitionRankings } from "../payload";

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
    const [version, rankings] = await Promise.all([
      getCompetitionPublicationVersion(eventId),
      getCachedCompetitionRankings(eventId),
    ]);
    return publicJson(request, { data: { version, rankings } }, { durationMs: performance.now() - startedAt });
  } catch (error) {
    return publicJson(request, { error: error instanceof Error ? error.message : "排名数据读取失败。" }, { status: 500, cache: false, durationMs: performance.now() - startedAt });
  }
}
