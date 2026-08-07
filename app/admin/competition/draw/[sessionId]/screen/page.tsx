import { redirect } from "next/navigation";
import { getAdminViewer } from "../../../../admin-viewer";
import { getDrawSessionDetail } from "@/db/draw-engine";
import DrawScreenClient from "./draw-screen-client";
import { captureAdminLoad } from "../../../../capture-admin-load";
import "./draw-screen.css";

export const dynamic = "force-dynamic";

export default async function DrawScreenPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  const { sessionId } = await params;
  const result = await captureAdminLoad(getDrawSessionDetail(viewer.username, sessionId));
  if (!result.data) return <main className="backend-state backend-denied"><div className="backend-state-logo">签</div><small>抽签大屏</small><h1>暂时不能打开这次抽签</h1><p>{result.error instanceof Error ? result.error.message : "抽签数据读取失败。"}</p><a href="/admin/competition">返回竞赛执行</a></main>;
  return <DrawScreenClient data={result.data} />;
}
