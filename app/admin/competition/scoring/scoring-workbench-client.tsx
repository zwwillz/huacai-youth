"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ScoringMatch, ScoringWorkspaceData } from "@/db/scoring-engine";

type Props = { initialData: ScoringWorkspaceData };
type Draft = { scoreA: string; scoreB: string; resultType: string; note: string };

function resultStatusLabel(status: string) {
  if (status === "submitted") return "待确认";
  if (status === "confirmed") return "已确认";
  return "待录入";
}

function makeDraft(match: ScoringMatch): Draft {
  return {
    scoreA: match.scoreA === null ? "" : String(match.scoreA),
    scoreB: match.scoreB === null ? "" : String(match.scoreB),
    resultType: match.resultType || "normal",
    note: "",
  };
}

export default function ScoringWorkbenchClient({ initialData }: Props) {
  const router = useRouter();
  const [matches, setMatches] = useState(initialData.matches);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => Object.fromEntries(initialData.matches.map((match) => [match.assignmentId, makeDraft(match)])));
  const [group, setGroup] = useState("all");
  const [phase, setPhase] = useState("all");
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

  const groupOptions = useMemo(() => [...new Map(matches.map((match) => [match.groupId, match.groupName])).entries()], [matches]);
  const phaseOptions = useMemo(() => [...new Map(matches.map((match) => [match.phaseCode, match.phaseTitle])).entries()], [matches]);
  const filtered = useMemo(() => matches.filter((match) => {
    if (group !== "all" && match.groupId !== group) return false;
    if (phase !== "all" && match.phaseCode !== phase) return false;
    if (status !== "all" && match.resultStatus !== status) return false;
    const keyword = query.trim().toLowerCase();
    if (keyword && !`${match.matchCode} ${match.playerAName || ""} ${match.playerBName || ""} ${match.tableName || ""}`.toLowerCase().includes(keyword)) return false;
    return true;
  }), [matches, group, phase, status, query]);

  async function reload() {
    const response = await fetch(`/api/admin/competition/scoring?eventId=${encodeURIComponent(initialData.event.id)}`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "刷新失败。");
    const next = result.data as ScoringWorkspaceData;
    setMatches(next.matches);
    setDrafts((current) => Object.fromEntries(next.matches.map((match) => [match.assignmentId, current[match.assignmentId] ?? makeDraft(match)])));
  }

  async function post(body: Record<string, unknown>, assignmentId: string) {
    setBusyId(assignmentId);
    setMessage("");
    try {
      const response = await fetch("/api/admin/competition/scoring", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "操作失败。");
      await reload();
      router.refresh();
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败。");
      return false;
    } finally {
      setBusyId("");
    }
  }

  async function submit(match: ScoringMatch) {
    const draft = drafts[match.assignmentId] ?? makeDraft(match);
    if (!window.confirm(`确认提交 ${match.matchCode} 的赛果？\n${match.playerAName || "A方"} ${draft.scoreA || "-"} : ${draft.scoreB || "-"} ${match.playerBName || "B方"}`)) return;
    const ok = await post({ action: "submit", assignmentId: match.assignmentId, ...draft }, match.assignmentId);
    if (ok) setMessage("赛果已提交，等待组委会确认。确认后胜者会自动进入下一场。");
  }

  async function confirm(match: ScoringMatch) {
    if (!window.confirm(`确认 ${match.matchCode} 的赛果并推动晋级关系？确认后胜者会自动进入下一场。`)) return;
    const ok = await post({ action: "confirm", assignmentId: match.assignmentId }, match.assignmentId);
    if (ok) setMessage("赛果已正式确认，胜者已自动写入下一场比赛关系。");
  }

  const canConfirm = initialData.viewer.role === "system_admin" || initialData.viewer.role === "committee";

  return <main className="scoring-workbench">
    <section className="scoring-hero">
      <div><small>LIVE MATCH SCORING</small><h2>{initialData.event.shortTitle}</h2><p>{initialData.viewer.role === "referee" ? "这里仅显示分配给你的比赛。提交赛果后由组委会确认。" : "查看全部已排赛程，裁判提交赛果后在这里确认；确认结果会驱动后续比赛关系。"}</p></div>
      <div className="scoring-hero-stat"><strong>{matches.filter((match) => match.resultStatus === "submitted").length}</strong><span>待确认</span></div>
    </section>

    <section className="scoring-filters">
      <select value={group} onChange={(event) => setGroup(event.target.value)}><option value="all">全部组别</option>{groupOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
      <select value={phase} onChange={(event) => setPhase(event.target.value)}><option value="all">全部阶段</option>{phaseOptions.map(([code, title]) => <option key={code} value={code}>{title}</option>)}</select>
      <select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">全部状态</option><option value="pending">待录入</option><option value="submitted">待确认</option><option value="confirmed">已确认</option></select>
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索球员、比赛编号、台号" />
      <span>{filtered.length} 场</span>
    </section>

    {message && <p className="scoring-message">{message}</p>}

    <section className="scoring-list">{filtered.map((match) => {
      const draft = drafts[match.assignmentId] ?? makeDraft(match);
      const locked = match.resultStatus === "confirmed";
      return <article className={`scoring-card ${match.resultStatus}`} key={match.assignmentId}>
        <header><div><b>{match.matchCode}</b><span>{match.groupName} · {match.phaseTitle} · {match.roundName}</span></div><em>{resultStatusLabel(match.resultStatus)}</em></header>
        <div className="scoring-meta"><span>{match.matchDate || "待定日期"} {match.startTime || ""}</span><strong>{match.tableName || "待定球台"}</strong>{match.refereeName && <small>裁判：{match.refereeName}</small>}</div>
        <div className="scoring-versus">
          <div><span>A</span><strong>{match.playerAName || "待产生"}</strong><input type="number" min={0} inputMode="numeric" value={draft.scoreA} disabled={locked || draft.resultType !== "normal"} onChange={(event) => setDrafts((current) => ({ ...current, [match.assignmentId]: { ...draft, scoreA: event.target.value } }))} /></div>
          <i>VS</i>
          <div><span>B</span><strong>{match.playerBName || "待产生"}</strong><input type="number" min={0} inputMode="numeric" value={draft.scoreB} disabled={locked || draft.resultType !== "normal"} onChange={(event) => setDrafts((current) => ({ ...current, [match.assignmentId]: { ...draft, scoreB: event.target.value } }))} /></div>
        </div>
        <div className="scoring-actions-row">
          <select value={draft.resultType} disabled={locked} onChange={(event) => setDrafts((current) => ({ ...current, [match.assignmentId]: { ...draft, resultType: event.target.value } }))}>
            <option value="normal">正常完赛</option><option value="a_forfeit">A方弃权</option><option value="b_forfeit">B方弃权</option><option value="a_no_show">A方未到</option><option value="b_no_show">B方未到</option><option value="a_disqualified">A方判负 / 取消资格</option><option value="b_disqualified">B方判负 / 取消资格</option>
          </select>
          <input value={draft.note} disabled={locked} onChange={(event) => setDrafts((current) => ({ ...current, [match.assignmentId]: { ...draft, note: event.target.value } }))} placeholder="备注（可选）" />
          {match.resultStatus !== "confirmed" && <button type="button" disabled={busyId === match.assignmentId || !match.playerAName || !match.playerBName} onClick={() => submit(match)}>{busyId === match.assignmentId ? "提交中..." : match.resultStatus === "submitted" ? "重新提交" : "提交赛果"}</button>}
          {canConfirm && match.resultStatus === "submitted" && <button className="confirm" type="button" disabled={busyId === match.assignmentId} onClick={() => confirm(match)}>确认赛果</button>}
        </div>
        {match.resultStatus === "confirmed" && <footer>胜者：<strong>{match.winnerPlayerName}</strong> · 已写入下一场比赛关系</footer>}
      </article>;
    })}</section>
    {!filtered.length && <section className="scoring-empty"><strong>当前没有符合条件的比赛</strong><p>{initialData.viewer.role === "referee" ? "请确认该赛事已经完成赛程编排，并把具体比赛分配给当前裁判账号。" : "请先完成签表生成和赛程编排。"}</p></section>}
  </main>;
}
