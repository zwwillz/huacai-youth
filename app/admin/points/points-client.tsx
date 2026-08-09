"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { PlayerPointsDetail, PlayerPointsListItem, PlayerPointsPageData, PlayerPointsRule } from "@/db/player-points";
import { updatePointsRuleAction } from "./actions";

type PointsState = { event: string; scope: "event" | "all"; group: "all" | "少年组" | "青年组"; q: string; page: number };
type EventOption = { id: string; shortTitle: string; stationNo: number; status: string; startDate: string; endDate: string; city: string };
type CachedPage = { data: PlayerPointsPageData; at: number };
type CachedDetail = { data: PlayerPointsDetail; at: number };

const CACHE_TTL = 60_000;
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
  if (typeof window !== "undefined") window.history.replaceState(window.history.state, "", hrefFor(state, playerId));
}
function money(cents: number) {
  return new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 0 }).format(cents / 100);
}
function value(input: string | null | undefined) { return input || "—"; }

function RuleDialog({ rule }: { rule: PlayerPointsRule }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className="points-rule-button" onClick={() => setOpen(true)}>积分规则设置</button>
    {open && <div className="points-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="points-rule-modal" role="dialog" aria-modal="true" aria-label="积分规则设置">
        <header><div><small>POINTS RULE</small><h3>{rule.year} 赛季积分规则</h3><p>积分由有效参赛和已发布奖金自动计算。修改规则后，本赛季积分排名会即时重新计算。</p></div><button type="button" aria-label="关闭积分规则" onClick={() => setOpen(false)}>×</button></header>
        <form action={updatePointsRuleAction} className="points-rule-form">
          <input type="hidden" name="year" value={rule.year} />
          <label><span>每参加 1 站赛事</span><div><input type="number" name="participationPoints" min="0" step="1" defaultValue={rule.participationPoints} required /><em>积分</em></div></label>
          <label><span>每满多少元奖金</span><div><input type="number" name="prizeUnitYuan" min="1" step="1" defaultValue={rule.prizeUnitYuan} required /><em>元</em></div></label>
          <label><span>对应增加积分</span><div><input type="number" name="prizePointsPerUnit" min="0" step="1" defaultValue={rule.prizePointsPerUnit} required /><em>积分</em></div></label>
          <p className="points-rule-formula">当前规则：每站 +{rule.participationPoints} 分；奖金每满 {rule.prizeUnitYuan} 元 +{rule.prizePointsPerUnit} 分。</p>
          <div className="points-rule-actions"><button type="button" className="secondary" onClick={() => setOpen(false)}>取消</button><button type="submit">保存规则</button></div>
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
            {detail.events.length ? <div className="points-history-table"><div className="head"><span>赛事</span><span>组别</span><span>排名成绩</span><span>奖金</span><span>积分</span></div>{detail.events.map((event) => <div key={`${event.eventId}-${event.groupName}`}><span><b>{event.eventTitle}</b><small>{event.startDate}</small></span><span>{event.groupName}</span><span>{event.placementLabel || "暂无排名"}</span><span>{money(event.prizeCents)}</span><span><b>{event.points}</b></span></div>)}</div> : <p>暂无参赛记录。</p>}
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
  const [searchText, setSearchText] = useState(initialState.q);
  const [selectedId, setSelectedId] = useState(initialPlayerId);
  const [detail, setDetail] = useState<PlayerPointsDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const requestId = useRef(0);

  useEffect(() => {
    pageCache.set(stateKey(initialState), { data: initialPageData, at: Date.now() });
  }, [initialState, initialPageData]);

  const totalPages = Math.max(1, Math.ceil(pageData.filteredTotal / pageData.pageSize));
  const currentEvent = events.find((event) => event.id === state.event);
  const selectedSummary = pageData.items.find((item) => item.id === selectedId) || null;

  const loadList = async (next: PointsState) => {
    const key = stateKey(next);
    const cached = pageCache.get(key);
    setState(next);
    setSearchText(next.q);
    setListError("");
    replaceUrl(next);
    if (cached && Date.now() - cached.at < CACHE_TTL) {
      setPageData(cached.data);
      setListLoading(false);
      return;
    }
    const id = ++requestId.current;
    setListLoading(true);
    try {
      const response = await fetch(listApiHref(next), { cache: "no-store" });
      const payload = await response.json() as { data?: PlayerPointsPageData; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || "积分排名读取失败。");
      if (id !== requestId.current) return;
      pageCache.set(key, { data: payload.data, at: Date.now() });
      setPageData(payload.data);
    } catch (error) {
      if (id === requestId.current) setListError(error instanceof Error ? error.message : "积分排名读取失败。");
    } finally {
      if (id === requestId.current) setListLoading(false);
    }
  };

  const loadDetail = async (playerId: string, force = false) => {
    const cacheKey = `${state.scope}|${state.event}|${playerId}`;
    setSelectedId(playerId);
    setDetailError("");
    replaceUrl(state, playerId);
    const cached = detailCache.get(cacheKey);
    if (!force && cached && Date.now() - cached.at < CACHE_TTL) {
      setDetail(cached.data);
      setDetailLoading(false);
      return;
    }
    setDetail(cached?.data || null);
    setDetailLoading(true);
    try {
      let request = detailRequests.get(cacheKey);
      if (!request || force) {
        request = fetch(detailApiHref(state, playerId), { cache: "no-store" }).then(async (response) => {
          const payload = await response.json() as { data?: PlayerPointsDetail; error?: string };
          if (!response.ok || !payload.data) throw new Error(payload.error || "积分详情读取失败。");
          return payload.data;
        });
        detailRequests.set(cacheKey, request);
      }
      const data = await request;
      detailCache.set(cacheKey, { data, at: Date.now() });
      setDetail(data);
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "积分详情读取失败。");
    } finally {
      detailRequests.delete(cacheKey);
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (initialPlayerId) void loadDetail(initialPlayerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchScope = (scope: "all" | "event", event = "") => {
    setSelectedId(""); setDetail(null);
    void loadList({ ...state, scope, event: scope === "all" ? "" : event, page: 1 });
  };
  const switchGroup = (group: PointsState["group"]) => {
    setSelectedId(""); setDetail(null);
    void loadList({ ...state, group, page: 1 });
  };
  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setSelectedId(""); setDetail(null);
    void loadList({ ...state, q: searchText.trim(), page: 1 });
  };
  const clearSearch = () => {
    setSearchText("");
    void loadList({ ...state, q: "", page: 1 });
  };
  const closeDetail = () => {
    setSelectedId(""); setDetail(null); setDetailError("");
    replaceUrl(state);
  };

  const ruleDescription = useMemo(() => `每站 +${pageData.rule.participationPoints} 分 · 每 ${pageData.rule.prizeUnitYuan} 元奖金 +${pageData.rule.prizePointsPerUnit} 分`, [pageData.rule]);

  return <main className="points-admin">
    <section className="points-admin-head">
      <div><small>PLAYER POINTS</small><h2>积分排名</h2><p>{pageData.year} 赛季 · {ruleDescription}。总览汇总本赛季有效参赛和已发布奖金，分站只统计该站。</p></div>
      {viewerRole === "system_admin" && <RuleDialog rule={pageData.rule} />}
    </section>

    {initialSuccess && <div className="points-notice success">{initialSuccess}</div>}
    {initialError && <div className="points-notice error">{initialError}</div>}
    {listError && <div className="points-notice error">{listError}</div>}

    <nav className="points-event-tabs" aria-label="积分总览与分站切换">
      {viewerRole === "system_admin" && <button type="button" className={state.scope === "all" ? "active" : ""} onClick={() => switchScope("all")}>积分总览</button>}
      {events.map((event) => <button type="button" key={event.id} className={state.scope === "event" && state.event === event.id ? "active" : ""} onClick={() => switchScope("event", event.id)}>第{event.stationNo}站 · {event.city}</button>)}
    </nav>

    <section className="points-list-card">
      <div className="points-list-toolbar">
        <nav className="points-group-tabs" aria-label="组别筛选">
          {(["all", "少年组", "青年组"] as const).map((group) => <button type="button" key={group} className={state.group === group ? "active" : ""} onClick={() => switchGroup(group)}>{group === "all" ? "全部球员" : group}</button>)}
        </nav>
        <form className="points-search" onSubmit={submitSearch}><input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="搜索球员姓名 / 球员编号" /><button type="submit">搜索</button>{state.q && <button type="button" className="clear" onClick={clearSearch}>清除</button>}</form>
      </div>
      <div className="points-list-meta"><span>{state.q ? "搜索结果" : state.scope === "all" ? "积分总览" : currentEvent?.shortTitle} · 共 <b>{pageData.filteredTotal}</b> 人</span><small>{listLoading ? "正在更新…" : `每页 ${pageData.pageSize} 人`}</small></div>
      <div className={listLoading ? "points-table-wrap refreshing" : "points-table-wrap"}><table className="points-table"><thead><tr><th>序号</th><th>排名</th><th>球员姓名</th><th>组别</th><th>参加赛事</th><th>奖金</th><th>积分</th><th>查看</th></tr></thead><tbody>
        {pageData.items.map((player, index) => <tr key={player.id}><td>{(state.page - 1) * pageData.pageSize + index + 1}</td><td><b className="points-rank">{player.rank}</b></td><td><strong>{player.displayName}</strong></td><td>{value(player.groupName)}</td><td>{player.eventCount} 站</td><td>{money(player.prizeCents)}</td><td><b className="points-value">{player.points}</b></td><td><button type="button" className="points-open" onClick={() => void loadDetail(player.id)}>查看</button></td></tr>)}
        {!pageData.items.length && <tr><td colSpan={8}><div className="points-empty">没有找到符合当前条件的积分记录。</div></td></tr>}
      </tbody></table></div>
      {totalPages > 1 && <nav className="points-pagination" aria-label="积分排名分页"><button type="button" disabled={state.page <= 1 || listLoading} onClick={() => void loadList({ ...state, page: Math.max(1, state.page - 1) })}>上一页</button><span>第 {Math.min(state.page, totalPages)} / {totalPages} 页</span><button type="button" disabled={state.page >= totalPages || listLoading} onClick={() => void loadList({ ...state, page: Math.min(totalPages, state.page + 1) })}>下一页</button></nav>}
    </section>

    {selectedId && <DetailFrame summary={selectedSummary} detail={detail} loading={detailLoading} error={detailError} onClose={closeDetail} onRetry={() => void loadDetail(selectedId, true)} />}
  </main>;
}
