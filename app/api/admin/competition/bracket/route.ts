import { getAdminViewer } from "@/app/admin/admin-viewer";
import { generateBracketFromConfirmedDraw, getBracketDetail } from "@/db/bracket-engine";
import { getDrawSessionDetail } from "@/db/draw-engine";
import { generateMainStageBracket, isMainPhase } from "@/db/main-stage-engine";
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
    return Response.json({ data: await getBracketDetail(viewer.username, sessionId, true) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "签表读取失败。" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "请先登录后台。" }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action || "generate");
    const sessionId = String(body.sessionId || "");
    if (!sessionId) throw new Error("缺少抽签版本ID。");
    if (action !== "generate") throw new Error("不支持的签表操作。");
    const draw = await getDrawSessionDetail(viewer.username, sessionId);
    const data = isMainPhase(draw.session.phaseCode)
      ? (await generateMainStageBracket(viewer.username, sessionId), await getBracketDetail(viewer.username, sessionId, true))
      : await generateBracketFromConfirmedDraw(viewer.username, sessionId);
    await markCompetitionModuleDirty(draw.session.eventId, "schedule");
    return Response.json({ data });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "签表生成失败。" }, { status: 400 });
  }
}
