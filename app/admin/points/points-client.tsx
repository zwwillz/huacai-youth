"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { PlayerPointsDetail, PlayerPointsListItem, PlayerPointsPageData, PlayerPointsRule } from "@/db/player-points";

type PointsState = { event: string; scope: "event" | "all"; group: "all" | "少年组" | "青年组"; q: string; page: number };
type EventOption = { id: string; shortTitle: string; stationNo: number; status: string; startDate: string; endDate: string; city: string };
type CachedPage = { data: PlayerPointsPageData };
type CachedDetail = { data: PlayerPointsDetail };
type Notice = { tone: "success" | "error"; text: string };

const pageCache = new Map<string, CachedPage>();
const detailCache = new Map<string, CachedDetail>();
const detailRequests = new Map<string, Promise<PlayerPointsDetail>>();

function stateKey(state: PointsState) {
  return [state.scope, state.event, state.group, state.q.trim().toLowerCase(), state.page].join("|");
}
function hrefFor(state: PointsState, playerId = "") {
  const params = new URLSearchParams();
  if (state.scope === "event" && state.event) params.set("event", state.event);
  if (state.scope === "all") params.set("scope", "all");
  if (state.group !== "all") params.set("group", state.group);
  if (state.q) params.set("q", state.q);
  if (state.page > 1) params.set("page", String(state.page));
  if (playerId) params.set("player", playerId);
  return `/admin/points${params.size ? `?${params.toString()}` : ""}`;
}
function listApiHref(state: PointsState) {
  const params = new URLSearchParams();
  params.set("scope", state.scope);
  if (state.event) params.set("event", state.event);
  if (state.group !== "all") params.set("group", state.group);
  if (state.q) params.set("q", state.q);
  params.set("page", String(state.page));
  return `/api/admin/points?${params.toString()}`;
}
function detailApiHref(state: PointsState, playerId: string) {
  const params = new URLSearchParams();
  params.set("scope", state.scope);
  if (state.event) params.set("event", state.event);
  return `/api/admin/points/${encodeURIComponent(playerId)}?${params.toString()}`;
}
function replaceUrl(state: PointsState, playerId = "") {
  if (typeof window === "undefined") return;
  window.history.replaceState(window.history.state, "", hrefFor(state, playerId));
}
function money(cents: number) {
  return new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 0 }).format(cents / 100);
}
function value(input: string | null | undefined) { return input || "—"; }

function RuleDialog({ rule, onSaved }: { rule: PlayerPointsRule; onSaved: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const formData = new FormData(event.currentTarget);
      const response = await fetch("/api/admin/points/rule", {
        method: "PUT",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: rule.year,
          participationPoints: Number(formData.get("participationPoints")),
          prizeUnitYuan: Number(formData.get("prizeUnitYuan")),
          prizePointsPerUnit: Number(formData.get("prizePointsPerUnit")),
        }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "积分规则保存失败。");
      await onSaved();
      setOpen(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "积分规则保存失败。");
    } finally {
      setSaving(false);
    }
  };

  return <>
    <button type="button" className="points-rule-button" onClick={() => { setError(""); setOpen(true); }}>积分规则设置</button>
    {open && <div className="points-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setOpen(false); }}>
      <section className="points-rule-modal" role="dialog" aria-modal="true" aria-label="积分规则设置">
        <header><div><small>POINTS RULE</small><h3>{rule.year} 赛季积分规则</h3><p>依据中国台球协会赛事积分排名管理办法 E 级赛事规则设置。保存后不跳转页面，当前赛季积分与排名会立即重新计算。</p></div><button type="button" aria-label="关闭积分规则" disabled={saving} onClick={() => setOpen(false)}>×</button></header>
        <div className="points-rule-reference">
          <b>中国台球协会 E 级赛事</b>
          <span>奖金 5 万元以上：积分 = 奖金数额 ÷ 100 × 1.0</span>
          <span>奖金 3–5 万元：积分 = 奖金数额 ÷ 100 × 0.5</span>
          <span>奖金 3 万元以下：不获得奖金积分</span>
          <span>参赛分：参赛费 ÷ 100，100 元以下不计</span>
          <strong>华彩当前赛事：奖金 5 万元以上，报名费 100 元，因此按“奖金 ÷ 100 + 每站 1 分参赛分”计算。</strong>
        </div>
        <form onSubmit={submit} className="points-rule-form">
          <label><span>每参加 1 站赛事</span><div><input type="number" name="participationPoints" min="0" step="1" defaultValue={rule.participationPoints} required /><em>积分</em></div></label>
          <label><span>奖金积分计算基数</span><div><input type="number" name="prizeUnitYuan" min="1" step="1" defaultValue={rule.prizeUnitYuan} required /><em>元</em></div></label>
          <label><span>每个基数对应积分</span><div><input type="number" name="prizePointsPerUnit" min="0" step="1" defaultValue={rule.prizePointsPerUnit} required /><em>积分</em></div></label>
          <p className="points-rule-formula">当前计算参数：每站 +{rule.participationPoints} 分；奖金每 {rule.prizeUnitYuan} 元 +{rule.prizePointsPerUnit} 分。</p>
          {error && <p className="points-rule-error">{error}</p>}
          <div className="points-rule-actions"><button type="button" className="secondary" disabled={saving} onClick={() => setOpen(false)}>取消</button><button type="submit" disabled={saving}>{saving ? "保存并重算中…" : "保存规则"}</button></div>
        </form>
      </section>
    </div>}
  </>;
}

function DetailFrame({ summary, detail, loading, error, onClose, onRetry }: {
  summary: PlayerPointsListItem | null;
  detail: PlayerPointsDetail | null;
  loading: boolean;
  error: string;
  onClose: () => void;
  onRetry: () => void;
}) {
  const name = detail?.displayName || summary?.displayName || "积分详情";
  return <div className="points-detail-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="points-detail-drawer" role="dialog" aria-modal="true" aria-label={`${name}积分详情`}>
      <header><div><small>PLAYER POINTS</small><h3>{name}</h3><p>参赛、成绩、奖金与积分明细</p></div><button type="button" onClick={onClose}>关闭</button></header>
      {error && !detail ? <div className="points-detail-error"><strong>积分详情暂时没有读取成功</strong><p>{error}</p><button type="button" onClick={onRetry}>重新读取</button></div>
      : !detail ? <div className="points-detail-loading"><div className="points-summary-grid">{[0,1,2,3].map((item) => <article key={item}><span>数据正在补齐</span><strong>—</strong></article>)}</div><div className="points-history-frame"><b>参赛赛事</b><p>赛事明细正在读取…</p></div></div>
      : <>
          <section className="points-summary-grid">
            <article><span>参加赛事</span><strong>{detail.eventCount} 站</strong></article>
            <article><span>最好成绩</span><strong>{value(detail.bestResult)}</strong></article>
            <article><span>累计奖金</span><strong>{money(detail.totalPrizeCents)}</strong></article>
            <article><span>累计积分</span><strong>{detail.totalPoints}</strong></article>
          </section>
          <section className="points-history"><h4>参赛赛事</h4>
            {detail.events.length ? <div className="points-history-table"><div className="head"><span>赛事</span><span>组别</span><span>排名成绩</span><span>奖金</span><span>积分</span></div>{detail.events.map((item) => <div key={`${item.eventId}-${item.groupName}`}><span><b>{item.eventTitle}</b><small>{item.startDate}</small></span><span>{item.groupName}</span><span>{item.placementLabel || "暂无排名"}</span><span>{money(item.prizeCents)}</span><span><b>{item.points}</b></span></div>)}</div> : <p>暂无参赛记录。</p>}
          </section>
        </>}
      {loading && detail && <div className="points-detail-refreshing">正在刷新积分详情…</div>}
    </section>
  </div>;
}

export function PointsRankingWorkspace({ viewerRole, events, initialState, initialPageData, initialPlayerId = "", initialSuccess = "", initialError = "" }: {
  viewerRole: string;
  events: EventOption[];
  initialState: PointsState;
  initialPageData: PlayerPointsPageData;
  initialPlayerId?: string;
  initialSuccess?: string;
  initialError?: string;
}) {
  const [state, setState] = useState(initialState);
  const [pageData, setPageData] = useState(initialPageData);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [notice, setNotice] = useState<Notice | null>(() => initialSuccess ? { tone: "success", text: initialSuccess } : initialError ? { tone: "error", text: initialError } : null);
  const [searchText, setSearchText] = useState(initialState.q);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<PlayerPointsDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const listRequestId = useRef(0);
  const detailRequestId = useRef(0);

  useEffect(() => {
    pageCache.set(stateKey(initialState), { data: initialPageData });
  }, [initialState, initialPageData]);

  const totalPages = Math.max(1, Math.ceil(pageData.filteredTotal / pageData.pageSize));
  const currentEvent = events.find((event) => event.id === state.event);
  const selectedSummary = pageData.items.find((item) => item.id === selectedId) || null;

  const loadList = async (next: PointsState, force = false) => {
    const key = stateKey(next);
    const cached = pageCache.get(key);
    const requestId = ++listRequestId.current;
    detailRequestId.current += 1;
    setState(next);
    setSearchText(next.q);
    setListError("");
    setSelectedId("");
    setDetail(null);
    setDetailError("");
    replaceUrl(next);
    if (cached && !force) {
      setPageData(cached.data);
      setListLoading(false);
      return;
    }
    setListLoading(true);
    try {
      const response = await fetch(listApiHref(next), { cache: "no-store" });
      const payload = await response.json() as { data?: PlayerPointsPageData; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || "积分排名读取失败。");
      pageCache.set(key, { data: payload.data });
      if (requestId !== listRequestId.current) return;
      setPageData(payload.data);
    } catch (requestError) {
      if (requestId !== listRequestId.current) return;
      setListError(requestError instanceof Error ? requestError.message : "积分排名读取失败。");
    } finally {
      if (requestId === listRequestId.current) setListLoading(false);
    }
  };

  const loadDetail = async (playerId: string, force = false) => {
    if (!playerId) return;
    const requestId = ++detailRequestId.current;
    const cacheKey = `${state.scope}|${state.event}|${playerId}`;
    setSelectedId(playerId);
    setDetailError("");
    replaceUrl(state, playerId);
    const cached = detailCache.get(cacheKey);
    if (cached && !force) {
      setDetail(cached.data);
      setDetailLoading(false);
      return;
    }
    setDetail(cached?.data || null);
    setDetailLoading(true);
    try {
      let request = !force ? detailRequests.get(cacheKey) : undefined;
      if (!request) {
        request = fetch(detailApiHref(state, playerId), { cache: "no-store" }).then(async (response) => {
          const payload = await response.json() as { data?: PlayerPointsDetail; error?: string };
          if (!response.ok || !payload.data) throw new Error(payload.error || "积分详情读取失败。");
          return payload.data;
        });
        if (!force) detailRequests.set(cacheKey, request);
      }
      const data = await request;
      detailCache.set(cacheKey, { data });
      if (requestId !== detailRequestId.current) return;
      setDetail(data);
    } catch (requestError) {
      if (requestId !== detailRequestId.current) return;
      setDetailError(requestError instanceof Error ? requestError.message : "积分详情读取失败。");
    } finally {
      detailRequests.delete(cacheKey);
      if (requestId === detailRequestId.current) setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (!initialPlayerId) return;
    const timer = window.setTimeout(() => { void loadDetail(initialPlayerId); }, 0);
    return () => window.clearTimeout(timer);
    // Direct-link detail hydration only runs on the first mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void loadList({ ...state, q: searchText.trim(), page: 1 });
  };
  const closeDetail = () => {
    detailRequestId.current += 1;
    setSelectedId("");
    setDetail(null);
    setDetailError("");
    setDetailLoading(false);
    replaceUrl(state);
  };
  const onRuleSaved = async () => {
    pageCache.clear();
    detailCache.clear();
    detailRequests.clear();
    await loadList(state, true);
    setNotice({ tone: "success", text: "积分规则已保存，当前赛季全部积分与排名已按新规则重新计算。" });
  };
  const ruleDescription = `E级赛事5万元以上档：奖金÷${pageData.rule.prizeUnitYuan}×${pageData.rule.prizePointsPerUnit}；每站参赛分 +${pageData.rule.participationPoints}`;

  return <main className="points-admin">
    <section className="points-admin-head">
      <div><small>PLAYER POINTS</small><h2>积分排名</h2><p>{pageData.year} 赛季 · {ruleDescription}。当前报名费 100 元，对应每站 1 分参赛分。</p></div>
      {viewerRole === "system_admin" && <RuleDialog rule={pageData.rule} onSaved={onRuleSaved} />}
    </section>

    {notice && <div className={`points-notice ${notice.tone}`}>{notice.text}<button type="button" onClick={() => setNotice(null)}>×</button></div>}
    {listError && <div className="points-notice error">{listError}</div>}

    <nav className="points-event-tabs" aria-label="积分总览与分站切换">
      {viewerRole === "system_admin" && <button type="button" className={state.scope === "all" ? "active" : ""} onClick={() => { if (state.scope !== "all") void loadList({ ...state, scope: "all", event: "", page: 1 }); }}>积分总览</button>}
      {events.map((item) => <button type="button" key={item.id} className={state.scope === "event" && state.event === item.id ? "active" : ""} onClick={() => { if (state.scope !== "event" || state.event !== item.id) void loadList({ ...state, scope: "event", event: item.id, page: 1 }); }}>第{item.stationNo}站 · {item.city}</button>)}
    </nav>

    <section className="points-list-card">
      <div className="points-list-toolbar">
        <nav className="points-group-tabs" aria-label="组别筛选">
          {(["all", "少年组", "青年组"] as const).map((group) => <button type="button" key={group} className={state.group === group ? "active" : ""} onClick={() => { if (state.group !== group) void loadList({ ...state, group, page: 1 }); }}>{group === "all" ? "全部球员" : group}</button>)}
        </nav>
        <form className="points-search" onSubmit={submitSearch}><input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="搜索球员姓名 / 球员编号" /><button type="submit" disabled={listLoading && searchText.trim() === state.q}>搜索</button>{state.q && <button type="button" className="clear" onClick={() => { setSearchText(""); void loadList({ ...state, q: "", page: 1 }); }}>清除</button>}</form>
      </div>
      <div className="points-list-meta"><span>{state.q ? "搜索结果" : state.scope === "all" ? "积分总览" : currentEvent?.shortTitle} · 共 <b>{pageData.filteredTotal}</b> 人</span><small>{listLoading ? "正在更新…" : `每页 ${pageData.pageSize} 人 · 已读取结果保留在当前会话`}</small></div>
      <div className={listLoading ? "points-table-wrap refreshing" : "points-table-wrap"}><table className="points-table"><thead><tr><th>序号</th><th>排名</th><th>球员姓名</th><th>组别</th><th>参加赛事</th><th>奖金</th><th>积分</th><th>查看</th></tr></thead><tbody>
        {pageData.items.map((player, index) => <tr key={player.id}><td>{(state.page - 1) * pageData.pageSize + index + 1}</td><td><b className="points-rank">{player.rank}</b></td><td><strong>{player.displayName}</strong></td><td>{value(player.groupName)}</td><td>{player.eventCount} 站</td><td>{money(player.prizeCents)}</td><td><b className="points-value">{player.points}</b></td><td><button type="button" className="points-open" disabled={listLoading} onClick={() => { void loadDetail(player.id); }}>查看</button></td></tr>)}
        {!pageData.items.length && <tr><td colSpan={8}><div className="points-empty">没有找到符合当前条件的积分记录。</div></td></tr>}
      </tbody></table></div>
      {totalPages > 1 && <nav className="points-pagination" aria-label="积分排名分页"><button type="button" disabled={state.page <= 1 || listLoading} onClick={() => { void loadList({ ...state, page: Math.max(1, state.page - 1) }); }}>上一页</button><span>第 {Math.min(state.page, totalPages)} / {totalPages} 页</span><button type="button" disabled={state.page >= totalPages || listLoading} onClick={() => { void loadList({ ...state, page: Math.min(totalPages, state.page + 1) }); }}>下一页</button></nav>}
    </section>

    {selectedId && <DetailFrame summary={selectedSummary} detail={detail} loading={detailLoading} error={detailError} onClose={closeDetail} onRetry={() => { void loadDetail(selectedId, true); }} />}
  </main>;
}
