"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { PlayerDeleteEligibility } from "@/db/player-admin-delete";
import type { PlayerArchiveDetail, PlayerArchiveListItem, PlayerArchivePageData } from "@/db/player-archive";

type ArchiveState = { event: string; scope: "event" | "all"; group: "all" | "少年组" | "青年组"; q: string; page: number };
type EventOption = { id: string; shortTitle: string; stationNo: number; status: string; startDate: string; endDate: string; city: string };
type CachedPage = { data: PlayerArchivePageData; at: number };
type CachedDetail = { data: PlayerArchiveDetail; at: number };

const PAGE_CACHE_TTL = 60_000;
const DETAIL_CACHE_TTL = 60_000;
const pageCache = new Map<string, CachedPage>();
const detailCache = new Map<string, CachedDetail>();
const detailRequests = new Map<string, Promise<PlayerArchiveDetail>>();

function stateKey(state: ArchiveState) { return [state.scope, state.event, state.group, state.q.trim().toLowerCase(), state.page].join("|"); }
function hrefFor(state: ArchiveState, playerId = "") {
  const params = new URLSearchParams();
  if (state.scope === "event" && state.event) params.set("event", state.event);
  if (state.scope === "all") params.set("scope", "all");
  if (state.group !== "all") params.set("group", state.group);
  if (state.q) params.set("q", state.q);
  if (state.page > 1) params.set("page", String(state.page));
  if (playerId) params.set("player", playerId);
  return `/admin/players${params.size ? `?${params.toString()}` : ""}`;
}
function listApiHref(state: ArchiveState) {
  const params = new URLSearchParams();
  params.set("scope", state.scope);
  if (state.scope === "event" && state.event) params.set("event", state.event);
  if (state.group !== "all") params.set("group", state.group);
  if (state.q) params.set("q", state.q);
  params.set("page", String(state.page));
  return `/api/admin/players?${params.toString()}`;
}
function detailApiHref(state: ArchiveState, playerId: string) {
  const params = new URLSearchParams();
  if (state.scope === "event" && state.event) params.set("event", state.event);
  return `/api/admin/players/${encodeURIComponent(playerId)}${params.size ? `?${params.toString()}` : ""}`;
}
function replaceUrl(state: ArchiveState, playerId = "") {
  if (typeof window !== "undefined") window.history.replaceState(window.history.state, "", hrefFor(state, playerId));
}
function value(input: string | null | undefined) { return input || "—"; }
function genderLabel(input: string | null | undefined) {
  const normalized = (input || "").toLowerCase();
  if (normalized === "male" || input === "男") return "男";
  if (normalized === "female" || input === "女") return "女";
  return "—";
}
function profileStatusLabel(status: string) { return status === "disabled" ? "停用" : "正常"; }
function identityTypeLabel(type: string | null) { return type === "passport" ? "护照" : "身份证"; }
function identityStatusLabel(status: string) {
  if (status === "conflict") return "证件冲突";
  if (status === "missing") return "证件待补";
  if (status === "verified") return "已核验";
  return "已导入";
}
function formPayload(form: HTMLFormElement) {
  const formData = new FormData(form);
  const payload: Record<string, string> = {};
  formData.forEach((entry, key) => { payload[key] = String(entry).trim(); });
  return payload;
}
function clearArchiveCaches() {
  pageCache.clear();
  detailCache.clear();
  detailRequests.clear();
}

function SectionTitle({ children }: { children: React.ReactNode }) { return <h4 className="player-form-section-title">{children}</h4>; }

function PlayerProfileFields({ player, state, creating = false }: { player?: PlayerArchiveDetail | null; state: ArchiveState; creating?: boolean }) {
  const eventGroup = state.scope === "event" ? player?.events.find((item) => item.eventId === state.event)?.groupName : null;
  const groupValue = eventGroup || player?.currentGroupName || "";
  return <>
    <SectionTitle>基本资料</SectionTitle>
    <div className="player-form-grid">
      <label><span>姓名 *</span><input name="fullName" required defaultValue={player?.fullName || ""} /></label>
      <label><span>昵称</span><input name="nickname" defaultValue={player?.nickname || ""} /></label>
      <label><span>性别</span><select name="gender" defaultValue={genderLabel(player?.gender) === "—" ? "" : genderLabel(player?.gender)}><option value="">未录入</option><option value="男">男</option><option value="女">女</option></select></label>
      <label><span>出生日期</span><input name="birthDate" type="date" defaultValue={player?.birthDate || ""} /></label>
      <label className="player-group-field"><span>当前组别 *</span><select name="groupName" required defaultValue={groupValue}><option value="" disabled>请选择组别</option><option value="少年组">少年组</option><option value="青年组">青年组</option></select><small className="player-field-note">{creating || state.scope === "all" ? "当前档案组别可以随年龄调整，历史赛事组别不会被改写。" : "当前分站未锁定时会同步修正本站报名组别；已锁定名单需先到参赛人员页面处理。"}</small></label>
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
      <label><span>状态</span><select name="profileStatus" defaultValue={player?.profileStatus || "approved"}><option value="approved">正常</option><option value="disabled">停用</option></select><small className="player-field-note">状态只用于球员档案是否启用，不再设置独立“待审核”流程。</small></label>
    </div>
  </>;
}

function PlayerCreateDialog({ state, onCreated }: { state: ArchiveState; onCreated: (playerId: string, fullName: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setError("");
    const payload = formPayload(event.currentTarget);
    try {
      const response = await fetch("/api/admin/players", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as { data?: { playerId: string }; error?: string };
      if (!response.ok || !result.data?.playerId) throw new Error(result.error || "新增球员失败。");
      setOpen(false);
      await onCreated(result.data.playerId, payload.fullName || "新球员");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "新增球员失败。");
    } finally { setSaving(false); }
  };
  return <>
    <button type="button" className="player-primary-button" onClick={() => { setError(""); setOpen(true); }}>＋ 新增球员</button>
    {open && <div className="player-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setOpen(false); }}>
      <section className="player-modal" role="dialog" aria-modal="true" aria-label="新增球员">
        <header><div><small>NEW PLAYER</small><h3>新增球员</h3><p>创建独立球员档案，不会自动生成赛事报名记录。球员编号由系统自动生成。</p></div><button type="button" aria-label="关闭新增球员窗口" disabled={saving} onClick={() => setOpen(false)}>×</button></header>
        <form className="player-form player-modal-form" onSubmit={submit}>
          <PlayerProfileFields state={state} creating />
          {error && <div className="player-form-error">{error}</div>}
          <div className="player-form-actions"><button type="button" className="secondary" disabled={saving} onClick={() => setOpen(false)}>取消</button><button type="submit" disabled={saving}>{saving ? "保存中…" : "保存球员"}</button></div>
        </form>
      </section>
    </div>}
  </>;
}

function PlayerProfileView({ player }: { player: PlayerArchiveDetail }) {
  return <>
    <div className="player-detail-sections">
      <section><h4>基本资料</h4><dl><div><dt>姓名</dt><dd>{player.fullName}</dd></div><div><dt>性别</dt><dd>{genderLabel(player.gender)}</dd></div><div><dt>出生日期</dt><dd>{value(player.birthDate)}</dd></div><div><dt>当前组别</dt><dd>{value(player.currentGroupName)}</dd></div><div><dt>国籍</dt><dd>{player.nationalityCode}</dd></div><div><dt>地区</dt><dd>{[player.province, player.city].filter(Boolean).join(" ") || "—"}</dd></div></dl></section>
      <section><h4>证件信息</h4><dl><div><dt>证件</dt><dd>{identityTypeLabel(player.identityType)}</dd></div><div><dt>证件号码</dt><dd>{value(player.identityNumber)}</dd></div><div><dt>证件状态</dt><dd>{identityStatusLabel(player.identityReviewStatus)}</dd></div></dl></section>
      <section><h4>联系信息</h4><dl><div><dt>手机号码</dt><dd>{value(player.phone)}</dd></div><div><dt>邮箱</dt><dd>{value(player.email)}</dd></div><div><dt>微信号</dt><dd>{value(player.wechatId)}</dd></div></dl></section>
      <section><h4>家长信息</h4><dl><div><dt>家长姓名</dt><dd>{value(player.guardianName)}</dd></div><div><dt>联系方式</dt><dd>{value(player.guardianPhone)}</dd></div><div><dt>关系</dt><dd>{value(player.guardianRelationship)}</dd></div></dl></section>
      <section><h4>其它信息</h4><dl><div><dt>昵称</dt><dd>{value(player.nickname)}</dd></div><div><dt>俱乐部</dt><dd>{value(player.clubName)}</dd></div><div><dt>学校</dt><dd>{value(player.schoolName)}</dd></div><div><dt>师傅 / 教练</dt><dd>{value(player.mentorName)}</dd></div><div><dt>状态</dt><dd>{profileStatusLabel(player.profileStatus)}</dd></div></dl></section>
    </div>
    <section className="player-history"><h4>参赛信息</h4>{player.events.length ? player.events.map((item) => <div key={`${item.eventId}-${item.groupName}`}><span><b>{item.eventTitle}</b><small>{item.startDate}</small></span><span>{item.groupName}</span><span>{item.placementLabel || "暂无排名"}</span></div>) : <p>暂无可查看的参赛记录。</p>}</section>
  </>;
}

function DetailSkeleton() {
  return <div className="player-detail-skeleton" aria-label="正在读取球员详情"><div className="player-detail-skeleton-grid">{[0,1,2,3].map((item) => <section key={item}><i /><i /><i /><i /></section>)}</div><p>球员基本信息已打开，参赛记录等详细资料正在补充。</p></div>;
}

function PlayerDetailDrawer({ state, summary, player, loading, error, isSystemAdmin, onClose, onRetry, onUpdated, onDeleted }: {
  state: ArchiveState; summary: PlayerArchiveListItem | null; player: PlayerArchiveDetail | null; loading: boolean; error: string; isSystemAdmin: boolean;
  onClose: () => void; onRetry: () => void; onUpdated: (playerId: string) => Promise<void>; onDeleted: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteEligibility, setDeleteEligibility] = useState<PlayerDeleteEligibility | null>(null);
  const [deleteEligibilityLoading, setDeleteEligibilityLoading] = useState(false);
  const [deleteEligibilityError, setDeleteEligibilityError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const playerId = player?.id || summary?.id || "";
  const playerName = player?.fullName || summary?.displayName || "球员档案";
  const playerCode = player?.playerCode || summary?.playerCode || "—";

  const submitEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!playerId || saving) return;
    setSaving(true); setFormError("");
    try {
      const payload = { ...formPayload(event.currentTarget), eventId: state.scope === "event" ? state.event : "" };
      const response = await fetch(`/api/admin/players/${encodeURIComponent(playerId)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "更新球员失败。");
      setEditing(false);
      await onUpdated(playerId);
    } catch (requestError) {
      setFormError(requestError instanceof Error ? requestError.message : "更新球员失败。");
    } finally { setSaving(false); }
  };

  const prepareDelete = async () => {
    if (!playerId) return;
    setDeleteOpen(true); setDeleteEligibility(null); setDeleteEligibilityError(""); setDeleteEligibilityLoading(true);
    try {
      const response = await fetch(`/api/admin/players/${encodeURIComponent(playerId)}/delete-eligibility`, { cache: "no-store" });
      const payload = await response.json() as { data?: PlayerDeleteEligibility; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || "删除条件检查失败。");
      setDeleteEligibility(payload.data);
    } catch (requestError) { setDeleteEligibilityError(requestError instanceof Error ? requestError.message : "删除条件检查失败。"); }
    finally { setDeleteEligibilityLoading(false); }
  };

  const confirmDelete = async () => {
    if (!playerId || deleting) return;
    setDeleting(true); setDeleteEligibilityError("");
    try {
      const response = await fetch(`/api/admin/players/${encodeURIComponent(playerId)}`, { method: "DELETE" });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "删除球员失败。");
      setDeleteOpen(false);
      await onDeleted();
    } catch (requestError) { setDeleteEligibilityError(requestError instanceof Error ? requestError.message : "删除球员失败。"); }
    finally { setDeleting(false); }
  };

  return <div className="player-detail-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving && !deleting) onClose(); }}>
    <section className={editing ? "player-detail-drawer editing" : "player-detail-drawer"} role="dialog" aria-modal="true" aria-label={`${playerName}球员档案`}>
      <header><div><small>PLAYER PROFILE · {playerCode}</small><h3>{editing ? `编辑 · ${playerName}` : playerName}</h3><p>球员编号：{playerCode}</p></div><button type="button" className="player-detail-close" disabled={saving || deleting} onClick={onClose}>关闭</button></header>
      {error && !player ? <div className="player-detail-error"><strong>球员详情暂时没有读取成功</strong><p>{error}</p><button type="button" onClick={onRetry}>重新读取</button></div>
      : !player ? <DetailSkeleton />
      : editing ? <form className="player-form player-inline-edit-form" onSubmit={submitEdit}><PlayerProfileFields player={player} state={state} />{formError && <div className="player-form-error">{formError}</div>}<div className="player-form-actions"><button type="button" className="secondary" disabled={saving} onClick={() => { setFormError(""); setEditing(false); }}>取消编辑</button><button type="submit" disabled={saving}>{saving ? "保存中…" : "保存修改"}</button></div></form>
      : <><PlayerProfileView player={player} /><div className="player-detail-actions"><button type="button" className="player-primary-button" onClick={() => { setFormError(""); setEditing(true); }}>编辑球员资料</button>{isSystemAdmin && <button type="button" className="player-danger-button" onClick={prepareDelete}>删除球员</button>}</div></>}
      {loading && player && <div className="player-detail-refreshing">正在刷新球员详情…</div>}

      {deleteOpen && <div className="player-modal-backdrop nested" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !deleting) setDeleteOpen(false); }}><section className="player-confirm-modal" role="dialog" aria-modal="true" aria-label="删除球员检查">
        {deleteEligibilityLoading ? <><div className="player-confirm-spinner" /><h3>正在检查是否可以删除</h3><p>只有没有成功报名和赛事数据的纯档案才允许删除。</p></>
        : deleteEligibilityError ? <><div className="player-confirm-icon blocked">!</div><h3>{deleting ? "正在删除" : "操作失败"}</h3><p>{deleteEligibilityError}</p><div className="player-confirm-actions"><button type="button" onClick={() => setDeleteOpen(false)}>关闭</button></div></>
        : deleteEligibility?.canDelete ? <><div className="player-confirm-icon danger">!</div><h3>确认删除球员档案？</h3><p><b>{playerName}（{playerCode}）</b> 的球员档案将被永久删除。</p><p className="player-delete-warning">删除后不能恢复。系统会在真正删除前再次检查报名及赛事关联数据。</p><div className="player-confirm-actions"><button type="button" className="secondary" disabled={deleting} onClick={() => setDeleteOpen(false)}>取消</button><button type="button" className="danger" disabled={deleting} onClick={confirmDelete}>{deleting ? "删除中…" : "确认永久删除"}</button></div></>
        : <><div className="player-confirm-icon blocked">×</div><h3>该球员不能删除</h3><p>{deleteEligibility?.reason || "该球员已有需要保留的关联数据，不能删除球员档案。"}</p><p className="player-delete-warning">为避免破坏历史报名、比赛和排名记录，系统已禁止删除。</p><div className="player-confirm-actions"><button type="button" onClick={() => setDeleteOpen(false)}>知道了</button></div></>}
      </section></div>}
    </section>
  </div>;
}

export function PlayerArchiveWorkspace({ viewerRole, events, initialState, initialPageData, initialPlayerId = "" }: {
  viewerRole: string; events: EventOption[]; initialState: ArchiveState; initialPageData: PlayerArchivePageData; initialPlayerId?: string;
}) {
  const [state, setState] = useState(initialState);
  const [pageData, setPageData] = useState(initialPageData);
  const [queryInput, setQueryInput] = useState(initialState.q);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [selectedSummary, setSelectedSummary] = useState<PlayerArchiveListItem | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<PlayerArchiveDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const listRequestId = useRef(0);
  const detailRequestId = useRef(0);
  const currentEvent = useMemo(() => events.find((item) => item.id === state.event), [events, state.event]);
  const totalPages = Math.max(1, Math.ceil(pageData.filteredTotal / pageData.pageSize));

  useEffect(() => { pageCache.set(stateKey(initialState), { data: initialPageData, at: Date.now() }); }, [initialPageData, initialState]);

  const fetchList = async (nextState: ArchiveState, force = false, keepDetail = false) => {
    const key = stateKey(nextState);
    const cached = pageCache.get(key);
    const requestId = ++listRequestId.current;
    setState(nextState); setQueryInput(nextState.q); setListError(""); replaceUrl(nextState, keepDetail ? selectedId : "");
    if (!keepDetail) { detailRequestId.current += 1; setSelectedId(""); setSelectedSummary(null); setSelectedDetail(null); setDetailError(""); }
    if (cached) {
      setPageData(cached.data);
      if (!force && Date.now() - cached.at < PAGE_CACHE_TTL) { setListLoading(false); return cached.data; }
    }
    setListLoading(true);
    try {
      const response = await fetch(listApiHref(nextState), { cache: "no-store" });
      const payload = await response.json() as { data?: PlayerArchivePageData; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || "球员列表读取失败。");
      pageCache.set(key, { data: payload.data, at: Date.now() });
      if (requestId === listRequestId.current) setPageData(payload.data);
      return payload.data;
    } catch (requestError) {
      if (requestId === listRequestId.current) setListError(requestError instanceof Error ? requestError.message : "球员列表读取失败。");
      return null;
    } finally { if (requestId === listRequestId.current) setListLoading(false); }
  };

  const loadDetail = async (playerId: string, summary: PlayerArchiveListItem | null, force = false, stateOverride?: ArchiveState) => {
    if (!playerId) return;
    const targetState = stateOverride || state;
    const requestId = ++detailRequestId.current;
    const detailKey = `${targetState.scope}:${targetState.event}:${playerId}`;
    setSelectedId(playerId); setSelectedSummary(summary); setDetailError(""); replaceUrl(targetState, playerId);
    const cached = detailCache.get(detailKey);
    if (cached) {
      setSelectedDetail(cached.data);
      if (!force && Date.now() - cached.at < DETAIL_CACHE_TTL) { setDetailLoading(false); return; }
    } else setSelectedDetail(null);
    setDetailLoading(true);
    try {
      let request = !force ? detailRequests.get(detailKey) : undefined;
      if (!request) {
        request = fetch(detailApiHref(targetState, playerId), { cache: "no-store" }).then(async (response) => {
          const payload = await response.json() as { data?: PlayerArchiveDetail; error?: string };
          if (!response.ok || !payload.data) throw new Error(payload.error || "球员详情读取失败。");
          return payload.data;
        });
        if (!force) detailRequests.set(detailKey, request);
      }
      const detail = await request;
      detailCache.set(detailKey, { data: detail, at: Date.now() });
      if (requestId === detailRequestId.current) setSelectedDetail(detail);
    } catch (requestError) { if (requestId === detailRequestId.current) setDetailError(requestError instanceof Error ? requestError.message : "球员详情读取失败。"); }
    finally { detailRequests.delete(detailKey); if (requestId === detailRequestId.current) setDetailLoading(false); }
  };

  useEffect(() => {
    if (!initialPlayerId) return;
    const summary = initialPageData.items.find((item) => item.id === initialPlayerId) || null;
    const timer = window.setTimeout(() => { void loadDetail(initialPlayerId, summary); }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeDetail = () => { detailRequestId.current += 1; setSelectedId(""); setSelectedSummary(null); setSelectedDetail(null); setDetailError(""); setDetailLoading(false); replaceUrl(state); };
  const onCreated = async (_playerId: string, fullName: string) => {
    clearArchiveCaches();
    setNotice({ tone: "success", text: `球员档案“${fullName}”已创建。` });
    const target: ArchiveState = { event: "", scope: "all", group: "all", q: fullName, page: 1 };
    await fetchList(target, true);
  };
  const onUpdated = async (playerId: string) => {
    clearArchiveCaches();
    setNotice({ tone: "success", text: "球员档案已更新。" });
    await Promise.all([fetchList(state, true, true), loadDetail(playerId, selectedSummary, true)]);
  };
  const onDeleted = async () => {
    clearArchiveCaches();
    setNotice({ tone: "success", text: "球员档案已永久删除。" });
    detailRequestId.current += 1; setSelectedId(""); setSelectedSummary(null); setSelectedDetail(null); setDetailError(""); setDetailLoading(false); replaceUrl(state);
    await fetchList(state, true);
  };
  const submitSearch = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setNotice(null); void fetchList({ ...state, q: queryInput.trim(), page: 1 }); };

  return <main className="player-admin player-admin-interactive">
    <section className="player-admin-head"><div><small>PLAYER PROFILE MANAGEMENT</small><h2>球员档案</h2><p>{state.scope === "all" ? "统一维护球员当前档案。历史赛事中的参赛组别保留在报名记录中，不会因为档案组别调整而被覆盖。" : `当前筛选：${currentEvent?.shortTitle || "—"}。未锁定参赛名单时，可在编辑档案中同步修正本站组别。`}</p></div>{viewerRole === "system_admin" && <PlayerCreateDialog state={state} onCreated={onCreated} />}</section>
    {notice && <div className={`player-notice ${notice.tone}`}>{notice.text}<button type="button" onClick={() => setNotice(null)}>×</button></div>}
    <nav className="player-event-tabs" aria-label="球员总览与分站切换">{viewerRole === "system_admin" && <button type="button" className={state.scope === "all" ? "active" : ""} onClick={() => { if (state.scope !== "all") void fetchList({ ...state, scope: "all", event: "", page: 1 }); }}>球员总览</button>}{events.map((item) => <button type="button" key={item.id} className={state.scope === "event" && state.event === item.id ? "active" : ""} onClick={() => { if (state.scope !== "event" || state.event !== item.id) void fetchList({ ...state, scope: "event", event: item.id, page: 1 }); }}>第{item.stationNo}站 · {item.city}</button>)}</nav>
    <section className={listLoading ? "player-list-card is-refreshing" : "player-list-card"}>
      <div className="player-list-toolbar"><nav className="player-group-tabs" aria-label="组别筛选">{(["all","少年组","青年组"] as const).map((group) => <button type="button" key={group} className={state.group === group ? "active" : ""} onClick={() => { if (state.group !== group) void fetchList({ ...state, group, page: 1 }); }}>{group === "all" ? "全部球员" : group}</button>)}</nav><form className="player-search" onSubmit={submitSearch}><input value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="搜索球员编号 / 姓名 / 手机 / 证件 / 家长" /><button type="submit" disabled={listLoading && queryInput.trim() === state.q}>搜索</button>{state.q && <button type="button" className="player-search-clear" onClick={() => { setQueryInput(""); void fetchList({ ...state, q: "", page: 1 }); }}>清除</button>}</form></div>
      {listLoading && <div className="player-list-refresh"><i />正在更新列表…</div>}{listError && <div className="player-list-error"><span>{listError}</span><button type="button" onClick={() => { void fetchList(state, true); }}>重新读取</button></div>}
      <div className="player-list-meta"><span>{state.q ? "搜索结果" : state.scope === "all" ? "球员总览" : currentEvent?.shortTitle} · 共 <b>{pageData.filteredTotal}</b> 人</span><small>每页 {pageData.pageSize} 人 · 已读取结果会保留在当前会话缓存</small></div>
      <div className="player-table-wrap"><table className="player-table"><thead><tr><th>球员编号</th><th>球员姓名</th><th>性别</th><th>组别</th><th>手机号码</th><th>证件号码</th><th>状态</th><th>查看</th></tr></thead><tbody>{pageData.items.map((item) => <tr key={item.id}><td><b className="player-code">{item.playerCode}</b></td><td><strong>{item.displayName}</strong></td><td>{genderLabel(item.gender)}</td><td>{value(item.groupName)}</td><td>{value(item.phone)}</td><td>{item.identityDisplay}</td><td><span className={`player-badge profile-${item.profileStatus}`}>{profileStatusLabel(item.profileStatus)}</span></td><td><button type="button" className="player-open" disabled={listLoading} onClick={() => { void loadDetail(item.id, item); }}>查看</button></td></tr>)}{!pageData.items.length && <tr><td colSpan={8}><div className="player-empty">没有找到符合当前条件的球员。</div></td></tr>}</tbody></table></div>
      {totalPages > 1 && <nav className="player-pagination" aria-label="球员分页"><button type="button" disabled={state.page <= 1 || listLoading} onClick={() => { void fetchList({ ...state, page: Math.max(1, state.page - 1) }); }}>上一页</button><span>第 {Math.min(state.page, totalPages)} / {totalPages} 页</span><button type="button" disabled={state.page >= totalPages || listLoading} onClick={() => { void fetchList({ ...state, page: Math.min(totalPages, state.page + 1) }); }}>下一页</button></nav>}
    </section>
    {selectedId && <PlayerDetailDrawer key={selectedId} state={state} summary={selectedSummary} player={selectedDetail} loading={detailLoading} error={detailError} isSystemAdmin={viewerRole === "system_admin"} onClose={closeDetail} onRetry={() => { void loadDetail(selectedId, selectedSummary, true); }} onUpdated={onUpdated} onDeleted={onDeleted} />}
  </main>;
}
