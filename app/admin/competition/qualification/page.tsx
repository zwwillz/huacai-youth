import { redirect } from "next/navigation";
import { getAdminViewer } from "../../admin-viewer";
import { getAdminNavigationEvents } from "@/db/admin-ui";
import { getQualificationWorkspaceData } from "@/db/qualification-engine";
import { getMainRosterSummaries } from "@/db/main-roster-engine";
import AdminWorkspaceShell from "../../admin-workspace-shell";
import QualificationWorkbenchClient from "./qualification-workbench-client";
import "./qualification.css";

export const dynamic = "force-dynamic";

export default async function QualificationPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  const query = await searchParams;
  const events = await getAdminNavigationEvents(viewer.username);
  const eventId = events.some((event) => event.id === query.event) ? String(query.event) : events[0]?.id;
  if (!eventId) redirect("/admin/competition");

  try {
    const [data, mainRosters] = await Promise.all([
      getQualificationWorkspaceData(viewer.username, eventId),
      getMainRosterSummaries(eventId),
    ]);
    return <AdminWorkspaceShell
      viewer={{ displayName: viewer.displayName, role: viewer.role }}
      events={events}
      active="competition"
      pageTitle="晋级确认"
      pageHint="竞赛执行 · 晋级与候补"
      currentEventId={eventId}
      eventScoped
      competitionTool="qualification"
    >
      <QualificationWorkbenchClient initialData={data} />
      <section className="qualification-main-roster">
        <header><div><small>MAIN DRAW ROSTER</small><h2>正赛64人名单状态</h2><p>两场资格赛各确认24人后，与16名已确认参赛的种子合并形成正赛第一阶段64人名单。</p></div></header>
        <div>{mainRosters.map((item) => <article key={item.groupId} className={item.ready ? "ready" : "waiting"}>
          <span>{item.groupName}</span><h3>{item.mainRosterCount}<small>/64</small></h3>
          <dl><div><dt>资格赛第一场</dt><dd>{item.qualifierOneCount}/24</dd></div><div><dt>资格赛第二场</dt><dd>{item.qualifierTwoCount}/24</dd></div><div><dt>已确认种子</dt><dd>{item.confirmedSeedCount}/16</dd></div></dl>
          <b>{item.ready ? "正赛64人已就绪" : "等待资格赛 / 种子确认"}</b>
        </article>)}</div>
      </section>
    </AdminWorkspaceShell>;
  } catch (error) {
    return <AdminWorkspaceShell viewer={{ displayName: viewer.displayName, role: viewer.role }} events={events} active="competition" pageTitle="晋级确认" pageHint="竞赛执行 · 晋级与候补" currentEventId={eventId} eventScoped competitionTool="qualification">
      <main className="backend-state backend-denied"><div className="backend-state-logo">晋</div><small>晋级确认</small><h1>暂时不能进入晋级确认</h1><p>{error instanceof Error ? error.message : "晋级数据读取失败。"}</p><a href="/admin/competition">返回竞赛执行</a></main>
    </AdminWorkspaceShell>;
  }
}
