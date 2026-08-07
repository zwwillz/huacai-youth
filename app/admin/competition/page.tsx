import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminViewer } from "../admin-viewer";
import { getCompetitionDashboardData } from "@/db/competition-dashboard";
import AdminWorkspaceShell from "../admin-workspace-shell";
import "./competition.css";

export const dynamic = "force-dynamic";

const phases = [
  { code: "qualifier-one", no: "01", title: "资格赛第一场", note: "一次抽签 · 完整分区签表", source: "已审核参赛名单" },
  { code: "qualifier-two", no: "02", title: "资格赛第二场", note: "独立抽签 · 第一场未晋级球员", source: "第一场晋级确认后自动生成" },
  { code: "main-one", no: "03", title: "正赛第一阶段", note: "64人 · 8组双败", source: "锁定的64人正赛名单" },
  { code: "main-two", no: "04", title: "正赛第二阶段", note: "32强 · 重新抽签 · 单败", source: "组委会确认的32强名单" },
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
        <header className="competition-workspace-head"><div><small>竞赛执行工作区</small><h1>{currentEvent?.shortTitle || "竞赛执行"}</h1><p>从资格赛抽签、晋级与种子确认，到正赛64人锁定、双败、32强重新抽签和最终排名发布，全部使用同一套竞赛数据。</p></div><b>竞赛引擎</b></header>

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
          <header><div><small>四个比赛阶段</small><h2>竞赛阶段</h2><p>资格赛两场各自独立抽签；正赛第一阶段必须先锁定64人名单，再以8组双败产生32强；32强由组委会确认后进入正赛第二阶段重新抽签。</p></div></header>
          <div className="competition-stage-grid">{phases.map((phase) => {
            const draw = selectedGroup?.draws[phase.code];
            return <article key={phase.code} className="ready">
              <div className="competition-stage-no">{phase.no}</div>
              <div className="competition-stage-copy"><span>{phase.note}</span><h3>{phase.title}</h3><p>名单来源：{phase.source}</p></div>
              <dl><div><dt>抽签状态</dt><dd>{drawStatusLabel(draw?.status)}</dd></div>{draw && <><div><dt>版本</dt><dd>V{draw.versionNo}</dd></div><div><dt>抽签人数</dt><dd>{draw.entrantCount}</dd></div></>}</dl>
              <Link href={selectedGroup ? `/admin/competition/draw?event=${encodeURIComponent(data.selectedEventId)}&group=${encodeURIComponent(selectedGroup.id)}&phase=${phase.code}` : "/admin/competition"}>{draw ? "查看抽签 →" : "进入阶段 →"}</Link>
            </article>;
          })}</div>
        </section>

        <section className="competition-flow">
          <article className="available"><span>01</span><h2>抽签与签表</h2><p>资格赛支持附加赛、轮空与分区；正赛只读取已经锁定或确认的正式名单。</p><b>已开放</b></article>
          <i>→</i>
          <article className="available"><span>02</span><h2>赛程编排</h2><p>配置时间、球台、TV台和裁判，自动编排后允许人工调整并检查冲突。</p><b><Link href={`/admin/competition/schedules?event=${encodeURIComponent(data.selectedEventId)}`}>进入赛程编排</Link></b></article>
          <i>→</i>
          <article className="available"><span>03</span><h2>比分录入</h2><p>裁判提交、组委会确认；只有确认后的赛果才推动签表并对公众端生效。</p><b><Link href={`/admin/competition/scoring?event=${encodeURIComponent(data.selectedEventId)}`}>进入比分录入</Link></b></article>
          <i>→</i>
          <article className="available"><span>04</span><h2>晋级与正赛名单</h2><p>确认资格赛晋级、上一站16强种子、缺席递补，锁定64人；正赛第一阶段结束后再确认32强。</p><b><Link href={`/admin/competition/qualification?event=${encodeURIComponent(data.selectedEventId)}`}>进入名单控制</Link></b></article>
          <i>→</i>
          <article className="available"><span>05</span><h2>最终排名</h2><p>正赛第二阶段全部赛果确认后自动生成32强排名草稿，由组委会确认并单独发布。</p><b><Link href={`/admin/competition/final-ranking?event=${encodeURIComponent(data.selectedEventId)}`}>进入最终排名</Link></b></article>
        </section>

        <section className="competition-principles">
          <article><strong>资格赛：每场只抽签一次</strong><p>512标准签表默认16个32人分区，每区1名冠军直接晋级；决胜负者按局胜率取前8，每场资格赛共24人晋级。</p></article>
          <article><strong>正赛名单：先确认再锁定</strong><p>默认读取上一站16强作为种子候选；年龄不符或不参赛的空缺从资格赛局胜率候补池递补。48名资格赛晋级 + 16个已解决种子席位组成64人。</p></article>
          <article><strong>正赛第一阶段：64人8组双败</strong><p>锁定名单后才允许抽签。每组胜部2人、败部2人，共32人；32强由组委会确认后才成为第二阶段正式名单。</p></article>
          <article><strong>正赛第二阶段与排名</strong><p>32强重新抽签，16名胜部晋级进入种子位、16名败部晋级混抽；单败至冠军并进行三、四名决赛，最后确认并发布排名。</p></article>
        </section>
      </section>
    </main>
  </AdminWorkspaceShell>;
}
