import { redirect } from "next/navigation";
import { getAdminViewer } from "../../admin-viewer";
import { getAdminNavigationEvents } from "@/db/admin-ui";
import { getFinalRankingWorkspaceData } from "@/db/final-ranking-engine";
import { getCompetitionContextData } from "@/db/competition-context";
import AdminWorkspaceShell from "../../admin-workspace-shell";
import CompetitionContextBar from "../competition-context-bar";
import FinalRankingClient from "./final-ranking-client";
import "../competition-context-bar.css";
import "./final-ranking.css";

export const dynamic = "force-dynamic";

export default async function FinalRankingPage({ searchParams }: { searchParams: Promise<{ event?: string; group?: string }> }) {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  const query = await searchParams;
  const events = await getAdminNavigationEvents(viewer.username);
  const eventId = events.some((event) => event.id === query.event) ? String(query.event) : events[0]?.id;
  if (!eventId) redirect("/admin/competition");
  try {
    const [data, context] = await Promise.all([
      getFinalRankingWorkspaceData(viewer.username, eventId),
      getCompetitionContextData(viewer.username, eventId),
    ]);
    const selectedGroupId = context.groups.some((group) => group.id === query.group) ? String(query.group) : context.groups[0]?.id || "";
    const selected = data.groups.find((group) => group.groupId === selectedGroupId);
    const filtered = { ...data, groups: selected ? [selected] : [] };
    return <AdminWorkspaceShell viewer={{ displayName: viewer.displayName, role: viewer.role }} events={events} active="competition" pageTitle="最终排名" pageHint="竞赛执行 · 自动生成 / 人工调整 / 确认 / 发布" currentEventId={eventId} eventScoped competitionTool="ranking">
      <CompetitionContextBar eventId={eventId} eventTitle={context.event.shortTitle} groups={context.groups} selectedGroupId={selectedGroupId} basePath="/admin/competition/final-ranking" eyebrow="最终排名" title={`${context.groups.find((group) => group.id === selectedGroupId)?.name || "当前组别"} · 本站最终成绩`} description="系统根据正式赛果自动生成64人排名。组委会可以在草稿阶段触发人工调整；确认后锁定，发布后用户端才显示正式排名。" />
      <FinalRankingClient initialData={filtered} />
    </AdminWorkspaceShell>;
  } catch (error) {
    return <AdminWorkspaceShell viewer={{ displayName: viewer.displayName, role: viewer.role }} events={events} active="competition" pageTitle="最终排名" pageHint="竞赛执行 · 排名确认与发布" currentEventId={eventId} eventScoped competitionTool="ranking">
      <main className="backend-state backend-denied"><div className="backend-state-logo">榜</div><small>最终排名</small><h1>暂时不能进入最终排名</h1><p>{error instanceof Error ? error.message : "最终排名读取失败。"}</p><a href="/admin/competition">返回竞赛执行</a></main>
    </AdminWorkspaceShell>;
  }
}
