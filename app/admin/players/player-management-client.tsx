"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { PlayerAdminDetail, PlayerAdminListItem, PlayerAdminPageData } from "@/db/player-admin-v2";
import type { PlayerDeleteEligibility } from "@/db/player-admin-delete";
import { createPlayerAction, deletePlayerAction, updatePlayerAction } from "./actions";

type ReturnState = { event: string; scope: "event" | "all"; group: "all" | "少年组" | "青年组"; q: string; page: number };
type EventOption = { id: string; shortTitle: string; stationNo: number; status: string; startDate: string; endDate: string; city: string };
type CachedPage = { data: PlayerAdminPageData; at: number };
type CachedDetail = { data: PlayerAdminDetail; at: number };

const PAGE_CACHE_TTL = 60_000;
const DETAIL_CACHE_TTL = 60_000;
const pageCache = new Map<string, CachedPage>();
const detailCache = new Map<string, CachedDetail>();
const detailRequests = new Map<string, Promise<PlayerAdminDetail>>();

function stateKey(state: ReturnState) {
  return [state.scope, state.event, state.group, state.q.trim().toLowerCase(), state.page].join("|");
}

function hrefFor(state: ReturnState, playerId = "") {
  const params = new URLSearchParams();
  if (state.scope === "event" && state.event) params.set("event", state.event);
  if (state.scope === "all") params.set("scope", "all");
  if (state.group !== "all") params.set("group", state.group);
  if (state.q) params.set("q", state.q);
  if (state.page > 1) params.set("page", String(state.page));
  if (playerId) params.set("player", playerId);
  return `/admin/players${params.size ? `?${params.toString()}` : ""}`;
}

function listApiHref(state: ReturnState) {
  const params = new URLSearchParams();
  if (state.scope === "event" && state.event) params.set("event", state.event);
  params.set("scope", state.scope);
  if (state.group !== "all") params.set("group", state.group);
  if (state.q) params.set("q", state.q);
  params.set("page", String(state.page));
  return `/api/admin/players?${params.toString()}`;
}

function replaceUrl(state: ReturnState, playerId = "") {
  if (typeof window === "undefined") return;
  window.history.replaceState(window.history.state, "", hrefFor(state, playerId));
}

function profileStatusLabel(status: string) {
  if (status === "approved") return "正常";
  if (status === "disabled") return "停用";
  return "待审核";
}

function identityTypeLabel(type: string | null) {
  return type === "passport" ? "护照" : "身份证";
}

function identityStatusLabel(status: string) {
  if (status === "conflict") return "证件冲突";
  if (status === "missing") return "证件待补";
  if (status === "verified") return "已核验";
  return "已导入";
}

function value(input: string | null | undefined) {
  return input || "—";
}

function ReturnFields({ state }: { state: ReturnState }) {
  return <>
    <input type="hidden" name="returnEvent" value={state.event} />
    <input type="hidden" name="returnScope" value={state.scope} />
    <input type="hidden" name="returnGroup" value={state.group} />
    <input type="hidden" name="returnQuery" value={state.q} />
    <input type="hidden" name="returnPage" value={state.page} />
  </>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="player-form-section-title">{children}</h4>;
}

function PlayerProfileFields({ player, creating = false }: { player?: PlayerAdminDetail | null; creating?: boolean }) {
  return <>
    <SectionTitle>基本资料</SectionTitle>
    <div className="player-form-grid">
      <label><span>姓名 *</span><input name="fullName" required defaultValue={player?.fullName || ""} /></label>
      <label><span>昵称</span><input name="nickname" defaultValue={player?.nickname || ""} /></label>
      <label><span>性别</span><select name="gender" defaultValue={player?.gender || ""}><option value="">未录入</option><option value="男">男</option><option value="女">女</option></select></label>
      <label><span>出生日期</span><input name="birthDate" type="date" defaultValue={player?.birthDate || ""} /></label>
      <label><span>国籍</span><input name="nationalityCode" defaultValue={player?.nationalityCode || "CN"} maxLength={8} /></label>
      <label><span>省份</span><input name="province" defaultValue={player?.province || ""} /></label>
      <label><span>城市</span><input name="city" defaultValue={player?.city || ""} /></label>
    </div>

    <SectionTitle>证件信息</SectionTitle>
    <div className="player-form-grid">
      <label><span>证件 *</span><select name="identityType" defaultValue={player?.identityType || "id_card"}><option value="id_card">身份证</option><option value="passport">护照</option></select></label>
      <label><span>证件号码 *</span><input name="identityNo" required={creating || Boolean(player?.identityNumber)} autoComplete="off" defaultValue={player?.identityNumber || ""} placeholder={creating ? "请输入身份证或护照号码" : "暂无证件时可留空"} /></label>
    </div>

    <SectionTitle>联系信息</SectionTitle>
    <div className="player-form-grid">
      <label><span>手机号码</span><input name="phone" inputMode="tel" defaultValue={player?.phone || ""} /></label>
      <label><span>邮箱</span><input name="email" type="email" defaultValue={player?.email || ""} /></label>
      <label><span>微信号</span><input name="wechatId" defaultValue={player?.wechatId || ""} /></label>
    </div>

    <SectionTitle>家长信息</SectionTitle>
    <div className="player-form-grid">
      <label><span>家长姓名</span><input name="guardianName" defaultValue={player?.guardianName || ""} /></label>
      <label><span>关系</span><input name="guardianRelationship" defaultValue={player?.guardianRelationship || ""} placeholder="父亲 / 母亲 / 监护人" /></label>
      <label><span>联系方式</span><input name="guardianPhone" inputMode="tel" defaultValue={player?.guardianPhone || ""} /></label>
    </div>

    <SectionTitle>其它信息</SectionTitle>
    <div className="player-form-grid">
      <label><span>俱乐部</span><input name="clubName" defaultValue={player?.clubName || ""} /></label>
      <label><span>学校</span><input name="schoolName" defaultValue={player?.schoolName || ""} /></label>
      <label><span>师傅 / 教练</span><input name="mentorName" defaultValue={player?.mentorName || ""} /></label>
      <label><span>状态</span><select name="profileStatus" defaultValue={player?.profileStatus || "approved"}><option value="approved">正常</option><option value="pending">待审核</option><option value="disabled">停用</option></select></label>
    </div>
  </>;
}

export function PlayerCreateDialog({ state }: { state: ReturnState }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className="player-primary-button" onClick={() => setOpen(true)}>＋ 新增球员</button>
    {open && <div className="player-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="player-modal" role="dialog" aria-modal="true" aria-label="新增球员">
        <header><div><small>NEW PLAYER</small><h3>新增球员</h3><p>与编辑球员使用同一套档案字段。证件作为唯一身份依据，球员编号由系统自动生成。</p></div><button type="button" aria-label="关闭新增球员窗口" onClick={() => setOpen(false)}>×</button></header>
        <form action={createPlayerAction} className="player-form player-modal-form">
          <ReturnFields state={state} />
          <PlayerProfileFields creating />
          <div className="player-form-actions"><button type="button" className="secondary" onClick={() => setOpen(false)}>取消</button><button type="submit">保存球员</button></div>
        </form>
      </section>
    </div>}
  </>;
}

function PlayerProfileView({ player }: { player: PlayerAdminDetail }) {
  return <>
    <div className="player-detail-sections">
      <section><h4>基本资料</h4><dl><div><dt>姓名</dt><dd>{player.fullName}</dd></div><div><dt>性别</dt><dd>{value(player.gender)}</dd></div><div><dt>出生日期</dt><dd>{value(player.birthDate)}</dd></div><div><dt>国籍</dt><dd>{player.nationalityCode}</dd></div><div><dt>地区</dt><dd>{[player.province, player.city].filter(Boolean).join(" ") || "—"}</dd></div></dl></section>
      <section><h4>证件信息</h4><dl><div><dt>证件</dt><dd>{identityTypeLabel(player.identityType)}</dd></div><div><dt>证件号码</dt><dd>{value(player.identityNumber)}</dd></div><div><dt>证件状态</dt><dd>{identityStatusLabel(player.identityReviewStatus)}</dd></div></dl></section>
      <section><h4>联系信息</h4><dl><div><dt>手机号码</dt><dd>{value(player.phone)}</dd></div><div><dt>邮箱</dt><dd>{value(player.email)}</dd></div><div><dt>微信号</dt><dd>{value(player.wechatId)}</dd></div></dl></section>
      <section><h4>家长信息</h4><dl><div><dt>家长姓名</dt><dd>{value(player.guardianName)}</dd></div><div><dt>联系方式</dt><dd>{value(player.guardianPhone)}</dd></div><div><dt>关系</dt><dd>{value(player.guardianRelationship)}</dd></div></dl></section>
      <section><h4>其它信息</h4><dl><div><dt>昵称</dt><dd>{value(player.nickname)}</dd></div><div><dt>俱乐部</dt><dd>{value(player.clubName)}</dd></div><div><dt>学校</dt><dd>{value(player.schoolName)}</dd></div><div><dt>师傅 / 教练</dt><dd>{value(player.mentorName)}</dd></div></dl></section>
    </div>
    <section className="player-history"><h4>参赛信息</h4>
      {player.events.length ? player.events.map((event) => <div key={`${event.eventId}-${event.groupName}`}><span><b>{event.eventTitle}</b><small>{event.startDate}</small></span><span>{event.groupName}</span><span>{event.placementLabel || "暂无排名"}</span></div>) : <p>暂无可查看的参赛记录。</p>}
    </section>
  </>;
}

function DetailSkeleton() {
  return <div className="player-detail-skeleton" aria-label="正在读取球员详情">
    <div className="player-detail-skeleton-grid">{[0, 1, 2, 3].map((item) => <section key={item}><i /><i /><i /><i /></section>)}</div>
    <p>球员基本信息已打开，参赛记录等详细资料正在补充。</p>
  </div>;
}

function PlayerDetailDrawer({ state, summary, player, loading, error, isSystemAdmin, onClose, onRetry }: {
  state: ReturnState;
  summary: PlayerAdminListItem | null;
  player: PlayerAdminDetail | null;
  loading: boolean;
  error: string;
  isSystemAdmin: boolean;
  onClose: () => void;
  onRetry: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteEligibility, setDeleteEligibility] = useState<PlayerDeleteEligibility | null>(null);
  const [deleteEligibilityLoading, setDeleteEligibilityLoading] = useState(false);
  const [deleteEligibilityError, setDeleteEligibilityError] = useState("");
  const playerId = player?.id || summary?.id || "";
  const playerName = player?.fullName || summary?.displayName || "球员档案";
  const playerCode = player?.playerCode || summary?.playerCode || "—";

  const prepareDelete = async () => {
    if (!playerId) return;
    setDeleteOpen(true);
    setDeleteEligibility(null);
    setDeleteEligibilityError("");
    setDeleteEligibilityLoading(true);
    try {
      const response = await fetch(`/api/admin/players/${encodeURIComponent(playerId)}/delete-eligibility`, { cache: "no-store" });
      const payload = await response.json() as { data?: PlayerDeleteEligibility; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || "删除条件检查失败。");
      setDeleteEligibility(payload.data);
    } catch (requestError) {
      setDeleteEligibilityError(requestError instanceof Error ? requestError.message : "删除条件检查失败。");
    } finally {
      setDeleteEligibilityLoading(false);
    }
  };

  return <div className="player-detail-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className={editing ? "player-detail-drawer editing" : "player-detail-drawer"} role="dialog" aria-modal="true" aria-label={`${playerName}球员档案`}>
      <header>
        <div><small>PLAYER PROFILE · {playerCode}</small><h3>{editing ? `编辑 · ${playerName}` : playerName}</h3><p>球员编号：{playerCode}</p></div>
        <button type="button" className="player-detail-close" onClick={onClose}>关闭</button>
      </header>

      {error && !player ? <div className="player-detail-error"><strong>球员详情暂时没有读取成功</strong><p>{error}</p><button type="button" onClick={onRetry}>重新读取</button></div>
      : !player ? <DetailSkeleton />
      : editing ? <form action={updatePlayerAction} className="player-form player-inline-edit-form">
          <ReturnFields state={state} />
          <input type="hidden" name="playerId" value={player.id} />
          <PlayerProfileFields player={player} />
          <div className="player-form-actions"><button type="button" className="secondary" onClick={() => setEditing(false)}>取消编辑</button><button type="submit">保存修改</button></div>
        </form>
      : <>
          <PlayerProfileView player={player} />
          <div className="player-detail-actions">
            <button type="button" className="player-primary-button" onClick={() => setEditing(true)}>编辑球员资料</button>
            {isSystemAdmin && <button type="button" className="player-danger-button" onClick={prepareDelete}>删除球员</button>}
          </div>
        </>}

      {loading && player && <div className="player-detail-refreshing">正在刷新球员详情…</div>}

      {deleteOpen && <div className="player-modal-backdrop nested" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeleteOpen(false); }}>
        <section className="player-confirm-modal" role="dialog" aria-modal="true" aria-label="删除球员检查">
          {deleteEligibilityLoading ? <><div className="player-confirm-spinner" /><h3>正在检查是否可以删除</h3><p>只有真正点击删除时才检查赛事关联数据。</p></>
          : deleteEligibilityError ? <><div className="player-confirm-icon blocked">!</div><h3>检查失败</h3><p>{deleteEligibilityError}</p><div className="player-confirm-actions"><button type="button" className="secondary" onClick={() => setDeleteOpen(false)}>关闭</button><button type="button" onClick={prepareDelete}>重新检查</button></div></>
          : deleteEligibility?.canDelete ? <>
              <div className="player-confirm-icon danger">!</div><h3>确认删除球员档案？</h3><p><b>{playerName}（{playerCode}）</b> 的球员档案将被永久删除。</p><p className="player-delete-warning">删除后不能恢复，请确认该球员没有需要保留的报名或赛事数据。</p>
              <form action={deletePlayerAction} className="player-confirm-actions"><ReturnFields state={state} /><input type="hidden" name="playerId" value={playerId} /><button type="button" className="secondary" onClick={() => setDeleteOpen(false)}>取消</button><button type="submit" className="danger">确认永久删除</button></form>
            </>
          : <><div className="player-confirm-icon blocked">×</div><h3>该球员不能删除</h3><p>{deleteEligibility?.reason || "该球员已有需要保留的关联数据，不能删除球员档案。"}</p><p className="player-delete-warning">为避免破坏历史报名、比赛和排名记录，系统已禁止删除。</p><div className="player-confirm-actions"><button type="button" onClick={() => setDeleteOpen(false)}>知道了</button></div></>}
        </section>
      </div>}
    </section>
  </div>;
}

export function PlayerManagementWorkspace({ viewerRole, events, initialState, initialPageData, initialPlayerId = "", initialSuccess = "", initialError = "" }: {
  viewerRole: string;
  events: EventOption[];
  initialState: ReturnState;
  initialPageData: PlayerAdminPageData;
  initialPlayerId?: string;
  initialSuccess?: string;
  initialError?: string;
}) {
  const [state, setState] = useState(initialState);
  const [pageData, setPageData] = useState(initialPageData);
  const [queryInput, setQueryInput] = useState(initialState.q);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(() => initialSuccess ? { tone: "success", text: initialSuccess } : initialError ? { tone: "error", text: initialError } : null);
  const [selectedId, setSelectedId] = useState("");
  const [selectedSummary, setSelectedSummary] = useState<PlayerAdminListItem | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<PlayerAdminDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const listRequestId = useRef(0);
  const detailRequestId = useRef(0);

  const currentEvent = useMemo(() => events.find((event) => event.id === state.event), [events, state.event]);
  const totalPages = Math.max(1, Math.ceil(pageData.filteredTotal / pageData.pageSize));

  useEffect(() => {
    pageCache.set(stateKey(initialState), { data: initialPageData, at: Date.now() });
  }, [initialPageData, initialState]);

  const fetchList = async (nextState: ReturnState, force = false) => {
    const key = stateKey(nextState);
    const cached = pageCache.get(key);
    const requestId = ++listRequestId.current;
    detailRequestId.current += 1;
    setState(nextState);
    setQueryInput(nextState.q);
    setSelectedId("");
    setSelectedSummary(null);
    setSelectedDetail(null);
    setDetailError("");
    replaceUrl(nextState);
    setListError("");

    if (cached) {
      setPageData(cached.data);
      if (!force && Date.now() - cached.at < PAGE_CACHE_TTL) {
        setListLoading(false);
        return;
      }
    }

    setListLoading(true);
    try {
      const response = await fetch(listApiHref(nextState), { cache: "no-store" });
      const payload = await response.json() as { data?: PlayerAdminPageData; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || "球员列表读取失败。");
      pageCache.set(key, { data: payload.data, at: Date.now() });
      if (requestId !== listRequestId.current) return;
      setPageData(payload.data);
    } catch (requestError) {
      if (requestId !== listRequestId.current) return;
      setListError(requestError instanceof Error ? requestError.message : "球员列表读取失败。");
    } finally {
      if (requestId === listRequestId.current) setListLoading(false);
    }
  };

  const loadDetail = async (playerId: string, summary: PlayerAdminListItem | null, force = false) => {
    if (!playerId) return;
    const requestId = ++detailRequestId.current;
    const detailKey = `${state.scope}:${state.event}:${playerId}`;
    setSelectedId(playerId);
    setSelectedSummary(summary);
    setDetailError("");
    replaceUrl(state, playerId);

    const cached = detailCache.get(detailKey);
    if (cached) {
      setSelectedDetail(cached.data);
      if (!force && Date.now() - cached.at < DETAIL_CACHE_TTL) {
        setDetailLoading(false);
        return;
      }
    } else {
      setSelectedDetail(null);
    }

    setDetailLoading(true);
    try {
      let request = !force ? detailRequests.get(detailKey) : undefined;
      if (!request) {
        const params = new URLSearchParams();
        if (state.scope === "event" && state.event) params.set("event", state.event);
        request = fetch(`/api/admin/players/${encodeURIComponent(playerId)}${params.size ? `?${params.toString()}` : ""}`, { cache: "no-store" }).then(async (response) => {
          const payload = await response.json() as { data?: PlayerAdminDetail; error?: string };
          if (!response.ok || !payload.data) throw new Error(payload.error || "球员详情读取失败。");
          return payload.data;
        });
        if (!force) detailRequests.set(detailKey, request);
      }
      const detail = await request;
      detailCache.set(detailKey, { data: detail, at: Date.now() });
      if (requestId !== detailRequestId.current) return;
      setSelectedDetail(detail);
    } catch (requestError) {
      if (requestId !== detailRequestId.current) return;
      setDetailError(requestError instanceof Error ? requestError.message : "球员详情读取失败。");
    } finally {
      detailRequests.delete(detailKey);
      if (requestId === detailRequestId.current) setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (!initialPlayerId) return;
    const summary = initialPageData.items.find((item) => item.id === initialPlayerId) || null;
    const timer = window.setTimeout(() => { void loadDetail(initialPlayerId, summary); }, 0);
    return () => window.clearTimeout(timer);
    // Direct-link detail hydration only runs on the first mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    void fetchList({ ...state, q: queryInput.trim(), page: 1 });
  };

  const closeDetail = () => {
    detailRequestId.current += 1;
    setSelectedId("");
    setSelectedSummary(null);
    setSelectedDetail(null);
    setDetailError("");
    setDetailLoading(false);
    replaceUrl(state);
  };

  return <main className="player-admin player-admin-interactive">
    <section className="player-admin-head">
      <div><small>PLAYER PROFILE MANAGEMENT</small><h2>球员管理</h2><p>{state.scope === "all" ? "统一维护球员档案。搜索、筛选、分页和查看详情都会在当前工作区内完成，不再整页跳转。" : `当前筛选：${currentEvent?.shortTitle || "—"}。列表操作只更新当前数据区域。`}</p></div>
      {viewerRole === "system_admin" && <PlayerCreateDialog state={state} />}
    </section>

    {notice && <div className={`player-notice ${notice.tone}`}>{notice.text}<button type="button" onClick={() => setNotice(null)}>×</button></div>}

    <nav className="player-event-tabs" aria-label="球员总览与分站切换">
      {viewerRole === "system_admin" && <button type="button" className={state.scope === "all" ? "active" : ""} onClick={() => { if (state.scope !== "all") void fetchList({ ...state, scope: "all", event: "", page: 1 }); }}>球员总览</button>}
      {events.map((event) => <button type="button" key={event.id} className={state.scope === "event" && state.event === event.id ? "active" : ""} onClick={() => { if (state.scope !== "event" || state.event !== event.id) void fetchList({ ...state, scope: "event", event: event.id, page: 1 }); }}>第{event.stationNo}站 · {event.city}</button>)}
    </nav>

    <section className={listLoading ? "player-list-card is-refreshing" : "player-list-card"}>
      <div className="player-list-toolbar">
        <nav className="player-group-tabs" aria-label="组别筛选">
          {(["all", "少年组", "青年组"] as const).map((group) => <button type="button" key={group} className={state.group === group ? "active" : ""} onClick={() => { if (state.group !== group) void fetchList({ ...state, group, page: 1 }); }}>{group === "all" ? "全部球员" : group}</button>)}
        </nav>
        <form className="player-search" onSubmit={submitSearch}>
          <input value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="搜索球员编号 / 姓名 / 手机 / 证件 / 家长" />
          <button type="submit" disabled={listLoading && queryInput.trim() === state.q}>搜索</button>
          {state.q && <button type="button" className="player-search-clear" onClick={() => { setQueryInput(""); void fetchList({ ...state, q: "", page: 1 }); }}>清除</button>}
        </form>
      </div>

      {listLoading && <div className="player-list-refresh"><i />正在更新列表…</div>}
      {listError && <div className="player-list-error"><span>{listError}</span><button type="button" onClick={() => { void fetchList(state, true); }}>重新读取</button></div>}

      <div className="player-list-meta"><span>{state.q ? "搜索结果" : state.scope === "all" ? "球员总览" : currentEvent?.shortTitle} · 共 <b>{pageData.filteredTotal}</b> 人</span><small>每页 {pageData.pageSize} 人 · 已读取结果会保留在当前会话缓存</small></div>
      <div className="player-table-wrap"><table className="player-table">
        <thead><tr><th>球员编号</th><th>球员姓名</th><th>性别</th><th>组别</th><th>手机号码</th><th>证件号码</th><th>状态</th><th>查看</th></tr></thead>
        <tbody>{pageData.items.map((player) => <tr key={player.id}>
          <td><b className="player-code">{player.playerCode}</b></td><td><strong>{player.displayName}</strong></td><td>{value(player.gender)}</td><td>{value(player.groupName)}</td><td>{value(player.phone)}</td><td>{player.identityDisplay}</td><td><span className={`player-badge profile-${player.profileStatus}`}>{profileStatusLabel(player.profileStatus)}</span></td><td><button type="button" className="player-open" disabled={listLoading} onClick={() => { void loadDetail(player.id, player); }}>查看</button></td>
        </tr>)}{!pageData.items.length && <tr><td colSpan={8}><div className="player-empty">没有找到符合当前条件的球员。</div></td></tr>}</tbody>
      </table></div>
      {totalPages > 1 && <nav className="player-pagination" aria-label="球员分页"><button type="button" disabled={state.page <= 1} onClick={() => { void fetchList({ ...state, page: Math.max(1, state.page - 1) }); }}>上一页</button><span>第 {Math.min(state.page, totalPages)} / {totalPages} 页</span><button type="button" disabled={state.page >= totalPages} onClick={() => { void fetchList({ ...state, page: Math.min(totalPages, state.page + 1) }); }}>下一页</button></nav>}
    </section>

    {selectedId && <PlayerDetailDrawer key={selectedId} state={state} summary={selectedSummary} player={selectedDetail} loading={detailLoading} error={detailError} isSystemAdmin={viewerRole === "system_admin"} onClose={closeDetail} onRetry={() => { void loadDetail(selectedId, selectedSummary, true); }} />}
  </main>;
}
