import { getAdminViewer } from "@/app/admin/admin-viewer";
import { setPublicationStatus } from "@/db/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "请先登录后台。" }, { status: 401 });
  try {
    const body = await request.json() as { id?: string; status?: "draft" | "published" };
    if (!body.id || !body.status) throw new Error("缺少发布参数。");
    return Response.json({ data: await setPublicationStatus(viewer.email, body.id, body.status) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "发布状态更新失败。" }, { status: 400 });
  }
}
