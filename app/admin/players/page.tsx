import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminNavigationEvents } from "@/db/admin-ui";
import { getPlayerAdminDetail, getPlayerAdminPage } from "@/db/player-admin";
import AdminWorkspaceShell from "../admin-workspace-shell";
import { getAdminViewer } from "../admin-viewer";
import { createPlayerAction, updatePlayerAction } from "./actions";
import "./player-management.css";

export const dynamic = "force-dynamic";

type SearchParams = {
  event?: string;
  scope?: string;
  group?: string;
  q?: string;
  page?: string;
  player?: string;
  success?: string;
  error?: string;
};

type QueryState = {
  event: string;
  scope: "event" | "all";
  group: "all" | "少年组" | "青年组";
  q: string;
  page: number;
};

function asGroup(value?: string): QueryState["group"] {
  return value === "少年组" || value === "青年组" ? value : "all";
}

function pageNumber(value?: string) {
  const parsed = Number.parseInt(value || "1", 10);
  return Number.isFinite(parsed) ? Math.max(1, parsed) : 1;
}

function hrefFor(state: QueryState, patch: Partial<QueryState> & { player?: string | null }) {
  const next = { ...state, ...patch };
  const params = new URLSearchParams();
  if (next.event) params.set("event", next.event);
  if (next.scope === "all") params.set("scope", "all");
  if (next.group !== "all") params.set("group", next.group);
  if (next.q) params.set("q", next.q);
  if (next.page > 1) params.set("page", String(next.page));
  if (patch.player) params.set("player", patch.player);
  return `/admin/players${params.size ? `?${params.toString()}` : ""}`;
}

function phoneMask(value: string | null) {
  if (!value) return "—";
  if (value.length < 7) return value;
  return `${value.slice(0, 3)}****${value.slice(-4)}`;
}

function identityLabel(type: string | null, last4: string | null) {
  if (!last4) return "证件待补";
  return `${type === "passport" ? "护照" : "身份证"} · ****${last4}`;
}

function identityStatusLabel(status: string) {
  if (status === "conflict") return "证件冲突";
  if (status === "missing") return "证件待补";
  if (status === "verified") return "已核验";
  return "已导入";
}

function profileStatusLabel(status: string) {
  if (status === "approved") return "正常";
  if (status === "disabled") return "停用";
  return "待审核";
}

function HiddenReturnFields({ state }: { state: QueryState }) {
  return <>
    <input type="hidden" name="returnEvent" value={state.event} />
    <input type="hidden" name="returnScope" value={state.scope} />
    <input type="hidden" name="returnGroup" value={state.group} />
    <input type="hidden" name="returnQuery" value={state.q} />
    <input type="hidden" name="returnPage" value={state.page} />
  </>;
}

export default async function PlayersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  if (viewer.role === "referee") redirect("/admin");

  const query = await searchParams;
  const events = await getAdminNavigationEvents(viewer.username);
  const currentEventId = events.some((event) => event.id === query.event) ? query.event! : events[0]?.id || "";
  const scope: QueryState["scope"] = viewer.role === "system_admin" && query.scope === "all" ? "all" : "event";
  const state: QueryState = {
    event: currentEventId,
    scope,
    group: asGroup(query.group),
    q: (query.q || "").trim(),
    page: pageNumber(query.page),
  };

  const pageData = await getPlayerAdminPage(viewer.username, {
    eventId: state.event,
    scope: state.scope,
    group: state.group,
    query: state.q,
    page: state.page,
    pageSize: 40,
  });
  const selected = query.player
    ? await getPlayerAdminDetail(viewer.username, query.player, state.event)
    : null;
  const currentEvent = events.find((event) => event.id === state.event);
  const totalPages = Math.max(1, Math.ceil(pageData.filteredTotal / pageData.pageSize));
  const eventOptions = events.map((event) => ({
    id: event.id,
    shortTitle: event.shortTitle,
    stationNo: event.stationNo,
    status: event.status,
    startDate: event.startDate,
    endDate: event.endDate,
  }));

  return <AdminWorkspaceShell
    viewer={{ displayName: viewer.displayName, role: viewer.role }}
    events={eventOptions}
    active="players"
    pageTitle="球员管理"
    pageHint="赛事运营 · 本站球员与球员总库"
    currentEventId={state.event || undefined}
    eventScoped
  >
    <main className="player-admin">
      <section className="player-admin-head">
        <div>
          <small>PLAYER MANAGEMENT</small>
          <h2>球员管理</h2>
          <p>{state.scope === "all"
            ? "系统球员总库。证件作为唯一身份依据，重名球员自动显示证件后四位。"
            : `当前查看：${currentEvent?.shortTitle || "尚未选择赛事"}。这里只显示本站报名球员。`}</p>
        </div>
        {viewer.role === "system_admin" && <details className="player-create-panel">
          <summary>＋ 新增球员</summary>
          <form action={createPlayerAction} className="player-form">
            <HiddenReturnFields state={state} />
            <h3>新增球员档案</h3>
            <p>身份证/护照为唯一身份依据。系统会自动检查重复证件。</p>
            <div className="player-form-grid">
              <label><span>姓名 *</span><input name="fullName" required /></label>
              <label><span>性别</span><select name="gender" defaultValue=""><option value="">未录入</option><option value="男">男</option><option value="女">女</option></select></label>
              <label><span>出生日期</span><input name="birthDate" type="date" /></label>
              <label><span>国籍代码</span><input name="nationalityCode" defaultValue="CN" maxLength={8} /></label>
              <label><span>证件类型 *</span><select name="identityType" defaultValue="id_card"><option value="id_card">身份证</option><option value="passport">护照</option></select></label>
              <label><span>证件号码 *</span><input name="identityNo" required autoComplete="off" /></label>
              <label><span>省份</span><input name="province" /></label>
              <label><span>城市</span><input name="city" /></label>
              <label><span>俱乐部</span><input name="clubName" /></label>
              <label><span>学校</span><input name="schoolName" /></label>
              <label><span>手机号</span><input name="phone" inputMode="tel" /></label>
              <label><span>邮箱</span><input name="email" type="email" /></label>
            </div>
            <button type="submit">保存球员档案</button>
          </form>
        </details>}
      </section>

      {query.success && <div className="player-notice success">{query.success}</div>}
      {query.error && <div className="player-notice error">{query.error}</div>}

      <section className="player-scope-row">
        <nav className="player-scope-tabs" aria-label="球员范围">
          <Link prefetch={false} className={state.scope === "event" ? "active" : ""} href={hrefFor(state, { scope: "event", page: 1, player: null })}>本站球员</Link>
          {viewer.role === "system_admin" && <Link prefetch={false} className={state.scope === "all" ? "active" : ""} href={hrefFor(state, { scope: "all", page: 1, player: null })}>球员总库</Link>}
        </nav>
        <span>{state.scope === "event" ? "权限按当前赛事范围生效" : "仅系统管理员可查看全库"}</span>
      </section>

      <section className="player-stats">
        <article><span>{state.scope === "event" ? "本站球员" : "球员总数"}</span><strong>{pageData.stats.total}</strong><small>不含已合并档案</small></article>
        <article><span>少年组</span><strong>{pageData.stats.youth}</strong><small>按当前/最近参赛组别</small></article>
        <article><span>青年组</span><strong>{pageData.stats.young}</strong><small>按当前/最近参赛组别</small></article>
        <article className={pageData.stats.identityConflict ? "warning" : ""}><span>证件待处理</span><strong>{pageData.stats.identityConflict + pageData.stats.identityMissing}</strong><small>{pageData.stats.identityConflict} 冲突 · {pageData.stats.identityMissing} 待补</small></article>
      </section>

      <section className="player-list-card">
        <form className="player-filter" method="get" action="/admin/players">
          <input type="hidden" name="event" value={state.event} />
          {state.scope === "all" && <input type="hidden" name="scope" value="all" />}
          <input name="q" defaultValue={state.q} placeholder="搜索姓名 / 手机 / 监护人 / 证件号或后四位" />
          <select name="group" defaultValue={state.group}>
            <option value="all">全部组别</option>
            <option value="少年组">少年组</option>
            <option value="青年组">青年组</option>
          </select>
          <button type="submit">搜索</button>
          {(state.q || state.group !== "all") && <Link prefetch={false} href={hrefFor(state, { q: "", group: "all", page: 1, player: null })}>清除</Link>}
        </form>

        <div className="player-list-meta">
          <span>共找到 <b>{pageData.filteredTotal}</b> 名球员</span>
          <small>每页 {pageData.pageSize} 人 · 服务端分页</small>
        </div>

        <div className="player-table-wrap">
          <table className="player-table">
            <thead><tr><th>球员</th><th>组别</th><th>地区</th><th>联系电话</th><th>证件</th><th>参赛</th><th>状态</th><th /></tr></thead>
            <tbody>
              {pageData.items.map((player) => <tr key={player.id}>
                <td><strong>{player.displayName}</strong><small>{player.clubName || player.schoolName || player.id}</small></td>
                <td>{player.groupName || "—"}</td>
                <td>{[player.province, player.city].filter(Boolean).join(" ") || "—"}</td>
                <td>{phoneMask(player.phone)}</td>
                <td><span className={`player-badge identity-${player.identityReviewStatus}`}>{identityLabel(player.identityType, player.identityLast4)}</span><small>{identityStatusLabel(player.identityReviewStatus)}</small></td>
                <td>{state.scope === "event" ? "本站" : `${player.eventCount} 站`}</td>
                <td><span className={`player-badge profile-${player.profileStatus}`}>{profileStatusLabel(player.profileStatus)}</span></td>
                <td><Link prefetch={false} className="player-open" href={hrefFor(state, { player: player.id })}>查看</Link></td>
              </tr>)}
              {!pageData.items.length && <tr><td colSpan={8}><div className="player-empty">没有找到符合当前条件的球员。</div></td></tr>}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && <nav className="player-pagination" aria-label="球员分页">
          <Link prefetch={false} aria-disabled={state.page <= 1} className={state.page <= 1 ? "disabled" : ""} href={hrefFor(state, { page: Math.max(1, state.page - 1), player: null })}>上一页</Link>
          <span>第 {Math.min(state.page, totalPages)} / {totalPages} 页</span>
          <Link prefetch={false} aria-disabled={state.page >= totalPages} className={state.page >= totalPages ? "disabled" : ""} href={hrefFor(state, { page: Math.min(totalPages, state.page + 1), player: null })}>下一页</Link>
        </nav>}
      </section>

      {selected && <section className="player-detail-card" id="player-detail">
        <header>
          <div><small>PLAYER PROFILE</small><h3>{selected.fullName}{selected.identityLast4 ? ` · ${selected.identityLast4}` : ""}</h3><p>{selected.id}</p></div>
          <Link prefetch={false} href={hrefFor(state, { player: null })}>关闭</Link>
        </header>
        <div className="player-detail-grid">
          <article><span>基本资料</span><b>{selected.gender || "性别待补"} · {selected.birthDate || "出生日期待补"}</b><small>{[selected.province, selected.city].filter(Boolean).join(" ") || "地区待补"}</small></article>
          <article><span>证件信息</span><b>{identityLabel(selected.identityType, selected.identityLast4)}</b><small>{identityStatusLabel(selected.identityReviewStatus)} · 默认不展示完整证件号</small></article>
          <article><span>联系信息</span><b>{phoneMask(selected.phone)}</b><small>{selected.email || "邮箱待补"}</small></article>
          <article><span>监护人</span><b>{selected.guardianName || "监护人待补"}</b><small>{selected.guardianRelationship || "关系待补"} · {phoneMask(selected.guardianPhone)}</small></article>
        </div>

        <div className="player-history">
          <h4>{viewer.role === "system_admin" ? "参赛记录" : "本站参赛记录"}</h4>
          {selected.events.length ? selected.events.map((event) => <div key={`${event.eventId}-${event.groupName}`}>
            <span><b>{event.eventTitle}</b><small>{event.startDate}</small></span>
            <span>{event.groupName}</span>
            <span>{event.placementLabel || "暂无排名"}</span>
          </div>) : <p>暂无可查看的参赛记录。</p>}
        </div>

        <details className="player-edit-panel">
          <summary>编辑球员资料</summary>
          <form action={updatePlayerAction} className="player-form">
            <HiddenReturnFields state={state} />
            <input type="hidden" name="playerId" value={selected.id} />
            <div className="player-form-grid">
              <label><span>姓名 *</span><input name="fullName" required defaultValue={selected.fullName} /></label>
              <label><span>性别</span><select name="gender" defaultValue={selected.gender || ""}><option value="">未录入</option><option value="男">男</option><option value="女">女</option></select></label>
              <label><span>出生日期</span><input name="birthDate" type="date" defaultValue={selected.birthDate || ""} /></label>
              <label><span>国籍代码</span><input name="nationalityCode" defaultValue={selected.nationalityCode} maxLength={8} /></label>
              <label><span>省份</span><input name="province" defaultValue={selected.province || ""} /></label>
              <label><span>城市</span><input name="city" defaultValue={selected.city || ""} /></label>
              <label><span>俱乐部</span><input name="clubName" defaultValue={selected.clubName || ""} /></label>
              <label><span>学校</span><input name="schoolName" defaultValue={selected.schoolName || ""} /></label>
              <label><span>手机号</span><input name="phone" inputMode="tel" defaultValue={selected.phone || ""} /></label>
              <label><span>邮箱</span><input name="email" type="email" defaultValue={selected.email || ""} /></label>
              <label><span>档案状态</span><select name="profileStatus" defaultValue={selected.profileStatus}><option value="approved">正常</option><option value="pending">待审核</option><option value="disabled">停用</option></select></label>
              <label><span>证件类型</span><select name="identityType" defaultValue={selected.identityType || "id_card"}><option value="id_card">身份证</option><option value="passport">护照</option></select></label>
              <label className="wide"><span>替换证件号码</span><input name="identityNo" autoComplete="off" placeholder="留空保持原证件；填写后重新校验唯一性" /></label>
            </div>
            <button type="submit">保存修改</button>
          </form>
        </details>
      </section>}
    </main>
  </AdminWorkspaceShell>;
}
