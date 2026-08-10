import { getAdminViewer } from "@/app/admin/admin-viewer";
import { createPlayerArchive, getPlayerArchivePage } from "@/db/player-archive";

export const dynamic = "force-dynamic";

function group(value: string | null) {
  return value === "少年组" || value === "青年组" ? value : "all";
}
function pageNumber(value: string | null) {
  const parsed = Number.parseInt(value || "1", 10);
  return Number.isFinite(parsed) ? Math.max(1, parsed) : 1;
}
function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(request: Request) {
  const startedAt = performance.now();
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "登录状态已失效，请重新登录。" }, { status: 401 });
  if (viewer.role === "referee") return Response.json({ error: "当前账号没有球员档案权限。" }, { status: 403 });

  try {
    const url = new URL(request.url);
    const data = await getPlayerArchivePage(viewer, {
      eventId: url.searchParams.get("event"),
      scope: url.searchParams.get("scope") || undefined,
      group: group(url.searchParams.get("group")),
      query: (url.searchParams.get("q") || "").trim(),
      page: pageNumber(url.searchParams.get("page")),
      pageSize: 40,
    });
    return Response.json({ data }, { headers: { "Cache-Control": "private, no-store", "Server-Timing": `app;dur=${(performance.now() - startedAt).toFixed(1)}` } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "球员列表读取失败。" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const startedAt = performance.now();
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "登录状态已失效，请重新登录。" }, { status: 401 });
  if (viewer.role !== "system_admin") return Response.json({ error: "只有系统管理员可以新增球员档案。" }, { status: 403 });

  try {
    const body = await request.json() as Record<string, unknown>;
    const playerId = await createPlayerArchive(viewer, {
      fullName: text(body.fullName), nickname: text(body.nickname), gender: text(body.gender), birthDate: text(body.birthDate),
      nationalityCode: text(body.nationalityCode) || "CN", province: text(body.province), city: text(body.city), groupName: text(body.groupName),
      identityType: text(body.identityType) || "id_card", identityNo: text(body.identityNo), phone: text(body.phone), email: text(body.email),
      wechatId: text(body.wechatId), guardianName: text(body.guardianName), guardianRelationship: text(body.guardianRelationship), guardianPhone: text(body.guardianPhone),
      clubName: text(body.clubName), schoolName: text(body.schoolName), mentorName: text(body.mentorName), profileStatus: text(body.profileStatus) || "approved",
    });
    return Response.json({ data: { playerId }, message: "球员档案已创建。" }, { headers: { "Cache-Control": "private, no-store", "Server-Timing": `app;dur=${(performance.now() - startedAt).toFixed(1)}` } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "新增球员失败。" }, { status: 400 });
  }
}
