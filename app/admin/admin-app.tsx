"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type Viewer = { username: string; displayName: string };
type Account = { id: string; username: string; displayName: string; role: string; roleLabel: string };
type ManagedAccount = { id: string; username: string; displayName: string; role: string; status: string; lastLoginAt: string | null; createdAt: string };
type EventRow = {
  id: string;
  year: number;
  stationNo: number;
  fullTitle: string;
  shortTitle: string;
  slug: string;
  city: string;
  venueId: string | null;
  venueName: string;
  startDate: string;
  endDate: string;
  registrationStartAt: string | null;
  registrationEndAt: string | null;
  summary: string | null;
  status: string;
  publishStatus: string;
  publishedAt: string | null;
  updatedAt: string;
  groupCount: number;
  publicationCount: number;
};
type Publication = { id: string; eventId: string; moduleType: string; moduleTitle: string; versionNo: number; status: string; publishedAt: string | null; updatedAt: string };
type DocumentRow = { id: string; eventId: string; documentType: string; title: string; externalUrl: string | null; isPublished: boolean };
type GuideRow = { id: string; eventId: string; guideType: string; title: string; contentType: string; publishStatus: string; body: string | null };
type SponsorRow = { id: string; eventId: string; name: string; sponsorType: string; logoKey: string | null; isPublished: boolean };
type AuditRow = { id: string; eventId: string | null; moduleType: string; targetType: string; targetId: string | null; action: string; createdAt: string };
type Snapshot = {
  account: Account;
  metrics: { eventCount: number; activeEventCount: number; playerCount: number; registrationCount: number; pendingRegistrationCount: number; draftPublicationCount: number };
  events: EventRow[];
  publications: Publication[];
  documents: DocumentRow[];
  guides: GuideRow[];
  sponsors: SponsorRow[];
  accounts: ManagedAccount[];
  auditLogs: AuditRow[];
};
type SectionId = "dashboard" | "events" | "content" | "registrations" | "players" | "competition" | "rankings" | "accounts";
type EventDraft = {
  id?: string;
  fullTitle: string;
  shortTitle: string;
  year: number;
  stationNo: number;
  city: string;
  venueName: string;
  startDate: string;
  endDate: string;
  registrationStartAt: string;
  registrationEndAt: string;
  summary: string;
  status: string;
  publishStatus: string;
};
type AccountDraft = { username: string; displayName: string; password: string; role: "committee" | "referee" };

const navItems: { id: SectionId; icon: string; title: string; hint: string }[] = [
  { id: "dashboard", icon: "首", title: "工作台", hint: "赛事总览与待办" },
  { id: "events", icon: "赛", title: "赛事管理", hint: "创建、设置与状态" },
  { id: "content", icon: "发", title: "内容发布", hint: "概览、规程和文件" },
  { id: "registrations", icon: "审", title: "报名审核", hint: "注册与报名确认" },
  { id: "players", icon: "员", title: "球员管理", hint: "档案、监护人与合并" },
  { id: "competition", icon: "执", title: "竞赛执行", hint: "抽签、赛程与比分" },
  { id: "rankings", icon: "榜", title: "排名积分", hint: "名次确认与积分流水" },
  { id: "accounts", icon: "权", title: "账号与日志", hint: "简化角色和操作记录" },
];

const eventStatusLabels: Record<string, string> = {
  draft: "草稿",
  registration_open: "报名中",
  registration_closed: "报名截止",
  in_progress: "比赛中",
  finished: "已结束",
  archived: "已归档",
};

const actionLabels: Record<string, string> = {
  bootstrap_admin: "初始化后台管理员",
  resume_bootstrap: "完成后台初始化数据",
  create: "创建赛事",
  update: "修改赛事资料",
  publish: "发布内容",
  unpublish: "撤回内容",
  create_account: "创建后台账号",
  enable_account: "启用后台账号",
  disable_account: "停用后台账号",
  reset_password: "重设账号密码",
};

function emptyDraft(events: EventRow[]): EventDraft {
  const latest = events[0];
  return {
    fullTitle: "2027中国华彩十六球青少年系列赛",
    shortTitle: "2027华彩青少年系列赛新分站",
    year: 2027,
    stationNo: latest ? latest.stationNo + 1 : 1,
    city: "",
    venueName: "",
    startDate: "2027-01-01",
    endDate: "2027-01-07",
    registrationStartAt: "",
    registrationEndAt: "",
    summary: "",
    status: "draft",
    publishStatus: "draft",
  };
}

function draftFromEvent(event: EventRow): EventDraft {
  return {
    id: event.id,
    fullTitle: event.fullTitle,
    shortTitle: event.shortTitle,
    year: event.year,
    stationNo: event.stationNo,
    city: event.city,
    venueName: event.venueName,
    startDate: event.startDate,
    endDate: event.endDate,
    registrationStartAt: event.registrationStartAt ?? "",
    registrationEndAt: event.registrationEndAt ?? "",
    summary: event.summary ?? "",
    status: event.status,
    publishStatus: event.publishStatus,
  };
}

async function readResponse(response: Response) {
  const payload = await response.json() as { data?: Snapshot; error?: string };
  if (!response.ok) throw new Error(payload.error ?? "操作失败，请稍后重试。");
  if (!payload.data) throw new Error("后台没有返回数据。");
  return payload.data;
}

export default function AdminApp({ viewer }: { viewer: Viewer }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [section, setSection] = useState<SectionId>("dashboard");
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");
  const [selectedEventId, setSelectedEventId] = useState("");
  const [editor, setEditor] = useState<EventDraft | null>(null);
  const [accountEditor, setAccountEditor] = useState<AccountDraft | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await readResponse(await fetch("/api/admin/overview", { cache: "no-store" }));
      setSnapshot(data);
      setSelectedEventId((current) => current || data.events[0]?.id || "");
      setDenied(false);
    } catch (error) {
      const failure = error as Error;
      setDenied(true);
      setNotice(failure.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    fetch("/api/admin/overview", { cache: "no-store" })
      .then(readResponse)
      .then((data) => {
        if (!active) return;
        setSnapshot(data);
        setSelectedEventId(data.events[0]?.id ?? "");
        setDenied(false);
      })
      .catch((error: Error) => {
        if (!active) return;
        setDenied(true);
        setNotice(error.message);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const saveEvent = async (event: FormEvent) => {
    event.preventDefault();
    if (!editor) return;
    setWorking(true);
    setNotice("");
    try {
      const data = await readResponse(await fetch("/api/admin/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(editor) }));
      setSnapshot(data);
      setSelectedEventId(editor.id ?? data.events[0]?.id ?? "");
      setEditor(null);
      setNotice(editor.id ? "赛事资料已保存。" : "新赛事已创建并建立少年组、青年组及发布模块。");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "赛事保存失败。");
    } finally {
      setWorking(false);
    }
  };

  const togglePublication = async (item: Publication) => {
    setWorking(true);
    setNotice("");
    try {
      const status = item.status === "published" ? "draft" : "published";
      const data = await readResponse(await fetch("/api/admin/publications", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: item.id, status }) }));
      setSnapshot(data);
      setNotice(status === "published" ? item.moduleTitle + "已发布。" : item.moduleTitle + "已撤回为草稿。" );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "发布操作失败。");
    } finally {
      setWorking(false);
    }
  };

  const manageAccount = async (body: Record<string, unknown>, success: string) => {
    setWorking(true);
    setNotice("");
    try {
      const data = await readResponse(await fetch("/api/admin/accounts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
      setSnapshot(data);
      setAccountEditor(null);
      setNotice(success);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "账号操作失败。");
    } finally {
      setWorking(false);
    }
  };

  if (loading) return <main className="backend-state"><span className="backend-spinner"/><h1>正在进入赛事后台</h1><p>正在读取账号权限和赛事数据。</p></main>;

  if (!snapshot && denied) return <main className="backend-state backend-denied">
    <div className="backend-state-logo">锁</div>
    <small>无后台权限</small>
    <h1>这个账号还不能进入后台</h1>
    <p>{viewer.username}<br/>{notice || "请联系系统管理员检查该账号的后台权限。"}</p>
    <a href="/api/auth/logout">切换登录账号</a>
    <Link href="/">返回公众页面</Link>
  </main>;

  if (!snapshot) return <main className="backend-state"><h1>后台暂时无法打开</h1><p>{notice || "请稍后重试。"}</p><button onClick={load}>重新加载</button></main>;

  const currentEvent = snapshot.events.find((event) => event.id === selectedEventId) ?? snapshot.events[0];
  const visibleNavItems = snapshot.account.role === "system_admin" ? navItems : navItems.filter((item) => item.id !== "accounts");
  const effectiveSection = section === "accounts" && snapshot.account.role !== "system_admin" ? "dashboard" : section;
  const currentTitle = visibleNavItems.find((item) => item.id === effectiveSection)?.title ?? "工作台";
  const sectionContent = effectiveSection === "dashboard" ? <Dashboard snapshot={snapshot} currentEvent={currentEvent} go={setSection} />
    : effectiveSection === "events" ? <EventsPage snapshot={snapshot} edit={setEditor} create={() => setEditor(emptyDraft(snapshot.events))} />
    : effectiveSection === "content" ? <ContentPage snapshot={snapshot} event={currentEvent} toggle={togglePublication} working={working} />
    : effectiveSection === "registrations" ? <RegistrationPage snapshot={snapshot} />
    : effectiveSection === "players" ? <PlayersPage snapshot={snapshot} />
    : effectiveSection === "competition" ? <CompetitionPage event={currentEvent} />
    : effectiveSection === "rankings" ? <RankingsPage event={currentEvent} />
    : <AccountsPage snapshot={snapshot} create={() => setAccountEditor({ username: "", displayName: "", password: "", role: "committee" })} manage={manageAccount} working={working} />;

  return <main className="backend-shell">
    <aside className={menuOpen ? "backend-sidebar open" : "backend-sidebar"}>
      <div className="backend-brand"><span>华</span><div><strong>华彩赛事后台</strong><small>赛事运营与竞赛执行</small></div></div>
      <nav>{visibleNavItems.map((item) => <button key={item.id} className={effectiveSection === item.id ? "active" : ""} onClick={() => { setSection(item.id); setMenuOpen(false); }}><span>{item.icon}</span><div><strong>{item.title}</strong><small>{item.hint}</small></div>{item.id === "registrations" && snapshot.metrics.pendingRegistrationCount > 0 && <b>{snapshot.metrics.pendingRegistrationCount}</b>}</button>)}</nav>
      <div className="backend-sidebar-foot"><Link href="/">查看公众前端</Link><a href="/api/auth/logout">退出后台</a></div>
    </aside>
    <section className="backend-main">
      <header className="backend-topbar">
        <button className="backend-menu" onClick={() => setMenuOpen((value) => !value)}>☰</button>
        <div><small>后台管理</small><h1>{currentTitle}</h1></div>
        <label className="backend-event-select"><span>当前赛事</span><select value={currentEvent?.id ?? ""} onChange={(event) => setSelectedEventId(event.target.value)}>{snapshot.events.map((event) => <option value={event.id} key={event.id}>{event.shortTitle}</option>)}</select></label>
        <div className="backend-user"><span>{snapshot.account.displayName.slice(0, 1)}</span><div><strong>{snapshot.account.displayName}</strong><small>{snapshot.account.roleLabel}</small></div></div>
      </header>
      {notice && <div className="backend-notice"><span>✓</span>{notice}<button onClick={() => setNotice("")}>×</button></div>}
      <div className="backend-content">{sectionContent}</div>
    </section>
    {editor && <EventEditor draft={editor} setDraft={setEditor} close={() => setEditor(null)} save={saveEvent} working={working} />}
    {accountEditor && <AccountEditor draft={accountEditor} setDraft={setAccountEditor} close={() => setAccountEditor(null)} save={(event) => { event.preventDefault(); manageAccount({ action: "create", ...accountEditor }, "后台账号已创建，可以把用户名和初始密码交给使用人。"); }} working={working} />}
  </main>;
}

function Dashboard({ snapshot, currentEvent, go }: { snapshot: Snapshot; currentEvent?: EventRow; go: (section: SectionId) => void }) {
  const metrics = [
    ["赛事总数", snapshot.metrics.eventCount, "已建立的赛季分站", "赛"],
    ["进行中赛事", snapshot.metrics.activeEventCount, "报名中或比赛中", "进"],
    ["待审核报名", snapshot.metrics.pendingRegistrationCount, "需要组委会处理", "审"],
    ["待发布内容", snapshot.metrics.draftPublicationCount, "仍处于草稿状态", "发"],
  ];
  return <div className="backend-stack">
    <section className="backend-welcome"><div><small>{new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" })}</small><h2>赛事后台已经进入正式开发</h2><p>第一期先把赛事、内容发布、报名与球员数据放进同一个管理入口。</p></div><button onClick={() => go("events")}>管理赛事资料</button></section>
    <section className="backend-metrics">{metrics.map(([label, value, hint, icon]) => <article key={String(label)}><span>{icon}</span><div><small>{label}</small><strong>{value}</strong><p>{hint}</p></div></article>)}</section>
    <section className="backend-dashboard-grid">
      <article className="backend-panel backend-current-event"><header><div><small>当前赛事</small><h3>{currentEvent?.shortTitle}</h3></div><b className="status-live">{currentEvent ? eventStatusLabels[currentEvent.status] ?? currentEvent.status : "待创建"}</b></header><div className="backend-event-summary"><dl><div><dt>比赛时间</dt><dd>{formatRange(currentEvent?.startDate, currentEvent?.endDate)}</dd></div><div><dt>比赛地点</dt><dd>{currentEvent?.venueName || "待设置"}</dd></div><div><dt>组别</dt><dd>少年组 U16、青年组 U20</dd></div><div><dt>发布模块</dt><dd>{currentEvent?.publicationCount ?? 0} / 6</dd></div></dl><div className="backend-progress"><span style={{ width: String(((currentEvent?.publicationCount ?? 0) / 6) * 100) + "%" }}/></div></div><footer><button onClick={() => go("content")}>进入内容发布</button><button onClick={() => go("competition")}>进入竞赛执行</button></footer></article>
      <article className="backend-panel backend-tasks"><header><div><small>今日待办</small><h3>按赛事流程推进</h3></div><b>4项</b></header>{[
        ["完善交通住宿攻略", "内容发布", "普通"],
        ["确认服装要求页面", "内容发布", "普通"],
        ["导入球员正式档案", "球员管理", "重要"],
        ["配置资格赛阶段", "竞赛执行", "重要"],
      ].map(([title, module, level]) => <div className="backend-task" key={title}><span/><div><strong>{title}</strong><small>{module}</small></div><b className={level === "重要" ? "important" : ""}>{level}</b></div>)}</article>
    </section>
    <section className="backend-panel backend-flow"><header><div><small>发布流程</small><h3>后台数据如何到公众前端</h3></div></header><div><article><span>1</span><strong>后台编辑</strong><small>保存草稿，不影响线上</small></article><i>›</i><article><span>2</span><strong>检查预览</strong><small>确认文字、文件和赛程</small></article><i>›</i><article><span>3</span><strong>正式发布</strong><small>生成新的发布版本</small></article><i>›</i><article><span>4</span><strong>前端展示</strong><small>公众端读取已发布数据</small></article></div></section>
  </div>;
}

function EventsPage({ snapshot, edit, create }: { snapshot: Snapshot; edit: (draft: EventDraft) => void; create: () => void }) {
  return <div className="backend-stack"><section className="backend-page-head"><div><small>赛事与赛季</small><h2>赛事管理</h2><p>创建分站、设置日期地点，并控制赛事和前端发布状态。</p></div><button onClick={create}>＋ 新增赛事</button></section><section className="backend-panel backend-event-table"><header className="backend-table-tools"><div><strong>全部赛事</strong><span>共 {snapshot.events.length} 场</span></div><label><span>⌕</span><input placeholder="搜索赛事名称或城市" /></label></header><div className="backend-table-row backend-table-head"><span>赛事</span><span>比赛日期</span><span>比赛状态</span><span>前端发布</span><span>操作</span></div>{snapshot.events.map((event) => <div className="backend-table-row" key={event.id}><div className="backend-event-cell"><span>{event.stationNo}</span><div><strong>{event.shortTitle}</strong><small>{event.city} · {event.venueName}</small></div></div><span>{formatRange(event.startDate, event.endDate)}</span><span><b className={"backend-badge status-" + event.status}>{eventStatusLabels[event.status] ?? event.status}</b></span><span><b className={event.publishStatus === "published" ? "backend-badge published" : "backend-badge draft"}>{event.publishStatus === "published" ? "已发布" : "草稿"}</b></span><span><button className="backend-text-button" onClick={() => edit(draftFromEvent(event))}>编辑资料</button></span></div>)}</section></div>;
}

function ContentPage({ snapshot, event, toggle, working }: { snapshot: Snapshot; event?: EventRow; toggle: (item: Publication) => void; working: boolean }) {
  const rows = snapshot.publications.filter((item) => item.eventId === event?.id);
  const documents = snapshot.documents.filter((item) => item.eventId === event?.id);
  const guides = snapshot.guides.filter((item) => item.eventId === event?.id);
  const sponsors = snapshot.sponsors.filter((item) => item.eventId === event?.id);
  return <div className="backend-stack"><section className="backend-page-head"><div><small>草稿、预览与发布</small><h2>内容发布</h2><p>{event?.shortTitle}</p></div><Link className="backend-outline-button" href="/" target="_blank">查看公众页面 ↗</Link></section><section className="backend-content-grid">{rows.map((item) => <article className="backend-panel backend-module-card" key={item.id}><header><span>{moduleIcon(item.moduleType)}</span><b className={item.status === "published" ? "backend-badge published" : "backend-badge draft"}>{item.status === "published" ? "已发布" : "草稿"}</b></header><h3>{item.moduleTitle}</h3><p>{moduleDescription(item.moduleType)}</p><div><small>版本 {item.versionNo}</small><small>{item.publishedAt ? "发布于 " + formatDateTime(item.publishedAt) : "尚未发布"}</small></div><footer><button className="backend-text-button">编辑内容</button><button className={item.status === "published" ? "backend-soft-button" : "backend-primary-small"} onClick={() => toggle(item)} disabled={working}>{item.status === "published" ? "撤回" : "发布"}</button></footer></article>)}</section><section className="backend-dashboard-grid backend-assets-grid"><article className="backend-panel"><header><div><small>赛事文件</small><h3>规程与裁判名单</h3></div><b>{documents.length}份</b></header>{documents.map((document) => <div className="backend-asset" key={document.id}><span>PDF</span><div><strong>{document.title}</strong><small>{document.documentType === "regulation" ? "竞赛规程" : "裁判员名单"}</small></div><b className="backend-badge published">已发布</b></div>)}</article><article className="backend-panel"><header><div><small>参赛提示与赞助商</small><h3>概览页附加内容</h3></div><b>{guides.length + sponsors.length}项</b></header>{guides.map((guide) => <div className="backend-asset" key={guide.id}><span>文</span><div><strong>{guide.title}</strong><small>{guide.body || "待更新"}</small></div><b className={guide.publishStatus === "published" ? "backend-badge published" : "backend-badge draft"}>{guide.publishStatus === "published" ? "已发布" : "草稿"}</b></div>)}{sponsors.map((sponsor) => <div className="backend-asset" key={sponsor.id}><span>标</span><div><strong>{sponsor.name}</strong><small>赞助商标识</small></div><b className="backend-badge published">已发布</b></div>)}</article></section></div>;
}

function RegistrationPage({ snapshot }: { snapshot: Snapshot }) {
  return <div className="backend-stack"><section className="backend-page-head"><div><small>注册审核与单站报名</small><h2>报名审核</h2><p>先确认球员身份，再审核是否符合该站的年龄和组别要求。</p></div><button>导入报名表</button></section><section className="backend-metrics compact">{[["全部报名", snapshot.metrics.registrationCount], ["待审核", snapshot.metrics.pendingRegistrationCount], ["已通过", 0], ["候补与退赛", 0]].map(([label, value]) => <article key={String(label)}><div><small>{label}</small><strong>{value}</strong></div></article>)}</section><EmptyModule icon="审" title="还没有导入报名数据" text="下一步可从Excel导入报名名单，或接入球员自主报名。审核记录会保留操作人、时间和原因。" action="导入第一份报名表" /></div>;
}

function PlayersPage({ snapshot }: { snapshot: Snapshot }) {
  return <div className="backend-stack"><section className="backend-page-head"><div><small>唯一球员档案</small><h2>球员管理</h2><p>球员多次参赛只保留一个档案，并关联监护人、成绩与积分流水。</p></div><button>＋ 新建球员</button></section><section className="backend-panel backend-player-tools"><label><span>⌕</span><input placeholder="搜索姓名、地区、俱乐部或学校" /></label><div><button className="active">全部球员 <b>{snapshot.metrics.playerCount}</b></button><button>待审核 <b>0</b></button><button>疑似重复 <b>0</b></button></div></section><EmptyModule icon="员" title="球员正式档案尚未迁入" text="现有公众页中的对阵姓名不是完整球员档案。本模块只接收经过注册审核的正式资料，避免重复和数据混淆。" action="导入球员档案" /></div>;
}

function CompetitionPage({ event }: { event?: EventRow }) {
  const stages = [
    ["01", "资格赛第一场", "单败 · 晋级24人", "待配置"],
    ["02", "资格赛第二场", "单败 · 晋级24人", "待配置"],
    ["03", "正赛第一阶段", "64人分组双败", "待配置"],
    ["04", "正赛第二阶段", "32强单败至冠军", "待配置"],
  ];
  return <div className="backend-stack"><section className="backend-page-head"><div><small>裁判工作区</small><h2>竞赛执行</h2><p>{event?.shortTitle} · 抽签、赛程、比分和晋级将在这里形成闭环。</p></div><button>配置赛事阶段</button></section><section className="backend-role-note"><span>裁</span><div><strong>简化权限规则</strong><p>裁判负责抽签、赛程和比分录入；关键签表、晋级与排名由组委会确认后正式发布。</p></div></section><section className="backend-stage-grid">{stages.map(([number, title, description, status]) => <article className="backend-panel" key={number}><header><span>{number}</span><b className="backend-badge draft">{status}</b></header><h3>{title}</h3><p>{description}</p><dl><div><dt>抽签版本</dt><dd>未建立</dd></div><div><dt>比赛场次</dt><dd>0</dd></div><div><dt>已确认比分</dt><dd>0</dd></div></dl><button>进入阶段配置</button></article>)}</section><section className="backend-panel backend-next-build"><div><small>下一开发阶段</small><h3>签表和比赛执行引擎</h3><p>会在这套正式后台上继续加入：种子规则、单败和双败签表、球台编排、比分提交与更正、自动晋级和排名确认。</p></div><span>第二期</span></section></div>;
}

function RankingsPage({ event }: { event?: EventRow }) {
  return <div className="backend-stack"><section className="backend-page-head"><div><small>确认后才进入公众前端</small><h2>排名与积分</h2><p>{event?.shortTitle}</p></div><button>设置积分规则</button></section><section className="backend-dashboard-grid"><EmptyModule icon="榜" title="本站排名尚未确认" text="系统会根据最终签表自动生成名次，由组委会确认后发布。" action="查看排名规则" compact /><article className="backend-panel backend-points-rule"><header><div><small>积分原则</small><h3>采用积分流水，不直接改总分</h3></div></header><ol><li>每条积分都对应具体赛事和名次</li><li>调整必须填写增加、扣减原因</li><li>总积分由有效流水实时汇总</li><li>历史调整不可被直接覆盖</li></ol></article></section></div>;
}

function AccountsPage({ snapshot, create, manage, working }: { snapshot: Snapshot; create: () => void; manage: (body: Record<string, unknown>, success: string) => Promise<void>; working: boolean }) {
  const roles = [["系统管理员", "管理全部赛事、账号和系统设置"], ["组委会", "赛事、报名、球员和前端发布"], ["裁判", "抽签、赛程、比分、晋级与排名确认"]];
  const resetPassword = async (account: ManagedAccount) => {
    const password = window.prompt(`请为“${account.displayName}”设置新的临时密码（至少8个字符）：`);
    if (!password) return;
    await manage({ action: "password", id: account.id, password }, `${account.displayName}的密码已重设。`);
  };
  return <div className="backend-stack"><section className="backend-page-head"><div><small>三个角色覆盖第一版</small><h2>账号与日志</h2><p>系统管理员创建用户名和初始密码，再分发给组委会或裁判使用。</p></div><button onClick={create}>＋ 添加账号</button></section><section className="backend-role-grid">{roles.map(([title, text], index) => <article className="backend-panel" key={title}><span>{index + 1}</span><h3>{title}</h3><p>{text}</p>{index === 0 && <b>全局角色</b>}{index > 0 && <b>按赛事分配</b>}</article>)}</section><section className="backend-panel backend-account-list"><header><div><small>登录账号</small><h3>账号管理</h3></div><b>{snapshot.accounts.length}个</b></header><div className="backend-account-head"><span>账号</span><span>角色</span><span>状态</span><span>最近登录</span><span>操作</span></div>{snapshot.accounts.map((account) => <div className="backend-account-row" key={account.id}><div><strong>{account.displayName}</strong><small>{account.username}</small></div><span>{account.role === "system_admin" ? "系统管理员" : account.role === "committee" ? "组委会" : "裁判"}</span><span><b className={account.status === "active" ? "backend-badge published" : "backend-badge draft"}>{account.status === "active" ? "启用" : "停用"}</b></span><span>{account.lastLoginAt ? formatDateTime(account.lastLoginAt) : "尚未登录"}</span><div className="backend-account-actions"><button disabled={working} onClick={() => resetPassword(account)}>重设密码</button>{account.role !== "system_admin" && <button disabled={working} onClick={() => manage({ action: "status", id: account.id, status: account.status === "active" ? "disabled" : "active" }, account.status === "active" ? `${account.displayName}已停用。` : `${account.displayName}已启用。`)}>{account.status === "active" ? "停用" : "启用"}</button>}</div></div>)}</section><section className="backend-panel backend-log-list"><header><div><small>操作审计</small><h3>最近操作记录</h3></div><b>不可直接删除</b></header>{snapshot.auditLogs.length ? snapshot.auditLogs.map((log) => <div key={log.id}><span>{actionLabels[log.action] ?? log.action}</span><small>{log.moduleType} · {log.targetType}</small><time>{formatDateTime(log.createdAt)}</time></div>) : <p>暂无操作记录</p>}</section></div>;
}

function EmptyModule({ icon, title, text, action, compact = false }: { icon: string; title: string; text: string; action: string; compact?: boolean }) {
  return <section className={compact ? "backend-panel backend-empty compact-empty" : "backend-panel backend-empty"}><span>{icon}</span><h3>{title}</h3><p>{text}</p><button>{action}</button></section>;
}

function EventEditor({ draft, setDraft, close, save, working }: { draft: EventDraft; setDraft: (draft: EventDraft | null) => void; close: () => void; save: (event: FormEvent) => void; working: boolean }) {
  const update = (key: keyof EventDraft, value: string | number) => setDraft({ ...draft, [key]: value });
  return <div className="backend-modal"><form className="backend-editor" onSubmit={save}><header><div><small>{draft.id ? "修改已存在的赛事" : "建立新的赛事分站"}</small><h2>{draft.id ? "编辑赛事资料" : "新增赛事"}</h2></div><button type="button" onClick={close}>×</button></header><div className="backend-form"><label className="wide"><span>完整赛事名称</span><input value={draft.fullTitle} onChange={(event) => update("fullTitle", event.target.value)} required /></label><label className="wide"><span>前端显示简称</span><input value={draft.shortTitle} onChange={(event) => update("shortTitle", event.target.value)} required /></label><label><span>赛季年份</span><input type="number" value={draft.year} onChange={(event) => update("year", Number(event.target.value))} min="2025" /></label><label><span>第几站</span><input type="number" value={draft.stationNo} onChange={(event) => update("stationNo", Number(event.target.value))} min="1" /></label><label><span>城市</span><input value={draft.city} onChange={(event) => update("city", event.target.value)} placeholder="例如：河北廊坊" required /></label><label><span>比赛场馆</span><input value={draft.venueName} onChange={(event) => update("venueName", event.target.value)} placeholder="比赛场馆名称" /></label><label><span>比赛开始日期</span><input type="date" value={draft.startDate} onChange={(event) => update("startDate", event.target.value)} required /></label><label><span>比赛结束日期</span><input type="date" value={draft.endDate} onChange={(event) => update("endDate", event.target.value)} required /></label><label><span>报名开始时间</span><input type="datetime-local" value={draft.registrationStartAt} onChange={(event) => update("registrationStartAt", event.target.value)} /></label><label><span>报名截止时间</span><input type="datetime-local" value={draft.registrationEndAt} onChange={(event) => update("registrationEndAt", event.target.value)} /></label><label><span>赛事状态</span><select value={draft.status} onChange={(event) => update("status", event.target.value)}>{Object.entries(eventStatusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label><span>前端发布状态</span><select value={draft.publishStatus} onChange={(event) => update("publishStatus", event.target.value)}><option value="draft">草稿</option><option value="published">已发布</option></select></label><label className="wide"><span>赛事简介</span><textarea value={draft.summary} onChange={(event) => update("summary", event.target.value)} rows={4} placeholder="写入概览页的赛事简介" /></label></div><footer><button type="button" onClick={close}>取消</button><button type="submit" disabled={working}>{working ? "正在保存…" : "保存赛事资料"}</button></footer></form></div>;
}

function AccountEditor({ draft, setDraft, close, save, working }: { draft: AccountDraft; setDraft: (draft: AccountDraft | null) => void; close: () => void; save: (event: FormEvent) => void; working: boolean }) {
  const update = (key: keyof AccountDraft, value: string) => setDraft({ ...draft, [key]: value } as AccountDraft);
  return <div className="backend-modal"><form className="backend-editor backend-account-editor" onSubmit={save}><header><div><small>由系统管理员创建并分发</small><h2>新增后台账号</h2></div><button type="button" onClick={close}>×</button></header><div className="backend-form"><label><span>用户名</span><input value={draft.username} onChange={(event) => update("username", event.target.value.toLowerCase())} placeholder="例如：langfang01" minLength={3} maxLength={32} required /></label><label><span>显示名称</span><input value={draft.displayName} onChange={(event) => update("displayName", event.target.value)} placeholder="例如：廊坊站组委会" required /></label><label><span>账号角色</span><select value={draft.role} onChange={(event) => update("role", event.target.value)}><option value="committee">组委会</option><option value="referee">裁判</option></select></label><label><span>初始密码</span><input type="password" value={draft.password} onChange={(event) => update("password", event.target.value)} minLength={8} maxLength={72} placeholder="至少8个字符" autoComplete="new-password" required /></label></div><p className="backend-editor-tip">保存后，请通过安全方式把用户名和初始密码交给使用人。系统不会在页面中再次显示原密码。</p><footer><button type="button" onClick={close}>取消</button><button type="submit" disabled={working}>{working ? "正在创建…" : "创建账号"}</button></footer></form></div>;
}

function formatRange(start?: string | null, end?: string | null) {
  if (!start || !end) return "待设置";
  return start.replaceAll("-", ".") + " — " + end.replaceAll("-", ".");
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function moduleIcon(type: string) {
  return ({ overview: "概", regulation: "规", documents: "件", schedule: "程", matches: "阵", rankings: "榜" } as Record<string, string>)[type] ?? "文";
}

function moduleDescription(type: string) {
  return ({ overview: "赛事介绍、时间地点、组织机构和参赛提示", regulation: "规程摘要、完整PDF和裁判员名单", documents: "管理赛事相关PDF、名单及附件", schedule: "赛事阶段、日期、状态和赛程表入口", matches: "按日期发布对阵名单、球台和比赛状态", rankings: "发布已经确认的名次与积分" } as Record<string, string>)[type] ?? "赛事内容模块";
}
