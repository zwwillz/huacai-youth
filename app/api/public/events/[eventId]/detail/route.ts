import { unstable_cache } from "next/cache";
import { getSqlClient } from "@/db";
import { getPublicSiteData, getPublishedEventIds } from "@/db/public";
import { getPublicContentState } from "@/db/public-content";
import { getPublicRegistrationInfo } from "@/db/registration-publishing";
import { registrationTimeState } from "@/db/registration-time-policy.mjs";
import { publicJson } from "../../../response";

export const dynamic = "force-static";
export const dynamicParams = true;
export const revalidate = 60;
export const runtime = "nodejs";

const STATUS_LABELS: Record<string, string> = {
  draft: "筹备中",
  registration_open: "报名中",
  registration_closed: "报名结束",
  upcoming: "即将开始",
  in_progress: "进行中",
  finished: "已结束",
  archived: "已结束",
  cancelled: "已取消",
};

async function getEffectivePublicStatus(eventId: string) {
  const sql = getSqlClient();
  const rows = await sql<Array<{ status: string; startAt: string | null; endAt: string | null }>>`
    select status,registration_start_at as "startAt",registration_end_at as "endAt"
    from public.events where id=${eventId} limit 1
  `;
  const row = rows[0];
  if (!row) return "状态待确认";
  if (row.status === "registration_open") {
    const state = registrationTimeState(row.startAt || "", row.endAt || "");
    if (state === "not_started") return "报名即将开始";
    if (state === "closed") return "报名已截止";
  }
  return STATUS_LABELS[row.status] ?? "状态待确认";
}

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
    const sourceStation = data.stations.find((item) => item.eventId === eventId) ?? null;
    if (!sourceStation) return null;
    const [[contentState], registration, status] = await Promise.all([
      getPublicContentState([{ id: sourceStation.id, eventId: sourceStation.eventId, title: sourceStation.title }]),
      getPublicRegistrationInfo(eventId),
      getEffectivePublicStatus(eventId),
    ]);
    return { station: { ...sourceStation, status }, contentState: contentState ?? null, registration };
  }, ["public-event-detail-v6", eventId], {
    revalidate: 60,
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
