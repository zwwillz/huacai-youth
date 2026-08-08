import { getCompetitionPublicationVersion } from "@/db/public-competition-published";
import { publicJson } from "../../../../response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ eventId: string }> }) {
  const startedAt = performance.now();
  try {
    const { eventId } = await context.params;
    if (!eventId) return publicJson(request, { error: "缺少赛事ID。" }, { status: 400, cache: false });
    const version = await getCompetitionPublicationVersion(eventId);
    return publicJson(request, { data: { version } }, { cache: false, durationMs: performance.now() - startedAt });
  } catch (error) {
    return publicJson(request, { error: error instanceof Error ? error.message : "赛事版本读取失败。" }, { status: 500, cache: false, durationMs: performance.now() - startedAt });
  }
}
