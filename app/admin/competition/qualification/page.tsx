import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminViewer } from "../../admin-viewer";
import { getAdminNavigationEvents } from "@/db/admin-ui";
import { getCompetitionBracketIndex } from "@/db/competition-tool-index";
import AdminWorkspaceShell from "../../admin-workspace-shell";
import "./qualification.css";

export const dynamic = "force-dynamic";

export default async function QualificationPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  const query = await searchParams;
  const events = await getAdminNavigationEvents(viewer.username);
  const eventId = events.some((event) => event.id === query.event) ? String(query.event) : events[0]?.id;
  if (!eventId) redirect("/admin/competition");
  const currentEvent = events.find((event) => event.id === eventId);
  const items = await getCompetitionBracketIndex(viewer.username, eventId);

  return <AdminWorkspaceShell viewer={{ displayName: viewer.displayName, role: viewer.role }} events={events} active="competition" pageTitle="晋级确认" pageHint="竞赛执行 · 晋级与候补" currentEventId={eventId} eventScoped competitionTool="qualification">
    <main className="qualification-page">
      <section className="qualification-hero"><div><small>QUALIFICATION CONTROL</small><h2>{currentEvent?.shortTitle || "晋级确认"}</h2><p>这里将统一处理分区冠军、局胜率候补、第二场资格赛名单以及种子缺席递补。当前先展示阶段状态，比分确认链路完成后自动开放。</p></div><strong>16直晋 + 8增补</strong></section>
      <section className="qualification-grid">{items.map((item) => <article key={item.drawSessionId}><span>{item.groupName}</span><h3>{item.phaseTitle}</h3><p>签表实际比赛 {item.playableMatchCount} 场 · 已排 {item.scheduledCount} 场</p><dl><div><dt>分区冠军</dt><dd>等待赛果确认</dd></div><div><dt>决胜负者候补池</dt><dd>等待局胜率计算</dd></div></dl><Link href={`/admin/competition/scoring?event=${encodeURIComponent(eventId)}`}>进入比分录入 / 确认</Link></article>)}</section>
      {!items.length && <section className="qualification-empty"><strong>还没有可计算晋级的签表</strong><p>请先完成抽签、完整签表和赛程编排。</p></section>}
      <section className="qualification-rule"><article><strong>资格赛第一场 / 第二场</strong><p>每个32人分区产生1名冠军直接晋级；16个分区的决胜负者进入候补池，按局胜率排序取前8名增补。</p></article><article><strong>种子缺席递补</strong><p>正赛种子未参赛时，空出的正赛席位从资格赛候补池按既定局胜率顺序递补，最终由组委会确认。</p></article></section>
    </main>
  </AdminWorkspaceShell>;
}
