"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ScoringMatch, ScoringWorkspaceData } from "@/db/scoring-engine";

type Props = { initialData: ScoringWorkspaceData };
type Draft = { scoreA: string; scoreB: string; resultType: string; note: string };

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

export default function ScoringWorkbenchClient({ initialData }: Props) {
  const router = useRouter();
  const [matches, setMatches] = useState(initialData.matches);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => Object.fromEntries(initialData.matches.map((match) => [match.assignmentId, makeDraft(match)])));
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return matches;
    return matches.filter((match) => `${match.matchCode} ${match.playerAName || ""} ${match.playerBName || ""} ${match.tableName || ""}`.toLowerCase().includes(keyword));
  }, [matches, query]);

  function pageUrl(patch: { date?: string; view?: string | null }) {
    const params = new URLSearchParams();
    params.set("event", initialData.event.id);
    params.set("group", initialData.filters.groupId);
    params.set("phase", initialData.filters.phaseCode);
    params.set("date", patch.date ?? initialData.filters.date);
    const view = patch.view === undefined ? (initialData.filters.showConfirmed ? "all" : "") : (patch.view || "");
    if (view) params.set("view", view);
    return `/admin/competition/scoring?${params.toString()}`;
  }

  async function reload() {
    const params = new URLSearchParams({ eventId: initialData.event.id, group: initialData.filters.groupId, phase: initialData.filters.phaseCode, date: initialData.filters.date });
    if (initialData.filters.showConfirmed) params.set("view", "all");
    const response = await fetch(`/api/admin/competition/scoring?${params.toString()}`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "刷新失败。");
    const next = result.data as ScoringWorkspaceData;
    setMatches(next.matches);
    setDrafts((current) => Object.fromEntries(next.matches.map((match) => [match.assignmentId, current[match.assignmentId] ?? makeDraft(match)])));
  }

  async function post(body: Record<string, unknown>, assignmentId: string) {
    setBusyId(assignmentId); setMessage("");
    try {
      const response = await fetch("/api/admin/competition/scoring", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "操作失败。");
      await reload();
      router.refresh();
      return true;
    } catch (error) { setMessage(error instanceof Error ? error.message : "操作失败。"); return false; }
    finally { setBusyId(""); }
  }

  async function submit(match: ScoringMatch) {
    const draft = drafts[match.assignmentId] ?? makeDraft(match);
    if (!window.confirm(`确认提交这场赛果？\n${match.playerAName || "A方"} ${draft.scoreA || "-"} : ${draft.scoreB || "-"} ${match.playerBName || "B方"}`)) return;
    const ok = await post({ action: "submit", assignmentId: match.assignmentId, ...draft }, match.assignmentId);
    if (ok) setMessage("赛果已保存并提交，等待组委会确认；尚未发布到用户端。" );
  }
  async function confirm(match: ScoringMatch) {
    if (!window.confirm(`确认这场赛果并推动晋级关系？\n\n确认后该场会从默认待办列表消失；对用户端的显示仍需点击上方“发布到用户端”。`)) return;
    const ok = await post({ action: "confirm", assignmentId: match.assignmentId }, match.assignmentId);
    if (ok) setMessage("赛果已正式确认并推动后续签表。对阵与比分已进入“待发布”状态。" );
  }

  const canConfirm = initialData.viewer.role === "system_admin" || initialData.viewer.role === "committee";
  return <main className="scoring-workbench">
    <section className="scoring-taskbar">
      <div className="scoring-task-summary"><div><small>当前待处理</small><strong>{initialData.counts.actionable}</strong><span>场</span></div><div><small>等待确认</small><strong>{initialData.counts.submitted}</strong><span>场</span></div><div><small>本日已确认</small><strong>{initialData.counts.confirmed}</strong><span>场</span></div></div>
      <div className="scoring-view-actions"><button type="button" className={initialData.filters.showConfirmed ? "active" : ""} onClick={() => router.push(pageUrl({ view: initialData.filters.showConfirmed ? null : "all" }))}>{initialData.filters.showConfirmed ? "隐藏已确认" : "查看已确认"}</button><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索球员或台号" /></div>
    </section>

    {initialData.dates.length > 0 && <nav className="scoring-date-tabs">{initialData.dates.map((date) => <button type="button" key={date.value} className={date.value === initialData.filters.date ? "active" : ""} onClick={() => router.push(pageUrl({ date: date.value }))}><strong>{dateLabel(date.value)}</strong><small>{date.actionableCount > 0 ? `${date.actionableCount}场待处理` : `${date.confirmedCount}场已确认`}</small></button>)}</nav>}
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
    {!filtered.length && <section className="scoring-empty"><strong>{initialData.counts.confirmed > 0 && !initialData.filters.showConfirmed ? "当前日期没有待处理比赛" : "当前阶段还没有可录入的比赛"}</strong><p>{initialData.counts.confirmed > 0 && !initialData.filters.showConfirmed ? "已确认场次默认自动收起；需要复核时点击“查看已确认”。" : "可能还未排赛程，或上一轮赛果尚未产生下一场对阵。"}</p></section>}
  </main>;
}
