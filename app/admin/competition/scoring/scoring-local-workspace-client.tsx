"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CompetitionContextData } from "@/db/competition-context";
import type { ScoringMatch, ScoringWorkspaceData } from "@/db/scoring-engine";
import { useAdminActionDialog } from "../../admin-action-dialog";
import CompetitionContextBar from "../competition-context-bar";
import CompetitionPublicationBar from "../competition-publication-bar";

type Draft = { scoreA: string; scoreB: string; resultType: string; note: string };
const ALL_PHASES = [
  { code: "qualifier-one", title: "资格赛第一场" },
  { code: "qualifier-two", title: "资格赛第二场" },
  { code: "main-one", title: "正赛第一阶段" },
  { code: "main-two", title: "正赛第二阶段" },
];
const CACHE_TTL = 15_000;
const dataCache = new Map<string, { data: ScoringWorkspaceData; at: number }>();
const eventCache = new Map<string, { data: ScoringWorkspaceData; context: CompetitionContextData; at: number }>();

function resultStatusLabel(status: string) {
  if (status === "submitted") return "待组委会确认";
  if (status === "confirmed") return "已确认";
  return "待录入";
}
function makeDraft(match: ScoringMatch): Draft { return { scoreA: match.scoreA === null ? "" : String(match.scoreA), scoreB: match.scoreB === null ? "" : String(match.scoreB), resultType: match.resultType || "normal", note: "" }; }
function dateLabel(value: string) {
  if (value === "__unscheduled__") return "未排期";
  const [, month, day] = value.split("-");
  if (!month || !day) return value;
  const weekday = ["日","一","二","三","四","五","六"][new Date(`${value}T12:00:00+08:00`).getDay()];
  return `${Number(month)}月${Number(day)}日 · 周${weekday}`;
}
function cacheKey(eventId: string, groupId: string, phase: string, date: string, showConfirmed: boolean) {
  return [eventId, groupId, phase, date, showConfirmed ? "all" : "todo"].join("|");
}
function replaceUrl(data: ScoringWorkspaceData) {
  const params = new URLSearchParams({ event: data.event.id });
  if (data.filters.groupId) params.set("group", data.filters.groupId);
  if (data.filters.phaseCode) params.set("phase", data.filters.phaseCode);
  if (data.filters.date) params.set("date", data.filters.date);
  if (data.filters.showConfirmed) params.set("view", "all");
  window.history.replaceState(window.history.state, "", `/admin/competition/scoring?${params.toString()}`);
}
function clearEventCache(eventId: string) {
  for (const key of dataCache.keys()) if (key.startsWith(`${eventId}|`)) dataCache.delete(key);
  eventCache.delete(eventId);
}

export default function ScoringLocalWorkspaceClient({ initialData, initialContext }: { initialData: ScoringWorkspaceData; initialContext: CompetitionContextData }) {
  const [data, setData] = useState(initialData);
  const [context, setContext] = useState(initialContext);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => Object.fromEntries(initialData.matches.map((match) => [match.assignmentId, makeDraft(match)])));
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState(initialData.filters.groupId);
  const [selectedPhase, setSelectedPhase] = useState(initialData.filters.phaseCode);
  const [dirtyEvents, setDirtyEvents] = useState<Set<string>>(() => new Set());
  const requestId = useRef(0);
  const { ask, dialog } = useAdminActionDialog();

  const applyData = (next: ScoringWorkspaceData) => {
    setData(next);
    setSelectedGroupId(next.filters.groupId);
    setSelectedPhase(next.filters.phaseCode);
    setDrafts((current) => Object.fromEntries(next.matches.map((match) => [match.assignmentId, current[match.assignmentId] ?? makeDraft(match)])));
    replaceUrl(next);
  };

  useEffect(() => {
    const key = cacheKey(initialData.event.id, initialData.filters.groupId, initialData.filters.phaseCode, initialData.filters.date, initialData.filters.showConfirmed);
    dataCache.set(key, { data: initialData, at: Date.now() });
    eventCache.set(initialData.event.id, { data: initialData, context: initialContext, at: Date.now() });
  }, [initialContext, initialData]);

  const fetchWorkspace = async (input: { eventId: string; groupId?: string; phase?: string; date?: string; showConfirmed?: boolean; includeContext?: boolean; force?: boolean }) => {
    const eventId = input.eventId;
    const groupId = input.groupId ?? data.filters.groupId;
    const phase = input.phase ?? data.filters.phaseCode;
    const date = input.date ?? data.filters.date;
    const showConfirmed = input.showConfirmed ?? data.filters.showConfirmed;
    const key = cacheKey(eventId, groupId, phase, date, showConfirmed);
    const currentRequest = ++requestId.current;
    const cached = !input.force ? dataCache.get(key) : undefined;
    setLoadError("");
    if (cached) {
      applyData(cached.data);
      if (Date.now() - cached.at < CACHE_TTL && !input.includeContext) { setLoading(false); return cached.data; }
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ eventId });
      if (groupId) params.set("group", groupId);
      if (phase) params.set("phase", phase);
      if (date) params.set("date", date);
      if (showConfirmed) params.set("view", "all");
      if (input.includeContext) params.set("context", "1");
      const response = await fetch(`/api/admin/competition/scoring?${params.toString()}`, { cache: "no-store" });
      const payload = await response.json() as { data?: ScoringWorkspaceData; context?: CompetitionContextData; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || "比分数据读取失败。");
      if (currentRequest !== requestId.current) return null;
      const nextKey = cacheKey(payload.data.event.id, payload.data.filters.groupId, payload.data.filters.phaseCode, payload.data.filters.date, payload.data.filters.showConfirmed);
      dataCache.set(nextKey, { data: payload.data, at: Date.now() });
      if (payload.context) {
        setContext(payload.context);
        eventCache.set(eventId, { data: payload.data, context: payload.context, at: Date.now() });
      }
      applyData(payload.data);
      return payload.data;
    } catch (failure) {
      if (currentRequest === requestId.current) setLoadError(failure instanceof Error ? failure.message : "比分数据读取失败。");
      throw failure;
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  };

  useEffect(() => {
    const onSwitch = (event: Event) => {
      const detail = (event as CustomEvent<{ eventId?: string; previousEventId?: string; active?: string; competitionTool?: string }>).detail;
      if (detail?.active !== "competition" || detail.competitionTool !== "scoring" || !detail.eventId || detail.eventId === data.event.id) return;
      const eventId = detail.eventId;
      const previousEventId = detail.previousEventId || data.event.id;
      const cached = eventCache.get(eventId);
      if (cached && Date.now() - cached.at < CACHE_TTL) {
        setContext(cached.context);
        applyData(cached.data);
        setLoading(false);
        return;
      }
      void fetchWorkspace({ eventId, groupId: "", phase: "", date: "", showConfirmed: false, includeContext: true, force: true }).catch(() => {
        window.dispatchEvent(new CustomEvent("admin:event-switch-revert", { detail: { eventId: previousEventId } }));
      });
    };
    window.addEventListener("admin:event-switch", onSwitch);
    return () => window.removeEventListener("admin:event-switch", onSwitch);
    // Event changes provide all scoring filters explicitly; rebind only when the displayed event changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.event.id]);

  const chooseGroup = (groupId: string) => {
    if (groupId === selectedGroupId || loading) return;
    void fetchWorkspace({ eventId: data.event.id, groupId, phase: selectedPhase, date: "", showConfirmed: data.filters.showConfirmed }).catch(() => undefined);
  };
  const choosePhase = (phase: string) => {
    if (phase === selectedPhase || loading) return;
    const stat = data.phases.find((item) => item.code === phase);
    if (!stat) {
      const waiting: ScoringWorkspaceData = { ...data, filters: { ...data.filters, phaseCode: phase, date: "" }, dates: [], matches: [], counts: { actionable: 0, submitted: 0, confirmed: 0, visible: 0 } };
      applyData(waiting);
      return;
    }
    void fetchWorkspace({ eventId: data.event.id, groupId: selectedGroupId, phase, date: "", showConfirmed: data.filters.showConfirmed }).catch(() => undefined);
  };
  const chooseDate = (date: string) => { if (date !== data.filters.date && !loading) void fetchWorkspace({ eventId: data.event.id, groupId: selectedGroupId, phase: selectedPhase, date, showConfirmed: data.filters.showConfirmed }).catch(() => undefined); };
  const toggleConfirmed = () => { if (!loading) void fetchWorkspace({ eventId: data.event.id, groupId: selectedGroupId, phase: selectedPhase, date: data.filters.date, showConfirmed: !data.filters.showConfirmed }).catch(() => undefined); };

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return data.matches;
    return data.matches.filter((match) => `${match.matchCode} ${match.playerAName || ""} ${match.playerBName || ""} ${match.tableName || ""}`.toLowerCase().includes(keyword));
  }, [data.matches, query]);

  async function post(body: Record<string, unknown>, assignmentId: string) {
    setBusyId(assignmentId); setMessage("");
    try {
      const response = await fetch("/api/admin/competition/scoring", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "操作失败。");
      clearEventCache(data.event.id);
      setDirtyEvents((current) => {
        const next = new Set(current);
        next.add(data.event.id);
        return next;
      });
      await fetchWorkspace({ eventId: data.event.id, groupId: selectedGroupId, phase: selectedPhase, date: data.filters.date, showConfirmed: data.filters.showConfirmed, force: true });
      return true;
    } catch (error) { setMessage(error instanceof Error ? error.message : "操作失败。"); return false; }
    finally { setBusyId(""); }
  }

  async function submit(match: ScoringMatch) {
    const draft = drafts[match.assignmentId] ?? makeDraft(match);
    const confirmed = await ask({ title: "提交这场赛果", description: `${match.playerAName || "A方"} ${draft.scoreA || "-"} : ${draft.scoreB || "-"} ${match.playerBName || "B方"}`, confirmLabel: "确认提交" });
    if (!confirmed) return;
    const ok = await post({ action: "submit", assignmentId: match.assignmentId, ...draft }, match.assignmentId);
    if (ok) setMessage("赛果已保存并提交，等待组委会确认；尚未发布到用户端。" );
  }
  async function confirm(match: ScoringMatch) {
    const confirmed = await ask({ title: "确认赛果并推动晋级关系", description: "确认后该场会从默认待办列表消失；对用户端的显示仍需点击上方“发布到用户端”。", confirmLabel: "确认赛果" });
    if (!confirmed) return;
    const ok = await post({ action: "confirm", assignmentId: match.assignmentId }, match.assignmentId);
    if (ok) setMessage("赛果已正式确认并推动后续签表。对阵与比分已进入“待发布”状态。" );
  }

  const statMap = new Map(data.phases.map((phase) => [phase.code, phase]));
  const phaseOptions = ALL_PHASES.map((phase) => {
    const stat = statMap.get(phase.code);
    return { ...phase, hint: stat ? (stat.actionableCount ? `${stat.actionableCount}场待处理` : `${stat.confirmedCount}场已确认`) : "等待赛程" };
  });
  const selectedPhaseTitle = ALL_PHASES.find((phase) => phase.code === selectedPhase)?.title || "当前阶段";
  const canConfirm = data.viewer.role === "system_admin" || data.viewer.role === "committee";
  const publicationDirty = dirtyEvents.has(data.event.id);

  return <div className={loading ? "admin-local-workspace is-refreshing" : "admin-local-workspace"}>
    {loading && <div className="admin-local-refresh"><i />正在更新比分工作区…</div>}
    {loadError && <div className="admin-local-error">{loadError}</div>}
    <CompetitionContextBar eventId={data.event.id} eventTitle={data.event.shortTitle} groups={context.groups} selectedGroupId={selectedGroupId} basePath="/admin/competition/scoring" phases={phaseOptions} selectedPhase={selectedPhase} eyebrow="比分录入" title={`${context.groups.find((group) => group.id === selectedGroupId)?.name || "当前组别"} · ${selectedPhaseTitle}`} description="组别、阶段、日期和已确认视图都在当前工作区内切换；旧列表会保留到新数据返回，并保持原标签避免误读。" onGroupChange={chooseGroup} onPhaseChange={choosePhase} />
    <CompetitionPublicationBar eventId={data.event.id} moduleType="matches" title="对阵与比分" status={context.publications.matches.status} hasUnpublishedChanges={context.publications.matches.hasUnpublishedChanges || publicationDirty} viewerRole={data.viewer.role} hint="比分确认后先进入后台未发布更新。用户端仍保持上一版已发布比分；点击“发布更新”后才整体切换。" onChanged={(status, dirty) => {
      setDirtyEvents((current) => {
        const next = new Set(current);
        if (!dirty) next.delete(data.event.id);
        else next.add(data.event.id);
        return next;
      });
      setContext((current) => ({ ...current, publications: { ...current.publications, matches: { ...current.publications.matches, status, hasUnpublishedChanges: dirty } } }));
    }} />

    <main className={loading ? "scoring-workbench admin-local-stale" : "scoring-workbench"}>
      <section className="scoring-taskbar">
        <div className="scoring-task-summary"><div><small>当前待处理</small><strong>{data.counts.actionable}</strong><span>场</span></div><div><small>等待确认</small><strong>{data.counts.submitted}</strong><span>场</span></div><div><small>本日已确认</small><strong>{data.counts.confirmed}</strong><span>场</span></div></div>
        <div className="scoring-view-actions"><button type="button" className={data.filters.showConfirmed ? "active" : ""} disabled={loading} onClick={toggleConfirmed}>{data.filters.showConfirmed ? "隐藏已确认" : "查看已确认"}</button><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索球员或台号" /></div>
      </section>

      {data.dates.length > 0 && <nav className="scoring-date-tabs">{data.dates.map((date) => <button type="button" key={date.value} className={date.value === data.filters.date ? "active" : ""} disabled={loading} onClick={() => chooseDate(date.value)}><strong>{dateLabel(date.value)}</strong><small>{date.actionableCount > 0 ? `${date.actionableCount}场待处理` : `${date.confirmedCount}场已确认`}</small></button>)}</nav>}
      {message && <p className="scoring-message">{message}</p>}

      <section className="scoring-list">{filtered.map((match) => {
        const draft = drafts[match.assignmentId] ?? makeDraft(match);
        const locked = match.resultStatus === "confirmed";
        return <article className={`scoring-card ${match.resultStatus}`} key={match.assignmentId}>
          <header><div><b>{match.roundName}</b><span>{match.matchCode}</span></div><em>{resultStatusLabel(match.resultStatus)}</em></header>
          <div className="scoring-meta"><span>{match.matchDate ? dateLabel(match.matchDate) : "未排期"} {match.startTime || ""}</span><strong>{match.tableName || "待定球台"}</strong>{match.refereeName && <small>裁判：{match.refereeName}</small>}</div>
          <div className="scoring-versus">
            <div><span>A</span><strong>{match.playerAName || "待产生"}</strong><input type="number" min={0} inputMode="numeric" value={draft.scoreA} disabled={locked || draft.resultType !== "normal"} onChange={(event) => setDrafts((current) => ({ ...current, [match.assignmentId]: { ...draft, scoreA: event.target.value } }))} /></div>
            <i>VS</i>
            <div><span>B</span><strong>{match.playerBName || "待产生"}</strong><input type="number" min={0} inputMode="numeric" value={draft.scoreB} disabled={locked || draft.resultType !== "normal"} onChange={(event) => setDrafts((current) => ({ ...current, [match.assignmentId]: { ...draft, scoreB: event.target.value } }))} /></div>
          </div>
          <div className="scoring-actions-row">
            <select value={draft.resultType} disabled={locked} onChange={(event) => setDrafts((current) => ({ ...current, [match.assignmentId]: { ...draft, resultType: event.target.value } }))}><option value="normal">正常完赛</option><option value="a_forfeit">A方弃权</option><option value="b_forfeit">B方弃权</option><option value="a_no_show">A方未到</option><option value="b_no_show">B方未到</option><option value="a_disqualified">A方判负 / 取消资格</option><option value="b_disqualified">B方判负 / 取消资格</option></select>
            <input value={draft.note} disabled={locked} onChange={(event) => setDrafts((current) => ({ ...current, [match.assignmentId]: { ...draft, note: event.target.value } }))} placeholder="备注（可选）" />
            {match.resultStatus !== "confirmed" && <button type="button" disabled={busyId === match.assignmentId || !match.playerAName || !match.playerBName} onClick={() => submit(match)}>{busyId === match.assignmentId ? "提交中..." : match.resultStatus === "submitted" ? "修改并重新提交" : "提交赛果"}</button>}
            {canConfirm && match.resultStatus === "submitted" && <button className="confirm" type="button" disabled={busyId === match.assignmentId} onClick={() => confirm(match)}>确认赛果</button>}
          </div>
          {locked && <footer>胜者：<strong>{match.winnerPlayerName}</strong> · 已确认</footer>}
        </article>;
      })}</section>
      {!filtered.length && <section className="scoring-empty"><strong>{data.counts.confirmed > 0 && !data.filters.showConfirmed ? "当前日期没有待处理比赛" : "当前阶段还没有可录入的比赛"}</strong><p>{data.counts.confirmed > 0 && !data.filters.showConfirmed ? "已确认场次默认自动收起；需要复核时点击“查看已确认”。" : "可能还未排赛程，或上一轮赛果尚未产生下一场对阵。"}</p></section>}
      {dialog}
    </main>
  </div>;
}
