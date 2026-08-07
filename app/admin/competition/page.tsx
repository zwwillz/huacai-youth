import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminViewer } from "../admin-viewer";
import { getCompetitionDashboardData } from "@/db/competition-dashboard";
import AdminWorkspaceShell from "../admin-workspace-shell";
import "./competition.css";

export const dynamic = "force-dynamic";

const phases = [
  { code: "qualifier-one", no: "01", title: "资格赛第一场", note: "一次抽签 · 完整分区签表", source: "已审核参赛名单", active: true },
  { code: "qualifier-two", no: "02", title: "资格赛第二场", note: "独立抽签 · 第一场未晋级球员", source: "第一场晋级确认后自动生成", active: true },
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

  return <AdminWorkspaceShell viewer={{ displayName: viewer.displayName, role: viewer.role }} events={data.events} active="competition" pageTitle="抽签与签表" pageHint="竞赛执行 · 阶段控制" currentEventId={data.selectedEventId} eventScoped competitionTool="overview">
    <main className="competition-workspace-page">
      <section className="competition-workspace-shell">
        <header className="competition-workspace-head"><div><small>COMPETITION OPERATIONS</small><h1>{currentEvent?.shortTitle || "竞赛执行工作区"}</h1><p>竞赛执行已经拆分为抽签与签表、赛程编排、比分录入、晋级确认四个独立工作区。这里负责阶段控制与抽签入口。</p></div><b>竞赛引擎</b></header>

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
          <header><div><small>EVENT STAGES</small><h2>竞赛阶段</h2><p>资格赛第一场 / 第二场各自只抽签一次。第一场晋级确认后，系统自动把未晋级球员生成第二场参赛名单，再进行第二次独立抽签。</p></div></header>
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
          <article className="available"><span>01</span><h2>抽签与签表</h2><p>实际人数、附加赛、轮空、分区、抽签版本、现场大屏与完整比赛树。</p><b>已开放</b></article>
          <i>→</i>
          <article className="available"><span>02</span><h2>赛程编排</h2><p>可配置时间段、球台与TV台，自动编排并支持人工调整和裁判分配。</p><b><Link href={`/admin/competition/schedules?event=${encodeURIComponent(data.selectedEventId)}`}>进入赛程编排</Link></b></article>
          <i>→</i>
          <article className="available"><span>03</span><h2>比分录入</h2><p>裁判独立入口现场录分；组委会确认后，胜者自动写入下一场。</p><b><Link href={`/admin/competition/scoring?event=${encodeURIComponent(data.selectedEventId)}`}>进入比分录入</Link></b></article>
          <i>→</i>
          <article className="available"><span>04</span><h2>晋级确认</h2><p>自动识别分区冠军，计算分区决胜负者局胜率，默认前8增补并允许组委会确认调整。</p><b><Link href={`/admin/competition/qualification?event=${encodeURIComponent(data.selectedEventId)}`}>进入晋级确认</Link></b></article>
        </section>

        <section className="competition-principles"><article><strong>资格赛规则已经固化到引擎设计</strong><p>512签表默认划分16个32人分区，每区产生1名直接晋级球员；16名分区决胜轮负者进入候补池，按局胜率取前8名，因此单场资格赛共24人晋级。</p></article><article><strong>第一场确认后自动产生第二场名单</strong><p>系统从第一场抽签名单中自动扣除24名已晋级球员，其余球员成为资格赛第二场参赛名单，并开放第二场独立抽签。</p></article><article><strong>结果可审计</strong><p>裁判提交比分、组委会确认赛果、人工调整赛程、晋级确认以及抽签重抽都会写入操作日志。</p></article></section>
      </section>
    </main>
  </AdminWorkspaceShell>;
}
