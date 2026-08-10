import { getAdminViewer } from "@/app/admin/admin-viewer";
import { deleteAdminPlayer } from "@/db/player-admin-delete";
import { getPlayerArchiveDetail, updatePlayerArchive } from "@/db/player-archive";

export const dynamic = "force-dynamic";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(request: Request, { params }: { params: Promise<{ playerId: string }> }) {
  const startedAt = performance.now();
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "登录状态已失效，请重新登录。" }, { status: 401 });
  if (viewer.role === "referee") return Response.json({ error: "当前账号没有球员档案权限。" }, { status: 403 });

  try {
    const { playerId } = await params;
    const url = new URL(request.url);
    const data = await getPlayerArchiveDetail(viewer, playerId, url.searchParams.get("event"));
    if (!data) return Response.json({ error: "没有找到球员档案，或当前账号没有查看权限。" }, { status: 404 });
    return Response.json({ data }, { headers: { "Cache-Control": "private, no-store", "Server-Timing": `app;dur=${(performance.now() - startedAt).toFixed(1)}` } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "球员详情读取失败。" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ playerId: string }> }) {
  const startedAt = performance.now();
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "登录状态已失效，请重新登录。" }, { status: 401 });
  if (viewer.role === "referee") return Response.json({ error: "当前账号没有球员档案编辑权限。" }, { status: 403 });

  try {
    const { playerId } = await params;
    const body = await request.json() as Record<string, unknown>;
    await updatePlayerArchive(viewer, playerId, {
      eventId: text(body.eventId) || null,
      fullName: text(body.fullName), nickname: text(body.nickname), gender: text(body.gender), birthDate: text(body.birthDate),
      nationalityCode: text(body.nationalityCode) || "CN", province: text(body.province), city: text(body.city), groupName: text(body.groupName),
      identityType: text(body.identityType) || "id_card", identityNo: text(body.identityNo), phone: text(body.phone), email: text(body.email),
      wechatId: text(body.wechatId), guardianName: text(body.guardianName), guardianRelationship: text(body.guardianRelationship), guardianPhone: text(body.guardianPhone),
      clubName: text(body.clubName), schoolName: text(body.schoolName), mentorName: text(body.mentorName), profileStatus: text(body.profileStatus) || "approved",
    });
    return Response.json({ data: { playerId }, message: "球员档案已更新。" }, { headers: { "Cache-Control": "private, no-store", "Server-Timing": `app;dur=${(performance.now() - startedAt).toFixed(1)}` } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "更新球员失败。" }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ playerId: string }> }) {
  const startedAt = performance.now();
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "登录状态已失效，请重新登录。" }, { status: 401 });
  if (viewer.role !== "system_admin") return Response.json({ error: "只有系统管理员可以删除球员档案。" }, { status: 403 });

  try {
    const { playerId } = await params;
    await deleteAdminPlayer(viewer.username, playerId);
    return Response.json({ data: { playerId }, message: "球员档案已永久删除。" }, { headers: { "Cache-Control": "private, no-store", "Server-Timing": `app;dur=${(performance.now() - startedAt).toFixed(1)}` } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "删除球员失败。" }, { status: 400 });
  }
}
