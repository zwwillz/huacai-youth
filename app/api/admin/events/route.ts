import { getAdminViewer } from "@/app/admin/admin-viewer";
import { EventInput, saveEvent } from "@/db/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "请先登录后台。" }, { status: 401 });
  try {
    const input = await request.json() as EventInput;
    return Response.json({ data: await saveEvent(viewer.email, input) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "赛事保存失败。" }, { status: 400 });
  }
}
