import { getAdminViewer } from "@/app/admin/admin-viewer";
import { clearCompetitionSchedule, generateCompetitionSchedule, getScheduleWorkspaceData, saveCompetitionTables, saveCompetitionTimeSlots } from "@/db/schedule-engine";
import { updateScheduleAssignmentWithConflictCheck } from "@/db/schedule-guard";
import { markCompetitionModuleDirty } from "@/db/competition-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "请先登录后台。" }, { status: 401 });
  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("sessionId") || "";
    if (!sessionId) throw new Error("缺少抽签版本ID。");
    return Response.json({ data: await getScheduleWorkspaceData(viewer.username, sessionId) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "赛程数据读取失败。" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "请先登录后台。" }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action || "");
    const sessionId = String(body.sessionId || "");
    if (!sessionId) throw new Error("缺少抽签版本ID。");
    let data;
    if (action === "save_tables") data = await saveCompetitionTables(viewer.username, sessionId, { totalCount: Number(body.totalCount || 0), mode: body.mode === "manual" ? "manual" : "auto", tvPositions: Array.isArray(body.tvPositions) ? body.tvPositions.map(Number) : [], manualLabels: Array.isArray(body.manualLabels) ? body.manualLabels.map(String) : [] });
    else if (action === "save_time_slots") data = await saveCompetitionTimeSlots(viewer.username, sessionId, Array.isArray(body.slots) ? body.slots as Array<{ matchDate: string; startTime: string }> : []);
    else if (action === "generate") data = await generateCompetitionSchedule(viewer.username, sessionId, { minRestSlots: Number(body.minRestSlots || 0), autoAssignReferees: Boolean(body.autoAssignReferees) });
    else if (action === "clear") data = await clearCompetitionSchedule(viewer.username, sessionId);
    else if (action === "update_assignment") data = await updateScheduleAssignmentWithConflictCheck(viewer.username, sessionId, { assignmentId: String(body.assignmentId || ""), timeSlotId: body.timeSlotId ? String(body.timeSlotId) : null, tableId: body.tableId ? String(body.tableId) : null, refereeUserId: body.refereeUserId ? String(body.refereeUserId) : null });
    else throw new Error("不支持的赛程操作。");
    await markCompetitionModuleDirty(data.bracket.eventId, "schedule");
    return Response.json({ data });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "赛程操作失败。" }, { status: 400 });
  }
}
