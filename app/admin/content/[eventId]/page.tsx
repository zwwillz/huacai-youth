import { redirect } from "next/navigation";
import { getAdminViewer } from "../../admin-viewer";
import { getContentManagementData } from "@/db/content-management";
import ContentManagementClient from "../content-management-client";
import "../content-management.css";
import "../content-extensions.css";

export const dynamic = "force-dynamic";

export default async function ContentManagementPage({ params }: { params: Promise<{ eventId: string }> }) {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  const { eventId } = await params;

  try {
    const data = await getContentManagementData(viewer.username, eventId);
    return <ContentManagementClient initialData={data} />;
  } catch (error) {
    return <main className="backend-state backend-denied">
      <div className="backend-state-logo">锁</div>
      <small>内容发布</small>
      <h1>暂时不能打开这场赛事的内容后台</h1>
      <p>{error instanceof Error ? error.message : "赛事内容读取失败。"}</p>
      <a href="/admin/content">返回内容发布</a>
    </main>;
  }
}
