import { getAdminViewer } from "@/app/admin/admin-viewer";
import { confirmQualificationStage, getQualificationWorkspaceData } from "@/db/qualification-engine";
import { rebuildMainRosterIfReady } from "@/db/main-roster-engine";
import { markCompetitionModuleDirty } from "@/db/competition-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "请先登录后台。" }, { status: 401 });
  try {
    const url = new URL(request.url);
    const eventId = url.searchParams.get("eventId") || "";
    if (!eventId) throw new Error("缺少赛事ID。");
    return Response.json({ data: await getQualificationWorkspaceData(viewer.username, eventId) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "晋级数据读取失败。" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "请先登录后台。" }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action || "");
    if (action !== "confirm") throw new Error("不支持的晋级操作。");
    const drawSessionId = String(body.drawSessionId || "");
    if (!drawSessionId) throw new Error("缺少抽签版本ID。");
    const selectedRatePlayerIds = Array.isArray(body.selectedRatePlayerIds) ? body.selectedRatePlayerIds.map(String) : [];
    const data = await confirmQualificationStage(viewer.username, drawSessionId, selectedRatePlayerIds);
    const mainRoster = data.phaseCode === "qualifier-two" ? await rebuildMainRosterIfReady(data.eventId, data.groupId) : null;
    await markCompetitionModuleDirty(data.eventId, "schedule");
    return Response.json({ data: { ...data, mainRoster } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "晋级确认失败。" }, { status: 400 });
  }
}
