"use client";

import { useEffect, useMemo, useState } from "react";
import type { DrawSessionDetail } from "@/db/draw-engine";

type Props = { data: DrawSessionDetail };
type Stage = "roster" | "countdown" | "shuffle" | "reveal" | "done";

function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function phaseDescription(data: DrawSessionDetail) {
  if (data.session.phaseCode === "main-one") return "64人正赛 · 8组双败 · 16名种子分散入位";
  if (data.session.phaseCode === "main-two") return "32强重新抽签 · 16名胜部晋级球员进入保护位";
  return `${data.session.divisionCount} 个分区 · 每区 ${data.session.divisionSize} 人 · ${data.session.directQualifierCount} 人直接晋级 + ${data.session.rateQualifierCount} 人局胜率增补`;
}

export default function DrawScreenClient({ data }: Props) {
  const [stage, setStage] = useState<Stage>("roster");
  const [countdown, setCountdown] = useState(3);
  const [shuffleNames, setShuffleNames] = useState(() => data.participants.slice(0, 42).map((item) => item.playerName));
  const [revealed, setRevealed] = useState(0);
  const [division, setDivision] = useState(1);
  const [showPlayoff, setShowPlayoff] = useState(false);

  const resultOrder = useMemo(() => [...data.participants].sort((a, b) => a.displayDrawNo.localeCompare(b.displayDrawNo, "zh-CN", { numeric: true })), [data.participants]);
  const recentResults = resultOrder.slice(Math.max(0, revealed - 36), revealed);
  const divisionSlots = data.slots.filter((slot) => slot.divisionNo === division);
  const prelimById = useMemo(() => new Map(data.prelimMatches.map((match) => [match.id, match])), [data.prelimMatches]);

  useEffect(() => {
    if (stage !== "countdown") return;
    if (countdown <= 0) { setStage("shuffle"); return; }
    const timer = window.setTimeout(() => setCountdown((value) => value - 1), 800);
    return () => window.clearTimeout(timer);
  }, [stage, countdown]);
  useEffect(() => {
    if (stage !== "shuffle") return;
    const pool = data.participants.map((item) => item.playerName);
    const interval = window.setInterval(() => setShuffleNames(shuffle(pool).slice(0, 42)), 90);
    const timer = window.setTimeout(() => { window.clearInterval(interval); setStage("reveal"); setRevealed(0); }, 2600);
    return () => { window.clearInterval(interval); window.clearTimeout(timer); };
  }, [stage, data.participants]);
  useEffect(() => {
    if (stage !== "reveal") return;
    if (revealed >= resultOrder.length) { const timer = window.setTimeout(() => setStage("done"), 700); return () => window.clearTimeout(timer); }
    const timer = window.setTimeout(() => setRevealed((value) => Math.min(resultOrder.length, value + 8)), 100);
    return () => window.clearTimeout(timer);
  }, [stage, revealed, resultOrder.length]);

  function start() { setCountdown(3); setRevealed(0); setStage("countdown"); }
  async function browserFullscreen() {
    try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen(); else await document.exitFullscreen(); } catch { /* 页面仍保持独立大屏模式 */ }
  }

  return <main className="draw-screen">
    <header className="draw-screen-top"><div><small>HUACAI YOUTH DRAW</small><strong>{data.session.eventTitle}</strong></div><div className="draw-screen-meta"><span>{data.session.groupName}</span><span>{data.session.phaseTitle}</span><span>V{data.session.versionNo}</span><button type="button" onClick={browserFullscreen}>全屏</button></div></header>

    {stage === "roster" && <section className="draw-screen-roster">
      <div className="draw-screen-title"><small>本次抽签名单</small><h1>{data.session.entrantCount}<em>人</em></h1><p>{phaseDescription(data)}</p></div>
      <div className="draw-name-cloud">{data.participants.slice(0, 72).map((item) => <span key={item.playerId || `${item.playerName}-${item.randomOrder}`}>{item.playerName}</span>)}</div>
      <div className="draw-screen-rule"><span>签表容量 {data.session.bracketSize}</span>{data.session.playoffMatchCount > 0 && <span>附加赛 {data.session.playoffMatchCount} 场</span>}{data.session.byeCount > 0 && <span>轮空 {data.session.byeCount}</span>}<span>随机承诺 {data.session.randomCommitment.slice(0, 16)}…</span></div>
      <button className="draw-start-button" type="button" onClick={start}>开始现场抽签</button>
    </section>}

    {stage === "countdown" && <section className="draw-screen-center"><small>抽签即将开始</small><strong className="draw-countdown">{countdown || "GO"}</strong><p>服务器已经固定本次抽签结果，现场动画不会改变真实签位。</p></section>}
    {stage === "shuffle" && <section className="draw-screen-shuffle"><div className="draw-screen-title"><small>正在随机分配签位</small><h1>抽签中</h1><p>{data.session.phaseCode === "main-one" ? "种子保护规则已经固定，其余球员正在随机分配" : data.session.phaseCode === "main-two" ? "胜部保护位已经固定，其余球员正在随机分配" : "球员名单正在分区、分配附加赛与轮空位置"}</p></div><div className="draw-shuffle-grid">{shuffleNames.map((name, index) => <span key={`${index}-${name}`}>{name}</span>)}</div></section>}
    {stage === "reveal" && <section className="draw-screen-reveal"><div className="draw-reveal-head"><div><small>正在揭晓</small><h1>{revealed}<em> / {resultOrder.length}</em></h1></div><div className="draw-progress"><i style={{ width: `${resultOrder.length ? (revealed / resultOrder.length) * 100 : 0}%` }}/></div></div><div className="draw-reveal-grid">{recentResults.map((item) => <div key={`${item.playerId}-${item.displayDrawNo}`}><span>{item.displayDrawNo}</span><strong>{item.playerName}</strong></div>)}</div></section>}

    {stage === "done" && <section className="draw-screen-done">
      <div className="draw-done-head"><div><small>DRAW COMPLETED</small><h1>抽签完成</h1><p>{data.session.phaseCode.startsWith("main-") ? `${data.session.entrantCount} 名球员已经获得本阶段正式签位。` : `${data.session.entrantCount} 名球员已经获得签位。附加赛球员使用“附001-A / B”格式，胜者进入对应标准签位。`}</p></div><div><b>{data.session.divisionCount}</b><span>{data.session.phaseCode === "main-one" ? "个小组" : "个签表区"}</span></div><div><b>{data.session.playoffMatchCount}</b><span>场附加赛</span></div><div><b>{data.session.byeCount}</b><span>个轮空</span></div></div>
      <div className="draw-screen-view-tabs"><button type="button" className={!showPlayoff ? "active" : ""} onClick={() => setShowPlayoff(false)}>正式签位</button>{data.session.playoffMatchCount > 0 && <button type="button" className={showPlayoff ? "active" : ""} onClick={() => setShowPlayoff(true)}>附加赛</button>}</div>
      {!showPlayoff ? <><div className="draw-screen-divisions">{Array.from({ length: data.session.divisionCount }, (_, index) => index + 1).map((item) => <button type="button" key={item} className={division === item ? "active" : ""} onClick={() => setDivision(item)}>{data.session.phaseCode === "main-one" ? `第${item}组` : `第${item}区`}</button>)}</div><div className="draw-screen-slot-grid">{divisionSlots.map((slot) => { const prelim = slot.prelimMatchId ? prelimById.get(slot.prelimMatchId) : null; return <div key={slot.slotNo}><span>{String(slot.slotNo).padStart(3, "0")}</span><strong>{slot.slotType === "bye" ? "轮空" : slot.slotType === "playoff_winner" ? `附加赛${prelim?.matchNo ?? ""}胜者` : slot.playerName}</strong></div>; })}</div></> : <div className="draw-screen-prelim-grid">{data.prelimMatches.map((match) => <div key={match.id}><span>附{String(match.matchNo).padStart(3, "0")}</span><strong>{match.playerAName}</strong><i>VS</i><strong>{match.playerBName}</strong><small>胜者 → {String(match.targetSlotNo).padStart(3, "0")}号签位</small></div>)}</div>}
    </section>}
  </main>;
}
