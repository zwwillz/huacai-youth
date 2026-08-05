import { getAdminViewer } from "@/app/admin/admin-viewer";
import { bootstrapSystemAdmin } from "@/db/admin";

export const dynamic = "force-dynamic";

export async function POST() {
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "请先登录后台。" }, { status: 401 });
  try {
    return Response.json({ data: await bootstrapSystemAdmin(viewer.email, viewer.displayName) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "后台初始化失败。" }, { status: 400 });
  }
}
