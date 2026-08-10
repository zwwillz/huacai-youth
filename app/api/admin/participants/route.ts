import { getAdminViewer } from "@/app/admin/admin-viewer";
import {
  confirmParticipantRoster,
  lockParticipantRoster,
  unlockParticipantRoster,
  updateParticipantRegistration,
} from "@/db/participant-roster";
import { getParticipantRosterPage } from "@/db/participant-roster-page";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function pageNumber(value: string | null) {
  const parsed = Number.parseInt(value || "1", 10);
  return Number.isFinite(parsed) ? Math.max(1, parsed) : 1;
}

async function pageData(viewer: NonNullable<Awaited<ReturnType<typeof getAdminViewer>>>, input: {
  eventId: string;
  groupId?: string | null;
  query?: string | null;
  review?: string | null;
  fee?: string | null;
  page?: number;
}) {
  return getParticipantRosterPage(viewer, {
    eventId: input.eventId,
    groupId: input.groupId,
    query: input.query,
    review: input.review,
    fee: input.fee,
    page: input.page,
    pageSize: 40,
  });
}

export async function GET(request: Request) {
  const startedAt = performance.now();
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "登录状态已失效，请重新登录。" }, { status: 401 });
  if (viewer.role === "referee") return Response.json({ error: "当前账号没有参赛人员管理权限。" }, { status: 403 });
  try {
    const url = new URL(request.url);
    const eventId = url.searchParams.get("event") || "";
    if (!eventId) throw new Error("缺少赛事ID。");
    const data = await pageData(viewer, {
      eventId,
      groupId: url.searchParams.get("group"),
      query: url.searchParams.get("q"),
      review: url.searchParams.get("review"),
      fee: url.searchParams.get("fee"),
      page: pageNumber(url.searchParams.get("page")),
    });
    return Response.json({ data }, {
      headers: {
        "Cache-Control": "private, no-store",
        "Server-Timing": `app;dur=${(performance.now() - startedAt).toFixed(1)}`,
      },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "参赛人员读取失败。" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const startedAt = performance.now();
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "登录状态已失效，请重新登录。" }, { status: 401 });
  if (viewer.role === "referee") return Response.json({ error: "当前账号没有参赛人员管理权限。" }, { status: 403 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action || "");
    const eventId = String(body.eventId || "");
    const groupId = String(body.groupId || "");
    if (!eventId || !groupId) throw new Error("缺少赛事或组别参数。");

    if (action === "update-registration") {
      const registrationId = String(body.registrationId || "");
      if (!registrationId) throw new Error("缺少报名记录ID。");
      await updateParticipantRegistration(viewer, {
        eventId,
        groupId,
        registrationId,
        reviewStatus: String(body.reviewStatus || ""),
        feeStatus: String(body.feeStatus || ""),
        reviewNote: String(body.reviewNote || ""),
      });
    } else if (action === "confirm-roster") {
      await confirmParticipantRoster(viewer, eventId, groupId);
    } else if (action === "lock-roster") {
      await lockParticipantRoster(viewer, eventId, groupId);
    } else if (action === "unlock-roster") {
      await unlockParticipantRoster(viewer, eventId, groupId, String(body.reason || ""));
    } else {
      throw new Error("不支持的参赛人员操作。");
    }

    const data = await pageData(viewer, {
      eventId,
      groupId,
      query: String(body.query || ""),
      review: String(body.review || "all"),
      fee: String(body.fee || "all"),
      page: Number(body.page || 1),
    });
    return Response.json({ data }, {
      headers: {
        "Cache-Control": "private, no-store",
        "Server-Timing": `app;dur=${(performance.now() - startedAt).toFixed(1)}`,
      },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "参赛人员操作失败。" }, { status: 400 });
  }
}
