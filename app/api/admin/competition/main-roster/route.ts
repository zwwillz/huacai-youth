import { getAdminViewer } from "@/app/admin/admin-viewer";
import {
  assignSeedReplacement,
  clearSeedReplacement,
  confirmAllAvailableSeeds,
  confirmMain32Advancement,
  getMainRosterControlData,
  initializeSeedsFromPreviousStation,
  lockMainRoster,
  updateSeedAttendance,
  voidMainRosterLock,
  type SeedAttendanceStatus,
} from "@/db/main-competition-flow";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "请先登录后台。" }, { status: 401 });
  try {
    const url = new URL(request.url);
    const eventId = url.searchParams.get("eventId") || "";
    if (!eventId) throw new Error("缺少赛事ID。");
    return Response.json({ data: await getMainRosterControlData(viewer.username, eventId) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "正赛名单数据读取失败。" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "请先登录后台。" }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action || "");
    if (action === "initialize-seeds") {
      return Response.json({ data: await initializeSeedsFromPreviousStation(viewer.username, String(body.eventId || ""), String(body.groupId || "")) });
    }
    if (action === "seed-status") {
      return Response.json({ data: await updateSeedAttendance(viewer.username, String(body.seedEntryId || ""), String(body.attendanceStatus || "pending") as SeedAttendanceStatus, String(body.note || "")) });
    }
    if (action === "confirm-all-seeds") {
      return Response.json({ data: await confirmAllAvailableSeeds(viewer.username, String(body.eventId || ""), String(body.groupId || "")) });
    }
    if (action === "assign-replacement") {
      return Response.json({ data: await assignSeedReplacement(viewer.username, String(body.seedEntryId || ""), String(body.playerId || "")) });
    }
    if (action === "clear-replacement") {
      return Response.json({ data: await clearSeedReplacement(viewer.username, String(body.seedEntryId || "")) });
    }
    if (action === "lock-roster") {
      return Response.json({ data: await lockMainRoster(viewer.username, String(body.eventId || ""), String(body.groupId || "")) });
    }
    if (action === "unlock-roster") {
      return Response.json({ data: await voidMainRosterLock(viewer.username, String(body.lockId || ""), String(body.reason || "")) });
    }
    if (action === "confirm-main32") {
      return Response.json({ data: await confirmMain32Advancement(viewer.username, String(body.batchId || "")) });
    }
    throw new Error("不支持的正赛名单操作。");
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "正赛名单操作失败。" }, { status: 400 });
  }
}
