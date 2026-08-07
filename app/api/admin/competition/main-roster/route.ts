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
import { assertMainRosterMutable, assertSeedEntryMutable, assertSeedReplacementAllowed } from "@/db/main-roster-lock-check";
import { markCompetitionModuleDirty } from "@/db/competition-context";
import { getSqlClient } from "@/db/index";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function eventForReference(table: "competition_main_roster_locks" | "competition_main_advancement_batches", id: string) {
  const sql = getSqlClient();
  if (table === "competition_main_roster_locks") {
    const rows = await sql<Array<{ eventId: string }>>`select event_id as "eventId" from public.competition_main_roster_locks where id=${id} limit 1`;
    return rows[0]?.eventId ?? "";
  }
  const rows = await sql<Array<{ eventId: string }>>`select event_id as "eventId" from public.competition_main_advancement_batches where id=${id} limit 1`;
  return rows[0]?.eventId ?? "";
}
async function dirty(eventId: string) { if (eventId) await markCompetitionModuleDirty(eventId, "schedule"); }

export async function GET(request: Request) {
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "请先登录后台。" }, { status: 401 });
  try {
    const eventId = new URL(request.url).searchParams.get("eventId") || "";
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
    const bodyEventId = String(body.eventId || "");
    if (action === "initialize-seeds") {
      const groupId = String(body.groupId || ""); await assertMainRosterMutable(bodyEventId, groupId);
      const data = await initializeSeedsFromPreviousStation(viewer.username, bodyEventId, groupId); await dirty(bodyEventId); return Response.json({ data });
    }
    if (action === "seed-status") {
      const seedEntryId = String(body.seedEntryId || ""); const scope = await assertSeedEntryMutable(seedEntryId);
      const data = await updateSeedAttendance(viewer.username, seedEntryId, String(body.attendanceStatus || "pending") as SeedAttendanceStatus, String(body.note || "")); await dirty(scope.eventId); return Response.json({ data });
    }
    if (action === "confirm-all-seeds") {
      const groupId = String(body.groupId || ""); await assertMainRosterMutable(bodyEventId, groupId);
      const data = await confirmAllAvailableSeeds(viewer.username, bodyEventId, groupId); await dirty(bodyEventId); return Response.json({ data });
    }
    if (action === "assign-replacement") {
      const seedEntryId = String(body.seedEntryId || ""); const scope = await assertSeedReplacementAllowed(seedEntryId);
      const data = await assignSeedReplacement(viewer.username, seedEntryId, String(body.playerId || "")); await dirty(scope.eventId); return Response.json({ data });
    }
    if (action === "clear-replacement") {
      const seedEntryId = String(body.seedEntryId || ""); const scope = await assertSeedEntryMutable(seedEntryId);
      const data = await clearSeedReplacement(viewer.username, seedEntryId); await dirty(scope.eventId); return Response.json({ data });
    }
    if (action === "lock-roster") {
      const groupId = String(body.groupId || ""); await assertMainRosterMutable(bodyEventId, groupId);
      const data = await lockMainRoster(viewer.username, bodyEventId, groupId); await dirty(bodyEventId); return Response.json({ data });
    }
    if (action === "unlock-roster") {
      const lockId = String(body.lockId || ""); const eventId = await eventForReference("competition_main_roster_locks", lockId);
      const data = await voidMainRosterLock(viewer.username, lockId, String(body.reason || "")); await dirty(eventId); return Response.json({ data });
    }
    if (action === "confirm-main32") {
      const batchId = String(body.batchId || ""); const eventId = await eventForReference("competition_main_advancement_batches", batchId);
      const data = await confirmMain32Advancement(viewer.username, batchId); await dirty(eventId); return Response.json({ data });
    }
    throw new Error("不支持的正赛名单操作。");
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "正赛名单操作失败。" }, { status: 400 });
  }
}
