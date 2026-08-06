"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { BracketDetail, BracketMatch } from "@/db/bracket-engine";
import type { ScheduleWorkspaceData } from "@/db/schedule-engine";

type Props = { bracket: BracketDetail; schedule: ScheduleWorkspaceData };

function sideLabel(match: BracketMatch, side: "A" | "B", matchById: Map<string, BracketMatch>) {
  const playerName = side === "A" ? match.playerAName : match.playerBName;
  const sourceType = side === "A" ? match.sourceAType : match.sourceBType;
  const sourceRef = side === "A" ? match.sourceARef : match.sourceBRef;
  if (sourceType === "bye") return "BYE";
  if (playerName && playerName !== "BYE") return playerName;
  if (sourceType === "winner" && sourceRef) return `${matchById.get(sourceRef)?.matchCode || "上一场"} 胜者`;
  return "待产生";
}

export default function PrintableCompetitionClient({ bracket, schedule }: Props) {
  const [mode, setMode] = useState<"bracket" | "schedule">("bracket");
  const matchById = useMemo(() => new Map(bracket.matches.map((match) => [match.id, match])), [bracket.matches]);
  const assignmentByMatch = useMemo(() => new Map(schedule.assignments.map((item) => [item.bracketMatchId, item])), [schedule.assignments]);
  const slotById = useMemo(() => new Map(schedule.timeSlots.map((item) => [item.id, item])), [schedule.timeSlots]);
  const tableById = useMemo(() => new Map(schedule.tables.map((item) => [item.id, item])), [schedule.tables]);

  const scheduledRows = useMemo(() => schedule.assignments.map((assignment) => {
    const match = matchById.get(assignment.bracketMatchId);
    const slot = assignment.timeSlotId ? slotById.get(assignment.timeSlotId) : null;
    const table = assignment.tableId ? tableById.get(assignment.tableId) : null;
    return { assignment, match, slot, table };
  }).sort((a, b) => `${a.slot?.matchDate || "9999"} ${a.slot?.startTime || "99:99"} ${a.table?.positionNo || 999}`.localeCompare(`${b.slot?.matchDate || "9999"} ${b.slot?.startTime || "99:99"} ${b.table?.positionNo || 999}`)), [schedule.assignments, matchById, slotById, tableById]);

  return <main className="print-center">
    <header className="print-screen-toolbar">
      <Link href={`/admin/competition/schedules?event=${encodeURIComponent(bracket.bracket.eventId)}`}>← 返回赛程编排</Link>
      <div><button className={mode === "bracket" ? "active" : ""} onClick={() => setMode("bracket")}>完整分区签表</button><button className={mode === "schedule" ? "active" : ""} onClick={() => setMode("schedule")}>赛程表</button></div>
      <button className="print-main-button" onClick={() => window.print()}>打印 / 保存PDF</button>
    </header>

    <section className="print-document-head"><div><small>2026 HUACAI YOUTH</small><h1>{bracket.bracket.eventTitle}</h1><p>{bracket.bracket.groupName} · {bracket.bracket.phaseTitle}</p></div><div><b>{bracket.bracket.divisionCount}</b><span>分区</span><b>{bracket.bracket.playableMatchCount}</b><span>实际比赛</span></div></section>

    {mode === "bracket" ? <section className="print-brackets">
      {Array.from({ length: bracket.bracket.divisionCount }, (_, index) => index + 1).map((divisionNo) => {
        const divisionMatches = bracket.matches.filter((match) => match.matchType === "division" && match.divisionNo === divisionNo);
        const rounds = [...new Set(divisionMatches.map((match) => match.roundNo))].sort((a, b) => a - b);
        return <article className="print-division-page" key={divisionNo}>
          <header><h2>第 {divisionNo} 区</h2><span>{bracket.bracket.groupName} · {bracket.bracket.phaseTitle}</span></header>
          <div className="print-round-grid">{rounds.map((roundNo) => {
            const rows = divisionMatches.filter((match) => match.roundNo === roundNo);
            return <div className="print-round-column" key={roundNo}><h3>{rows[0]?.roundName}</h3><div>{rows.map((match) => {
              const assignment = assignmentByMatch.get(match.id);
              const slot = assignment?.timeSlotId ? slotById.get(assignment.timeSlotId) : null;
              const table = assignment?.tableId ? tableById.get(assignment.tableId) : null;
              return <section className="print-match-card" key={match.id}><small>{match.matchCode}</small><strong>{sideLabel(match, "A", matchById)}</strong><strong>{sideLabel(match, "B", matchById)}</strong><em>{slot ? `${slot.matchDate} ${slot.startTime}` : "时间待定"}{table ? ` · ${table.displayName}` : ""}</em></section>;
            })}</div></div>;
          })}</div>
          <footer>第{divisionNo}区冠军直接晋级；分区决胜负者进入局胜率候补池。</footer>
        </article>;
      })}
    </section> : <section className="print-schedule-page">
      <table><thead><tr><th>日期</th><th>时间</th><th>台号</th><th>比赛编号</th><th>组别 / 阶段</th><th>比赛</th></tr></thead><tbody>{scheduledRows.map(({ assignment, match, slot, table }) => <tr key={assignment.id}><td>{slot?.matchDate || "待定"}</td><td>{slot?.startTime || "待定"}</td><td>{table?.displayName || "待定"}</td><td>{match?.matchCode}</td><td>{bracket.bracket.groupName} · {match?.roundName}</td><td><strong>{match ? sideLabel(match, "A", matchById) : ""}</strong><span> VS </span><strong>{match ? sideLabel(match, "B", matchById) : ""}</strong></td></tr>)}</tbody></table>
      {!scheduledRows.length && <p className="print-empty">尚未生成赛程。完整签表仍可打印，时间和球台会显示为“待定”。</p>}
    </section>}
  </main>;
}
