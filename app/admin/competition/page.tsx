import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminViewer } from "../admin-viewer";
import { getCompetitionDashboardData } from "@/db/competition-dashboard";
import AdminWorkspaceShell from "../admin-workspace-shell";
import "./competition.css";

export const dynamic = "force-dynamic";

const phases = [
  { code: "qualifier-one", no: "01", title: "资格赛第一场", note: "一次抽签 · 完整分区签表", source: "已审核参赛名单", active: true },
  { code: "qualifier-two", no: "02", title: "资格赛第二场", note: "重新抽签 · 未晋级球员", source: "第一场未晋级名单", active: false },
  { code: "main-one", no: "03", title: "正赛第一阶段", note: "资格赛晋级 + 可选种子", source: "48名资格赛晋级 + 种子", active: false },
  { code: "main-two", no: "04", title: "正赛第二阶段", note: "重新抽签 · 最终阶段", source: "正赛第一阶段晋级名单", active: false },
] as const;

function drawStatusLabel(status?: string) {
  if (!status) return "未抽签";
  if (status === "draft") return "抽签草稿";
  if (status === "confirmed") return "已确认";
  if (status === "void") return "已作废";
  return status;
}

export default async function CompetitionWorkspacePage({ searchParams }: { searchParams: Promise<{ event?: string; group?: string }> }) {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  const query = await searchParams;
  const data = await getCompetitionDashboardData(viewer.username, query.event);
  const currentEvent = data.events.find((event) => event.id === data.selectedEventId);
  const selectedGroup = data.groups.find((group) => group.id === query.group) ?? data.groups[0];
  const approvedCount = selectedGroup?.approvedCount ?? 0;
  const playoffCount = Math.max(0, approvedCount - 512);
  const byeCount = Math.max(0, 512 - approvedCount);

  return <AdminWorkspaceShell viewer={{ displayName: viewer.displayName, role: viewer.role }} events={data.events} active="competition" pageTitle="竞赛执行" pageHint="裁判工作区 · 动态竞赛数据" currentEventId={data.selectedEventId} eventScoped>
    <main className="competition-workspace-page">
      <section className="competition-workspace-shell">
        <header className="competition-workspace-head"><div><small>COMPETITION OPERATIONS</small><h1>{currentEvent?.shortTitle || "竞赛执行工作区"}</h1><p>从名单锁定、抽签、分区签表开始，之后依次接入赛程与球台、比分与赛果、晋级与排名。裁判组负责执行，组委会负责关键确认。</p></div><b>竞赛引擎 · 第一阶段</b></header>

        {data.groups.length > 0 && <nav className="competition-group-tabs">{data.groups.map((group) => <Link key={group.id} className={selectedGroup?.id === group.id ? "active" : ""} href={`/admin/competition?event=${encodeURIComponent(data.selectedEventId)}&group=${encodeURIComponent(group.id)}`}><strong>{group.name}</strong><span>{group.approvedCount} 人已审核</span></Link>)}</nav>}

        {selectedGroup && <section className="competition-qualifier-summary">
          <article><small>当前资格赛名单</small><strong>{approvedCount}</strong><span>人</span></article>
          <article><small>标准签表</small><strong>512</strong><span>签位</span></article>
          <article><small>自动附加赛</small><strong>{playoffCount}</strong><span>场</span></article>
          <article><small>自动轮空</small><strong>{byeCount}</strong><span>个</span></article>
          <article><small>默认分区</small><strong>16</strong><span>区 × 32人</span></article>
          <article><small>单场资格赛晋级</small><strong>24</strong><span>16直晋 + 8增补</span></article>
        </section>}

        <section className="competition-stage-board">
          <header><div><small>EVENT STAGES</small><h2>竞赛阶段</h2><p>资格赛第一场 / 第二场各自只抽签一次，从实际人数进入标准签表后，在同一张分区签表中连续比赛到每区冠军。</p></div></header>
          <div className="competition-stage-grid">{phases.map((phase) => {
            const draw = selectedGroup?.draws[phase.code];
            return <article key={phase.code} className={phase.active ? "ready" : "planned"}>
              <div className="competition-stage-no">{phase.no}</div>
              <div className="competition-stage-copy"><span>{phase.note}</span><h3>{phase.title}</h3><p>名单来源：{phase.source}</p></div>
              <dl><div><dt>抽签状态</dt><dd>{drawStatusLabel(draw?.status)}</dd></div>{draw && <><div><dt>版本</dt><dd>V{draw.versionNo}</dd></div><div><dt>抽签人数</dt><dd>{draw.entrantCount}</dd></div></>}</dl>
              <Link href={selectedGroup ? `/admin/competition/draw?event=${encodeURIComponent(data.selectedEventId)}&group=${encodeURIComponent(selectedGroup.id)}&phase=${phase.code}` : "/admin/competition"}>{phase.active ? (draw ? "查看抽签 →" : "进入抽签引擎 →") : "查看规则准备 →"}</Link>
            </article>;
          })}</div>
        </section>

        <section className="competition-flow">
          <article className="available"><span>01</span><h2>抽签与签表</h2><p>已开始开发：实际人数、附加赛、轮空、32人分区、抽签版本、现场抽签大屏。</p><b>当前可测试资格赛第一场</b></article>
          <i>→</i>
          <article><span>02</span><h2>赛程与球台</h2><p>由确认后的签表产生比赛关系，再自动编排日期、时间、球台与TV台。</p><b>下一阶段</b></article>
          <i>→</i>
          <article><span>03</span><h2>比分与赛果</h2><p>裁判现场录分、特殊赛果、更正与确认，结果驱动自动晋级。</p><b>后续接入</b></article>
          <i>→</i>
          <article><span>04</span><h2>晋级与排名</h2><p>每区冠军直接晋级；各区决胜轮负者按局胜率排序增补，种子缺席也从候补池递补。</p><b>后续接入</b></article>
        </section>

        <section className="competition-principles"><article><strong>资格赛规则已经固化到引擎设计</strong><p>512签表默认划分16个32人分区，每区产生1名直接晋级球员；16名分区决胜轮负者进入候补池，按局胜率取前8名，因此单场资格赛共24人晋级。</p></article><article><strong>种子从数据层预留</strong><p>正赛第一阶段可以配置是否启用种子及种子数量。种子不参赛导致正赛缺额时，系统将按资格赛候补池局胜率顺序增补，但需要组委会确认。</p></article><article><strong>抽签结果可审计</strong><p>真正随机结果在服务器一次性生成并保存版本；现场大屏只负责动画揭晓。重抽必须作废旧版本并填写原因，历史操作写入日志。</p></article></section>
      </section>
    </main>
  </AdminWorkspaceShell>;
}
