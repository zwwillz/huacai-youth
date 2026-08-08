import { getPlayerAdminPageFast } from "@/db/player-admin-fast";
import { getAdminViewer } from "@/app/admin/admin-viewer";

export const dynamic = "force-dynamic";

function group(value: string | null) {
  return value === "少年组" || value === "青年组" ? value : "all";
}
function pageNumber(value: string | null) {
  const parsed = Number.parseInt(value || "1", 10);
  return Number.isFinite(parsed) ? Math.max(1, parsed) : 1;
}

export async function GET(request: Request) {
  const startedAt = performance.now();
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "登录状态已失效，请重新登录。" }, { status: 401 });
  if (viewer.role === "referee") return Response.json({ error: "当前账号没有球员管理权限。" }, { status: 403 });

  try {
    const url = new URL(request.url);
    const data = await getPlayerAdminPageFast(viewer, {
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
