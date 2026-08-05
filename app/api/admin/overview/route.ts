import { getAdminViewer } from "@/app/admin/admin-viewer";
import { bootstrapSystemAdmin, getAccessState, getAdminSnapshot } from "@/db/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "请先登录后台。" }, { status: 401 });

  try {
    const access = await getAccessState(viewer.email);
    if (access.account && viewer.email.endsWith("@local.invalid")) {
      return Response.json({ data: await bootstrapSystemAdmin(viewer.email, viewer.displayName) });
    }
    if (!access.account) {
      return Response.json({
        error: access.setupAvailable ? "后台尚未初始化。" : "当前账号尚未获得后台权限。",
        setupAvailable: access.setupAvailable,
        viewer: { email: viewer.email, displayName: viewer.displayName },
      }, { status: 403 });
    }
    return Response.json({ data: await getAdminSnapshot(viewer.email) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "后台数据读取失败。" }, { status: 500 });
  }
}
