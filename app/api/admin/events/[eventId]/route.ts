import { getAdminViewer } from "@/app/admin/admin-viewer";
import { deleteMistakenEvent } from "@/db/admin-ui";

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "请先登录后台。" }, { status: 401 });
  try {
    const { eventId } = await params;
    return Response.json({ data: await deleteMistakenEvent(viewer.username, eventId) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "赛事删除失败。" }, { status: 400 });
  }
}
