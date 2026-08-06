import { getAdminViewer } from "@/app/admin/admin-viewer";
import {
  confirmDrawSession,
  getDrawSessionDetail,
  getDrawWorkspaceData,
  voidDrawSession,
  type DrawPhaseCode,
} from "@/db/draw-engine";
import { createQualificationDrawFast } from "@/db/draw-engine-write";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "请先登录后台。" }, { status: 401 });
  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("sessionId");
    if (sessionId) return Response.json({ data: await getDrawSessionDetail(viewer.username, sessionId) });
    const eventId = url.searchParams.get("eventId") || "";
    const groupId = url.searchParams.get("groupId") || undefined;
    const phaseCode = (url.searchParams.get("phaseCode") || "qualifier-one") as DrawPhaseCode;
    if (!eventId) throw new Error("缺少赛事ID。");
    return Response.json({ data: await getDrawWorkspaceData(viewer.username, eventId, groupId, phaseCode) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "抽签数据读取失败。" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "请先登录后台。" }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action || "");
    if (action === "create") {
      const eventId = String(body.eventId || "");
      const groupId = String(body.groupId || "");
      const phaseCode = String(body.phaseCode || "qualifier-one") as DrawPhaseCode;
      if (!eventId || !groupId) throw new Error("缺少赛事或组别参数。");
      const data = await createQualificationDrawFast(viewer.username, {
        eventId,
        groupId,
        phaseCode,
        bracketSize: Number(body.bracketSize || 512),
        divisionSize: Number(body.divisionSize || 32),
        rateQualifierCount: Number(body.rateQualifierCount || 0),
        seedsEnabled: Boolean(body.seedsEnabled),
        seedTargetCount: Number(body.seedTargetCount || 0),
        seedFillRule: String(body.seedFillRule || "game_win_rate"),
      });
      return Response.json({ data });
    }
    if (action === "confirm") {
      const sessionId = String(body.sessionId || "");
      if (!sessionId) throw new Error("缺少抽签版本ID。");
      return Response.json({ data: await confirmDrawSession(viewer.username, sessionId) });
    }
    if (action === "void") {
      const sessionId = String(body.sessionId || "");
      if (!sessionId) throw new Error("缺少抽签版本ID。");
      return Response.json({ data: await voidDrawSession(viewer.username, sessionId, String(body.reason || "")) });
    }
    throw new Error("不支持的抽签操作。");
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "抽签操作失败。" }, { status: 400 });
  }
}
