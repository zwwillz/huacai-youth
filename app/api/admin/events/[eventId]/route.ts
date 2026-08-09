import { getAdminViewer } from "@/app/admin/admin-viewer";
import { deleteMistakenEvent } from "@/db/admin-ui";
import { getSqlClient } from "@/db";
import { revalidateTag } from "next/cache";

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "请先登录后台。" }, { status: 401 });
  try {
    const { eventId } = await params;
    const sql = getSqlClient();
    const rows = await sql<Array<{ status: string }>>`select status from public.events where id=${eventId} limit 1`;
    const status = rows[0]?.status;
    if (!status) throw new Error("没有找到要删除的赛事。");
    if (["in_progress", "finished", "archived"].includes(status)) {
      throw new Error(status === "archived" ? "已归档赛事属于历史记录，不能删除。" : "该赛事已经开始执行或已经结束，不能删除。请保留赛事记录并在结束后归档。" );
    }
    const data = await deleteMistakenEvent(viewer.username, eventId);
    revalidateTag("admin-navigation-events", { expire: 0 });
    return Response.json({ data });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "赛事删除失败。" }, { status: 400 });
  }
}
