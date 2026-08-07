import { getAdminViewer } from "@/app/admin/admin-viewer";
import { confirmMatchResult, getScoringWorkspaceData, submitMatchResult } from "@/db/scoring-engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "请先登录后台。" }, { status: 401 });
  try {
    const url = new URL(request.url);
    const eventId = url.searchParams.get("eventId") || "";
    if (!eventId) throw new Error("缺少赛事ID。");
    return Response.json({ data: await getScoringWorkspaceData(viewer.username, eventId, {
      groupId: url.searchParams.get("group") || undefined,
      phaseCode: url.searchParams.get("phase") || undefined,
      date: url.searchParams.get("date") || undefined,
      showConfirmed: url.searchParams.get("view") === "all",
    }) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "比分数据读取失败。" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "请先登录后台。" }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action || "");
    if (action === "submit") {
      const assignmentId = String(body.assignmentId || "");
      if (!assignmentId) throw new Error("缺少比赛ID。");
      return Response.json({ data: await submitMatchResult(viewer.username, {
        assignmentId,
        resultType: String(body.resultType || "normal"),
        scoreA: body.scoreA === "" || body.scoreA === null || body.scoreA === undefined ? null : Number(body.scoreA),
        scoreB: body.scoreB === "" || body.scoreB === null || body.scoreB === undefined ? null : Number(body.scoreB),
        note: String(body.note || ""),
      }) });
    }
    if (action === "confirm") {
      const assignmentId = String(body.assignmentId || "");
      if (!assignmentId) throw new Error("缺少比赛ID。");
      return Response.json({ data: await confirmMatchResult(viewer.username, assignmentId) });
    }
    throw new Error("不支持的比分操作。");
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "比分操作失败。" }, { status: 400 });
  }
}
