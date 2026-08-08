import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminNavigationEvents } from "@/db/admin-ui";
import { getPlayerAdminDetail, getPlayerAdminPage } from "@/db/player-admin-v2";
import AdminWorkspaceShell from "../admin-workspace-shell";
import { getAdminViewer } from "../admin-viewer";
import { PlayerCreateDialog, PlayerEditPanel } from "./player-management-client";
import "./player-management.css";

export const dynamic = "force-dynamic";

type SearchParams = { event?: string; scope?: string; group?: string; q?: string; page?: string; player?: string; success?: string; error?: string };
type QueryState = { event: string; scope: "event" | "all"; group: "all" | "少年组" | "青年组"; q: string; page: number };

function asGroup(value?: string): QueryState["group"] { return value === "少年组" || value === "青年组" ? value : "all"; }
function pageNumber(value?: string) { const parsed = Number.parseInt(value || "1", 10); return Number.isFinite(parsed) ? Math.max(1, parsed) : 1; }

function hrefFor(state: QueryState, patch: Partial<QueryState> & { player?: string | null }) {
  const next = { ...state, ...patch };
  const params = new URLSearchParams();
  if (next.scope === "event" && next.event) params.set("event", next.event);
  if (next.scope === "all") params.set("scope", "all");
  if (next.group !== "all") params.set("group", next.group);
  if (next.q) params.set("q", next.q);
  if (next.page > 1) params.set("page", String(next.page));
  if (patch.player) params.set("player", patch.player);
  return `/admin/players${params.size ? `?${params.toString()}` : ""}`;
}

function profileStatusLabel(status: string) {
  if (status === "approved") return "正常";
  if (status === "disabled") return "停用";
  return "待审核";
}

function identityTypeLabel(type: string | null) { return type === "passport" ? "护照" : "身份证"; }
function identityStatusLabel(status: string) {
  if (status === "conflict") return "证件冲突";
  if (status === "missing") return "证件待补";
  if (status === "verified") return "已核验";
  return "已导入";
}
function value(value: string | null | undefined) { return value || "—"; }

export default async function PlayersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  if (viewer.role === "referee") redirect("/admin");

  const query = await searchParams;
  const events = await getAdminNavigationEvents(viewer.username);
  const requestedEvent = events.find((event) => event.id === query.event);
  const overview = viewer.role === "system_admin" && !requestedEvent && (query.scope === "all" || !query.event);
  const state: QueryState = {
    event: overview ? "" : (requestedEvent?.id || events[0]?.id || ""),
    scope: overview ? "all" : "event",
    group: asGroup(query.group),
    q: (query.q || "").trim(),
    page: pageNumber(query.page),
  };

  const pageData = await getPlayerAdminPage(viewer.username, {
    eventId: state.event || null,
    scope: state.scope,
    group: state.group,
    query: state.q,
    page: state.page,
    pageSize: 40,
  });
  const selected = query.player ? await getPlayerAdminDetail(viewer.username, query.player, state.event || null) : null;
  const totalPages = Math.max(1, Math.ceil(pageData.filteredTotal / pageData.pageSize));
  const eventOptions = events.map((event) => ({ id: event.id, shortTitle: event.shortTitle, stationNo: event.stationNo, status: event.status, startDate: event.startDate, endDate: event.endDate }));
  const currentEvent = events.find((event) => event.id === state.event);

  return <AdminWorkspaceShell
    viewer={{ displayName: viewer.displayName, role: viewer.role }}
    events={eventOptions}
    active="players"
    pageTitle="球员管理"
    pageHint="球员总览与分站管理"
  >
    <main className="player-admin">
      <section className="player-admin-head">
        <div><small>PLAYER MANAGEMENT</small><h2>球员管理</h2><p>{state.scope === "all" ? "球员总览显示每名球员最近一站的参赛组别；每个分站显示该站实际报名组别。" : `当前分站：${currentEvent?.shortTitle || "—"}`}</p></div>
        {viewer.role === "system_admin" && <PlayerCreateDialog state={state} />}
      </section>

      {query.success && <div className="player-notice success">{query.success}</div>}
      {query.error && <div className="player-notice error">{query.error}</div>}

      <nav className="player-event-tabs" aria-label="球员总览与分站切换">
        {viewer.role === "system_admin" && <Link prefetch={false} className={state.scope === "all" ? "active" : ""} href={hrefFor(state, { scope: "all", event: "", page: 1, player: null })}>球员总览</Link>}
        {events.map((event) => <Link prefetch={false} key={event.id} className={state.scope === "event" && state.event === event.id ? "active" : ""} href={hrefFor(state, { scope: "event", event: event.id, page: 1, player: null })}>第{event.stationNo}站 · {event.city}</Link>)}
      </nav>

      {selected ? <section className="player-detail-card">
        <header>
          <div><small>PLAYER PROFILE · {selected.playerCode}</small><h3>{selected.fullName}{selected.identityLast4 ? ` ${selected.identityLast4}` : ""}</h3><p>球员编号：{selected.playerCode}</p></div>
          <Link prefetch={false} className="player-detail-close" href={hrefFor(state, { player: null })}>关闭并返回列表</Link>
        </header>

        <div className="player-detail-sections">
          <section><h4>基本资料</h4><dl><div><dt>姓名</dt><dd>{selected.fullName}</dd></div><div><dt>性别</dt><dd>{value(selected.gender)}</dd></div><div><dt>出生日期</dt><dd>{value(selected.birthDate)}</dd></div><div><dt>国籍</dt><dd>{selected.nationalityCode}</dd></div><div><dt>地区</dt><dd>{[selected.province, selected.city].filter(Boolean).join(" ") || "—"}</dd></div></dl></section>
          <section><h4>证件信息</h4><dl><div><dt>证件</dt><dd>{identityTypeLabel(selected.identityType)}</dd></div><div><dt>证件号码</dt><dd>{value(selected.identityNumber)}</dd></div><div><dt>证件状态</dt><dd>{identityStatusLabel(selected.identityReviewStatus)}</dd></div></dl></section>
          <section><h4>联系信息</h4><dl><div><dt>手机号码</dt><dd>{value(selected.phone)}</dd></div><div><dt>邮箱</dt><dd>{value(selected.email)}</dd></div><div><dt>微信号</dt><dd>{value(selected.wechatId)}</dd></div></dl></section>
          <section><h4>家长信息</h4><dl><div><dt>家长姓名</dt><dd>{value(selected.guardianName)}</dd></div><div><dt>联系方式</dt><dd>{value(selected.guardianPhone)}</dd></div><div><dt>关系</dt><dd>{value(selected.guardianRelationship)}</dd></div></dl></section>
          <section><h4>其它信息</h4><dl><div><dt>昵称</dt><dd>{value(selected.nickname)}</dd></div><div><dt>俱乐部</dt><dd>{value(selected.clubName)}</dd></div><div><dt>学校</dt><dd>{value(selected.schoolName)}</dd></div><div><dt>师傅 / 教练</dt><dd>{value(selected.mentorName)}</dd></div></dl></section>
        </div>

        <section className="player-history"><h4>参赛信息</h4>
          {selected.events.length ? selected.events.map((event) => <div key={`${event.eventId}-${event.groupName}`}><span><b>{event.eventTitle}</b><small>{event.startDate}</small></span><span>{event.groupName}</span><span>{event.placementLabel || "暂无排名"}</span></div>) : <p>暂无可查看的参赛记录。</p>}
        </section>
        <PlayerEditPanel state={state} player={selected} />
      </section> : <>
        <section className="player-list-card">
          <div className="player-list-toolbar">
            <nav className="player-group-tabs" aria-label="组别筛选">
              <Link prefetch={false} className={state.group === "all" ? "active" : ""} href={hrefFor(state, { group: "all", page: 1, player: null })}>全部球员</Link>
              <Link prefetch={false} className={state.group === "少年组" ? "active" : ""} href={hrefFor(state, { group: "少年组", page: 1, player: null })}>少年组</Link>
              <Link prefetch={false} className={state.group === "青年组" ? "active" : ""} href={hrefFor(state, { group: "青年组", page: 1, player: null })}>青年组</Link>
            </nav>
            <form className="player-search" method="get" action="/admin/players">
              {state.scope === "all" ? <input type="hidden" name="scope" value="all" /> : <input type="hidden" name="event" value={state.event} />}
              {state.group !== "all" && <input type="hidden" name="group" value={state.group} />}
              <input name="q" defaultValue={state.q} placeholder="搜索球员编号 / 姓名 / 手机 / 证件 / 家长" />
              <button type="submit">搜索</button>
              {state.q && <Link prefetch={false} href={hrefFor(state, { q: "", page: 1, player: null })}>清除</Link>}
            </form>
          </div>

          <div className="player-list-meta"><span>{state.q ? "搜索结果" : state.scope === "all" ? "球员总览" : currentEvent?.shortTitle} · 共 <b>{pageData.filteredTotal}</b> 人</span><small>每页 {pageData.pageSize} 人</small></div>
          <div className="player-table-wrap"><table className="player-table">
            <thead><tr><th>球员编号</th><th>球员姓名</th><th>性别</th><th>组别</th><th>手机号码</th><th>证件号码</th><th>状态</th><th>查看</th></tr></thead>
            <tbody>{pageData.items.map((player) => <tr key={player.id}>
              <td><b className="player-code">{player.playerCode}</b></td><td><strong>{player.displayName}</strong></td><td>{value(player.gender)}</td><td>{value(player.groupName)}</td><td>{value(player.phone)}</td><td>{player.identityDisplay}</td><td><span className={`player-badge profile-${player.profileStatus}`}>{profileStatusLabel(player.profileStatus)}</span></td><td><Link prefetch={false} className="player-open" href={hrefFor(state, { player: player.id })}>查看</Link></td>
            </tr>)}{!pageData.items.length && <tr><td colSpan={8}><div className="player-empty">没有找到符合当前条件的球员。</div></td></tr>}</tbody>
          </table></div>
          {totalPages > 1 && <nav className="player-pagination" aria-label="球员分页"><Link prefetch={false} className={state.page <= 1 ? "disabled" : ""} href={hrefFor(state, { page: Math.max(1, state.page - 1), player: null })}>上一页</Link><span>第 {Math.min(state.page, totalPages)} / {totalPages} 页</span><Link prefetch={false} className={state.page >= totalPages ? "disabled" : ""} href={hrefFor(state, { page: Math.min(totalPages, state.page + 1), player: null })}>下一页</Link></nav>}
        </section>
      </>}
    </main>
  </AdminWorkspaceShell>;
}
