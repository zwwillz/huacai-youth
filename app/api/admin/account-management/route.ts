import { getAdminViewer } from "@/app/admin/admin-viewer";
import { getAccountsForAdmin, updateAdminAccount, type AccountAction } from "@/db/account-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "请先登录后台。" }, { status: 401 });
  try {
    return Response.json({ data: await getAccountsForAdmin(viewer.username) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "账号列表读取失败。" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "请先登录后台。" }, { status: 401 });
  try {
    const input = await request.json() as AccountAction;
    if (!input?.action) throw new Error("缺少账号操作参数。");
    return Response.json({ data: await updateAdminAccount(viewer.username, input) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "账号操作失败。" }, { status: 400 });
  }
}
