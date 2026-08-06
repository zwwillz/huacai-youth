"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { DrawSessionDetail } from "@/db/draw-engine";
import type { BracketDetail, BracketMatch } from "@/db/bracket-engine";

type Props = { draw: DrawSessionDetail; initialBracket: BracketDetail | null };

function sideLabel(match: BracketMatch, side: "A" | "B", matchById: Map<string, BracketMatch>) {
  const playerName = side === "A" ? match.playerAName : match.playerBName;
  const sourceType = side === "A" ? match.sourceAType : match.sourceBType;
  const sourceRef = side === "A" ? match.sourceARef : match.sourceBRef;
  if (sourceType === "bye") return "BYE / 轮空";
  if (playerName && playerName !== "BYE") return playerName;
  if (sourceType === "winner" && sourceRef) {
    const source = matchById.get(sourceRef);
    return source ? `${source.matchCode} 胜者` : "上一场胜者";
  }
  return "待产生";
}

export default function BracketWorkbenchClient({ draw, initialBracket }: Props) {
  const [bracket, setBracket] = useState<BracketDetail | null>(initialBracket);
  const [division, setDivision] = useState(1);
  const [view, setView] = useState<"division" | "playoff">("division");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const matchById = useMemo(() => new Map((bracket?.matches ?? []).map((match) => [match.id, match])), [bracket]);
  const divisionMatches = useMemo(() => (bracket?.matches ?? []).filter((match) => match.matchType === "division" && match.divisionNo === division), [bracket, division]);
  const playoffMatches = useMemo(() => (bracket?.matches ?? []).filter((match) => match.matchType === "playoff"), [bracket]);
  const roundNumbers = useMemo(() => [...new Set(divisionMatches.map((match) => match.roundNo))].sort((a, b) => a - b), [divisionMatches]);

  async function generate() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/competition/bracket", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "generate", sessionId: draw.session.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "签表生成失败。");
      setBracket(result.data as BracketDetail);
      setDivision(1);
      setMessage("完整分区签表和每一场比赛关系已经生成。时间、球台和裁判将在下一步赛程编排中设置，不会影响抽签关系。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "签表生成失败。");
    } finally {
      setBusy(false);
    }
  }

  return <main className="bracket-workbench">
    <section className="bracket-hero">
      <div><small>BRACKET RELATION ENGINE</small><h2>{draw.session.eventTitle}</h2><p>{draw.session.groupName} · {draw.session.phaseTitle} · V{draw.session.versionNo}。抽签决定“谁进入哪个位置”，完整签表决定“每场胜者下一步去哪里”；比赛时间、球台和裁判属于下一层赛程编排。</p></div>
      <Link href={`/admin/competition/draw?event=${encodeURIComponent(draw.session.eventId)}&group=${encodeURIComponent(draw.session.groupId)}&phase=${encodeURIComponent(draw.session.phaseCode)}`}>返回抽签引擎</Link>
    </section>

    {!bracket && <section className="bracket-generate-card">
      <div><small>DRAW CONFIRMED</small><h3>正式抽签已经确认，可以生成完整比赛树</h3><p>系统会按照当前签位自动生成附加赛关系，以及每个分区从第一轮一直到分区决胜的全部比赛节点。32人/区时，每区生成31个比赛节点；16个分区共496个分区节点，另加本次实际附加赛。</p></div>
      <button type="button" disabled={busy || draw.session.status !== "confirmed"} onClick={generate}>{busy ? "正在生成..." : "生成完整签表与比赛关系"}</button>
      {draw.session.status !== "confirmed" && <small>请先回到抽签页面确认正式签表。</small>}
      {message && <p>{message}</p>}
    </section>}

    {bracket && <>
      <section className="bracket-metrics">
        <article><span>分区</span><strong>{bracket.bracket.divisionCount}</strong><small>{bracket.bracket.divisionSize}人 / 区</small></article>
        <article><span>附加赛</span><strong>{bracket.bracket.playoffMatchCount}</strong><small>先产生标准签位</small></article>
        <article><span>比赛节点</span><strong>{bracket.bracket.totalNodeCount}</strong><small>含附加赛和BYE节点</small></article>
        <article><span>实际比赛</span><strong>{bracket.bracket.playableMatchCount}</strong><small>BYE自动晋级不占球台</small></article>
      </section>

      <section className="bracket-note"><strong>当前阶段不绑定比赛时间</strong><p>这里先固定签表关系。下一步“赛程与球台”再配置每天的比赛时段，例如 09:00、10:45、13:30……并分配球台、TV台和裁判。这样临时改时间或换桌不会破坏抽签结果。</p></section>
      {message && <p className="bracket-message">{message}</p>}

      <section className="bracket-toolbar">
        <div><button className={view === "division" ? "active" : ""} type="button" onClick={() => setView("division")}>分区签表</button>{playoffMatches.length > 0 && <button className={view === "playoff" ? "active" : ""} type="button" onClick={() => setView("playoff")}>附加赛</button>}</div>
        <span>生成于 {bracket.bracket.generatedAt}</span>
      </section>

      {view === "division" ? <>
        <div className="bracket-division-tabs">{Array.from({ length: bracket.bracket.divisionCount }, (_, index) => index + 1).map((item) => <button type="button" className={division === item ? "active" : ""} key={item} onClick={() => setDivision(item)}>第{item}区</button>)}</div>
        <section className="bracket-round-board">
          {roundNumbers.map((roundNo) => {
            const roundMatches = divisionMatches.filter((match) => match.roundNo === roundNo);
            return <div className="bracket-round-column" key={roundNo}>
              <header><span>ROUND {roundNo}</span><strong>{roundMatches[0]?.roundName}</strong><small>{roundMatches.length} 场</small></header>
              <div className="bracket-round-list">{roundMatches.map((match) => <article key={match.id} className={match.status === "auto_advanced" ? "auto" : ""}>
                <div className="bracket-match-code"><b>{match.matchCode}</b>{match.status === "auto_advanced" && <span>自动晋级</span>}</div>
                <div className="bracket-player"><i>A</i><strong>{sideLabel(match, "A", matchById)}</strong></div>
                <div className="bracket-player"><i>B</i><strong>{sideLabel(match, "B", matchById)}</strong></div>
                {match.winnerPlayerName && <small>BYE → {match.winnerPlayerName} 自动进入下一轮</small>}
              </article>)}</div>
            </div>;
          })}
        </section>
        <section className="bracket-final-rule"><strong>第{division}区最终出口</strong><p>本区分区决胜胜者直接进入资格赛晋级名单；决胜轮负者进入“局胜率候补池”。16个分区共产生16名直晋球员和16名候补球员，再从候补池按局胜率取前8名增补。</p></section>
      </> : <section className="bracket-playoff-list">{playoffMatches.map((match) => <article key={match.id}><span>{match.matchCode}</span><strong>{match.playerAName}</strong><i>VS</i><strong>{match.playerBName}</strong><small>胜者进入标准签表对应位置</small></article>)}</section>}
    </>}
  </main>;
}
