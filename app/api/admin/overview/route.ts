import { getAdminViewer } from "@/app/admin/admin-viewer";
import { getAdminSnapshot } from "@/db/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "请先登录后台。" }, { status: 401 });

  try {
    return Response.json({ data: await getAdminSnapshot(viewer.username) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "后台数据读取失败。" }, { status: 500 });
  }
}
