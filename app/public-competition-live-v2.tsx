"use client";

import { CSSProperties, PointerEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Group, Phase, PhaseId, Station } from "./public-types";
import type { PublicCompetitionEvent, PublicLiveMatch, PublicPhaseSummary } from "@/db/public-competition-live";
import type { PublicContentState } from "@/db/public-content";
import type { PublicRanking } from "@/db/rankings";

export type PublicCompetitionTab = "schedule" | "matches" | "rankings";
export type PublicCompetitionWarmIntent = "entry" | PublicCompetitionTab;
type StationMeta = Pick<Station, "id" | "eventId" | "title" | "city" | "phases" | "format" | "prizes">;
type PublicDisplayMatch = Pick<PublicLiveMatch,
  "id" | "group" | "phaseId" | "divisionNo" | "roundNo" | "roundName" | "matchCode" |
  "playerA" | "playerB" | "scoreA" | "scoreB" | "resultStatus" | "status" |
  "winnerPlayerName" | "date" | "time" | "table" | "isTv"
>;
type PublicCompetitionDisplayEvent = Omit<PublicCompetitionEvent, "matches"> & { matches: PublicDisplayMatch[] };
type EventPayload = { version: string; event: PublicCompetitionDisplayEvent };
type RankingPayload = { version: string; rankings: PublicRanking[] };

const summaryCache = new Map<string, EventPayload>();
const competitionCache = new Map<string, EventPayload>();
const rankingsCache = new Map<string, RankingPayload>();
const summaryRequests = new Map<string, Promise<EventPayload>>();
const competitionRequests = new Map<string, Promise<EventPayload>>();
const rankingsRequests = new Map<string, Promise<RankingPayload>>();
const competitionVersions = new Map<string, string>();

function requestQuery(force: boolean, requestedVersion: string) {
  if (requestedVersion) return `?version=${encodeURIComponent(requestedVersion)}`;
  return force ? `?refresh=${Date.now()}` : "";
}

async function requestSummary(eventId: string, force = false, requestedVersion = "") {
  if (!force) {
    const cached = summaryCache.get(eventId);
    if (cached) return cached;
    const pending = summaryRequests.get(eventId);
    if (pending) return pending;
  }
  const request = fetch(`/api/public/events/${encodeURIComponent(eventId)}/competition/summary${requestQuery(force, requestedVersion)}`)
    .then(async (response) => {
      const payload = await response.json() as { data?: EventPayload; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || "赛事摘要读取失败。");
      summaryCache.set(eventId, payload.data);
      competitionVersions.set(eventId, payload.data.version);
      return payload.data;
    })
    .finally(() => { summaryRequests.delete(eventId); });
  if (!force) summaryRequests.set(eventId, request);
  return request;
}

async function requestCompetition(eventId: string, force = false, requestedVersion = "") {
  if (!force) {
    const cached = competitionCache.get(eventId);
    if (cached) return cached;
    const pending = competitionRequests.get(eventId);
    if (pending) return pending;
  }
  const request = fetch(`/api/public/events/${encodeURIComponent(eventId)}/competition/matches${requestQuery(force, requestedVersion)}`)
    .then(async (response) => {
      const payload = await response.json() as { data?: EventPayload; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || "比赛数据读取失败。");
      competitionCache.set(eventId, payload.data);
      summaryCache.set(eventId, { ...payload.data, event: { ...payload.data.event, matches: [] } });
      competitionVersions.set(eventId, payload.data.version);
      return payload.data;
    })
    .finally(() => { competitionRequests.delete(eventId); });
  if (!force) competitionRequests.set(eventId, request);
  return request;
}

async function requestRankings(eventId: string, force = false, requestedVersion = "") {
  if (!force) {
    const cached = rankingsCache.get(eventId);
    if (cached) return cached;
    const pending = rankingsRequests.get(eventId);
    if (pending) return pending;
  }
  const request = fetch(`/api/public/events/${encodeURIComponent(eventId)}/competition/rankings${requestQuery(force, requestedVersion)}`)
    .then(async (response) => {
      const payload = await response.json() as { data?: RankingPayload; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || "排名数据读取失败。");
      rankingsCache.set(eventId, payload.data);
      competitionVersions.set(eventId, payload.data.version);
      return payload.data;
    })
    .finally(() => { rankingsRequests.delete(eventId); });
  if (!force) rankingsRequests.set(eventId, request);
  return request;
}

export async function preloadPublicCompetition(eventId: string, intent: PublicCompetitionWarmIntent = "entry") {
  try {
    if (intent === "rankings") {
      await requestRankings(eventId);
      return;
    }
    if (intent === "matches") {
      await requestCompetition(eventId);
      return;
    }
    if (intent === "schedule") {
      const summary = requestSummary(eventId);
      void requestCompetition(eventId).catch(() => undefined);
      await summary;
      return;
    }
    await Promise.all([requestSummary(eventId), requestRankings(eventId)]);
    window.setTimeout(() => { void requestCompetition(eventId).catch(() => undefined); }, 450);
  } catch {
    // Prefetch is opportunistic. The active tab will retry and surface errors if needed.
  }
}

const PHASE_ORDER: PhaseId[] = ["qualifier-one", "qualifier-two", "main-one", "main-two"];
const PHASE_LABELS: Record<PhaseId, string> = {
  "qualifier-one": "资格赛第一场",
  "qualifier-two": "资格赛第二场",
  "main-one": "正赛第一阶段",
  "main-two": "正赛第二阶段",
};
const STAGE_MATCH_HEIGHT = 68;
const STAGE_ROW_GAP = 86;
const STAGE_TOP_PAD = 42;

const liveCss = `
.content.public-competition-mode>.stack:not(.public-competition-overlay):not(.public-live-stage-detail){display:none!important}
.public-competition-overlay,.public-live-stage-detail{display:flex;flex-direction:column;gap:18px}
.tabs.public-five-tabs{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;width:min(620px,100%)!important}.tabs.public-five-tabs button{min-width:0}
.public-stage-summary{padding:9px 17px;color:#755c88;background:#f5f0fa;font-size:9px}.public-stage-summary strong{color:#56317f}
.public-prelim-zone{height:auto!important;min-height:0!important}.public-prelim-grid{display:grid;grid-template-columns:repeat(4,154px);gap:12px 18px}.public-prelim-grid .stage-tree-match{position:relative}.public-prelim-grid .stage-game-no{left:auto;right:3px;top:27px}
.public-phase-actions{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.compact-phase>footer .public-phase-actions button{padding:8px 12px;border:0;border-radius:999px;color:#5a2daa;background:#f2edff;font-size:9px;font-weight:900;cursor:pointer;white-space:nowrap}.compact-phase>footer .public-phase-actions button.roster{color:#fff;background:#5d2eab}
.public-roster-intro{padding:18px;border:1px solid #e4ddea;border-radius:15px;background:linear-gradient(145deg,#fff,#f6f0fb)}.public-roster-intro small{color:#765492;font-size:8px;font-weight:900}.public-roster-intro h2{margin:5px 0 7px;font-size:19px}.public-roster-intro p{margin:0;color:#817488;font-size:9px;line-height:1.7}.public-roster-intro strong{color:#633891}
.public-roster-groups{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.public-roster-group{padding:13px;border:1px solid #e8e2ec;border-radius:12px;background:#fff}.public-roster-group header{display:flex;justify-content:space-between;align-items:end;margin-bottom:9px}.public-roster-group h3{margin:0;font-size:12px}.public-roster-group header span{color:#774f98;font-size:8px;font-weight:900}.public-roster-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}.public-roster-grid div{display:flex;align-items:center;gap:6px;min-width:0;padding:7px 8px;border-radius:8px;background:#f8f6fa}.public-roster-grid span{width:22px;color:#9b8ba5;font-size:7px}.public-roster-grid strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9px}
.public-final-ranking{margin-top:16px;border-top:1px solid var(--line)}.public-final-ranking>div{min-height:54px;display:grid;grid-template-columns:48px 90px minmax(120px,1fr) auto;gap:10px;align-items:center;border-bottom:1px solid var(--line)}.public-final-ranking span{width:28px;height:28px;display:grid;place-items:center;border-radius:50%;color:#765f8b;background:#f0edf5;font-size:9px}.public-final-ranking>div:nth-child(-n+4) span{color:#fff;background:linear-gradient(145deg,#ef459a,#6934d5)}.public-final-ranking b{color:#5a2da8;font-size:10px}.public-final-ranking strong{font-size:11px}.public-final-ranking em{color:#4c288e;font-size:10px;font-style:normal;font-weight:800}
.public-main-empty-note{padding:8px 17px;color:#755c88;background:#f5f0fa;font-size:9px}.public-main-empty-note strong{color:#56317f}
.public-module-state{min-height:300px;display:grid;place-items:center;padding:36px 22px;border:1px solid #e6dff0;border-radius:18px;background:linear-gradient(145deg,#fff,#f8f4fb);text-align:center}.public-module-state>div{max-width:460px}.public-module-state span{width:52px;height:52px;display:grid;place-items:center;margin:0 auto 14px;border-radius:16px;color:#fff;background:linear-gradient(145deg,#6734ce,#d7469c);font-size:18px;font-weight:900}.public-module-state h2{margin:0 0 9px;color:#2c173f;font-size:20px}.public-module-state p{margin:0;color:#817489;font-size:11px;line-height:1.8}.public-module-state button{margin-top:16px;padding:10px 18px;border:0;border-radius:999px;color:#fff;background:#6235b0;font-size:10px;font-weight:900;cursor:pointer}
.public-third-place{width:240px;margin:20px 0 0}.public-third-place h3{margin:0 0 9px;color:#fff;font-size:12px}
.public-match-load-more{display:flex;justify-content:center;padding:4px 0 14px}.public-match-load-more button{display:flex;align-items:center;gap:8px;padding:10px 18px;border:0;border-radius:999px;color:#fff;background:#6235b0;font-size:10px;font-weight:900;cursor:pointer}.public-match-load-more button span{font-size:8px;font-weight:700;opacity:.78}
@media(max-width:900px){.tabs.public-five-tabs{width:100%!important}.tabs.public-five-tabs button{font-size:10px!important;padding:8px 2px!important}.public-roster-groups{grid-template-columns:1fr}.public-prelim-grid{grid-template-columns:repeat(2,154px)}}
@media(max-width:520px){.public-final-ranking>div{grid-template-columns:36px 70px minmax(90px,1fr) auto;gap:6px}.public-prelim-grid{grid-template-columns:154px}}
`;

function GroupSwitch({ group, setGroup }: { group: Group; setGroup: (group: Group) => void }) {
  return <div className="group-switch" aria-label="选择比赛组别"><button className={group === "少年组" ? "active" : ""} onClick={() => setGroup("少年组")}><b>U16</b><span>少年组</span></button><button className={group === "青年组" ? "active" : ""} onClick={() => setGroup("青年组")}><b>U20</b><span>青年组</span></button></div>;
}

function shortDate(value: string | null) { if (!value) return "时间待定"; const [, month, day] = value.split("-"); return month && day ? `${Number(month)}月${Number(day)}日` : value; }
function compactDate(value: string) { const [, month, day] = value.split("-"); return month && day ? `${month}-${day}` : value; }
function weekday(value: string) { const labels = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"]; const date = new Date(`${value}T12:00:00+08:00`); return Number.isNaN(date.getTime()) ? "" : labels[date.getDay()]; }
function currentChinaDate() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
function latestAvailableDay(days: string[]) { const today = currentChinaDate(); return [...days].filter((day) => day <= today).at(-1) ?? days[0] ?? ""; }
function scoreLabel(match: PublicDisplayMatch) { if (match.status === "auto_advanced") return "轮空"; if (match.scoreA == null || match.scoreB == null) return "— : —"; return `${match.scoreA} : ${match.scoreB}`; }
function matchStatus(match: PublicDisplayMatch) { if (match.status === "auto_advanced") return "自动晋级"; if (match.resultStatus === "confirmed") return "已结束"; if (match.resultStatus === "submitted") return "待确认"; return "待开始"; }
function displayName(value: string | null | undefined, fallback: string) { if (value === "BYE") return "轮空"; return value || fallback; }
function phaseFor(station: StationMeta, id: PhaseId): Phase { return station.phases.find((item) => item.id === id) ?? { id, number: String(PHASE_ORDER.indexOf(id) + 1).padStart(2, "0"), title: PHASE_LABELS[id], date: "待公布", status: "待开始" }; }
function phaseSummary(data: PublicCompetitionDisplayEvent, group: Group, phaseId: PhaseId) { return data.phaseSummaries.find((item) => item.group === group && item.phaseId === phaseId); }
function phaseMatches(data: PublicCompetitionDisplayEvent, group: Group, phaseId: PhaseId) { return data.matches.filter((item) => item.group === group && item.phaseId === phaseId); }
function raceLabel(group: Group, phase: PhaseId) { if (phase.startsWith("qualifier")) return group === "少年组" ? "9局5胜" : "13局7胜"; if (phase === "main-one") return group === "少年组" ? "13局7胜" : "17局9胜"; return group === "少年组" ? "17局9胜" : "21局11胜"; }
function displayMatchCode(code: string | null | undefined, phase?: PhaseId) {
  if (!code) return "场次待定";
  const playoff = code.match(/^Q[12]-P(\d+)$/); if (playoff) return `附加赛第${Number(playoff[1])}场`;
  const qualifier = code.match(/^Q[12]-D(\d+)-R(\d+)-M(\d+)$/); if (qualifier) return `第${Number(qualifier[1])}区 · 第${Number(qualifier[2])}轮 · 第${Number(qualifier[3])}场`;
  const mainGroup = code.match(/^M1-G(\d+)-([A-Z]+)(\d+)$/); if (mainGroup) return `第${Number(mainGroup[1])}组 · 第${Number(mainGroup[3])}场`;
  const mainTwo = code.match(/^M2-R(\d+)-M(\d+)$/); if (mainTwo) return `${["32进16", "16进8", "8进4", "半决赛", "决赛"][Number(mainTwo[1]) - 1] || "正赛"} · 第${Number(mainTwo[2])}场`;
  if (code === "M2-3RD") return "三、四名决赛";
  return phase ? `${PHASE_LABELS[phase]} · 场次` : "比赛场次";
}

function usePublicPanZoom() {
  const [zoom, setZoom] = useState(1); const [offset, setOffset] = useState({ x: 0, y: 0 }); const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const down = useCallback((event: PointerEvent<HTMLDivElement>) => { drag.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y }; event.currentTarget.setPointerCapture?.(event.pointerId); }, [offset]);
  const move = useCallback((event: PointerEvent<HTMLDivElement>) => { if (!drag.current) return; setOffset({ x: drag.current.ox + event.clientX - drag.current.x, y: drag.current.oy + event.clientY - drag.current.y }); }, []);
  const up = useCallback(() => { drag.current = null; }, []); const reset = useCallback(() => { setZoom(1); setOffset({ x: 0, y: 0 }); }, []);
  return { zoom, setZoom, offset, setOffset, down, move, up, reset };
}

function PublicPlayerLine({ slot, name, score, hit }: { slot?: string; name: string; score: string | number; hit: boolean }) {
  return <div className={`stage-competitor ${slot ? "has-slot" : "no-slot"} ${hit ? "search-hit" : ""}`}>{slot && <em>{slot}</em>}<span title={name}>{name}</span><b>{score}</b></div>;
}

function PublicTreeMatch({ match, round, index, width, query, showSlots, slotStart, fallback = "待定", prefix = "" }: { match?: PublicDisplayMatch; round: number; index: number; width: number; query: string; showSlots: boolean; slotStart: number; fallback?: string; prefix?: string }) {
  const rawCode = match?.matchCode || `${prefix}${round + 1}-${index + 1}`;
  const visibleCode = match ? displayMatchCode(match.matchCode, match.phaseId) : "场次待定";
  const q = query.trim().toLowerCase(); const hit = Boolean(q) && [match?.playerA, match?.playerB, match?.table, rawCode, visibleCode].some((item) => (item ?? "").toLowerCase().includes(q));
  const baseFallback = round === 0 ? fallback : "晋级者待定"; const a = displayName(match?.playerA, baseFallback); const b = displayName(match?.playerB, match?.status === "auto_advanced" ? "轮空" : baseFallback);
  const slotA = showSlots ? String(slotStart + index * 2).padStart(3, "0") : undefined; const slotB = showSlots ? String(slotStart + index * 2 + 1).padStart(3, "0") : undefined;
  const scoreA = match?.status === "auto_advanced" ? "✓" : match?.scoreA ?? "—"; const scoreB = match?.status === "auto_advanced" ? "—" : match?.scoreB ?? "—";
  return <article className={`stage-tree-match ${hit ? "match-hit" : ""}`} style={{ width }} data-public-live-hit={hit ? "true" : undefined}><PublicPlayerLine slot={slotA} name={a} score={scoreA} hit={hit} /><div className="stage-between"><time>{match?.date ? `${shortDate(match.date)} ${match.time ?? ""}` : match?.status === "auto_advanced" ? "自动晋级" : "时间待定"}</time><span className={match?.isTv ? "tv" : ""}>{match?.table || (match?.status === "auto_advanced" ? "轮空" : "球台待定")}</span></div><PublicPlayerLine slot={slotB} name={b} score={scoreB} hit={hit} /><b className="stage-game-no">{visibleCode}</b></article>;
}

function TerminalPlayer({ label, name = "晋级者待定", accent = "green" }: { label: string; name?: string; accent?: "green" | "pink" }) { return <article className={`terminal-player terminal-${accent}`}><small>{label}</small><strong>{name}</strong></article>; }
function RoutePath({ className = "", style }: { className?: string; style: CSSProperties }) { return <i className={`stage-path ${className}`} style={style} />; }

function PublicKnockoutTree({ firstRoundCount, labels, matches, query, showSlots, slotStart, prefix, terminalLabel = "晋级" }: { firstRoundCount: number; labels: string[]; matches: PublicDisplayMatch[]; query: string; showSlots: boolean; slotStart: number; prefix: string; terminalLabel?: string }) {
  const columnGap = 48; const widths = labels.map((_, round) => round === 0 ? (showSlots ? 154 : 128) : 116); const lefts = widths.map((_, round) => widths.slice(0, round).reduce((sum, width) => sum + width, 0) + round * columnGap); const counts = labels.map((_, round) => Math.ceil(firstRoundCount / 2 ** round));
  const center = (round: number, index: number) => STAGE_TOP_PAD + ((2 ** round - 1) / 2) * STAGE_ROW_GAP + index * 2 ** round * STAGE_ROW_GAP; const terminalWidth = 108; const terminalLeft = lefts.at(-1)! + widths.at(-1)! + columnGap; const totalWidth = terminalLeft + terminalWidth; const height = STAGE_TOP_PAD * 2 + (firstRoundCount - 1) * STAGE_ROW_GAP + STAGE_MATCH_HEIGHT; const finalCenter = center(labels.length - 1, 0);
  const rounds = new Map<number, PublicDisplayMatch[]>(); for (let round = 1; round <= labels.length; round += 1) rounds.set(round, matches.filter((match) => match.roundNo === round)); const finalMatch = rounds.get(labels.length)?.[0]; const terminalName = finalMatch?.winnerPlayerName || (terminalLabel === "冠军" ? "冠军待定" : "晋级者待定");
  return <div className="stage-knockout-tree" style={{ width: totalWidth }}><header className="stage-knockout-head" style={{ width: totalWidth }}>{labels.map((label, round) => <span key={`${label}-${round}`} style={{ left: lefts[round], width: widths[round] }}>{label}</span>)}<span className="terminal-heading" style={{ left: terminalLeft, width: terminalWidth }}>{terminalLabel}</span></header><section className="stage-knockout-stage" style={{ width: totalWidth, height }}>
    {counts.map((count, round) => Array.from({ length: count }, (_, index) => { const top = center(round, index) - STAGE_MATCH_HEIGHT / 2; const match = rounds.get(round + 1)?.[index]; return <div className="stage-tree-match-wrap" style={{ left: lefts[round], top, width: widths[round], height: STAGE_MATCH_HEIGHT }} key={`${round}-${index}`}><PublicTreeMatch match={match} round={round} index={index} width={widths[round]} query={query} showSlots={showSlots && round === 0} slotStart={slotStart} prefix={prefix} /></div>; }))}
    {counts.slice(0, -1).map((count, round) => Array.from({ length: Math.floor(count / 2) }, (_, index) => { const y1 = center(round, index * 2), y2 = center(round, index * 2 + 1), mid = (y1 + y2) / 2; const left = lefts[round] + widths[round], nextLeft = lefts[round + 1], half = (nextLeft - left) / 2; return <span className="stage-tree-paths" key={`path-${round}-${index}`}><RoutePath className="horizontal" style={{ left, top: y1, width: half }} /><RoutePath className="horizontal" style={{ left, top: y2, width: half }} /><RoutePath className="vertical" style={{ left: left + half, top: y1, height: y2 - y1 }} /><RoutePath className="horizontal" style={{ left: left + half, top: mid, width: half }} /></span>; }))}
    <span className="stage-tree-paths"><RoutePath className="horizontal terminal-path" style={{ left: lefts.at(-1)! + widths.at(-1)!, top: finalCenter, width: columnGap }} /></span><div className="terminal-player-wrap" style={{ left: terminalLeft, top: finalCenter - 24, width: terminalWidth }}><TerminalPlayer label={terminalLabel} name={terminalName} accent={terminalLabel === "冠军" ? "pink" : "green"} /></div>
  </section></div>;
}

function PublicQualifierBoard({ summary, matches, query }: { summary?: PublicPhaseSummary; matches: PublicDisplayMatch[]; query: string }) {
  const divisions = summary?.divisionCount ?? 16; const divisionSize = summary?.divisionSize ?? 32; const prelim = matches.filter((match) => match.roundNo === 0);
  return <div className="qualification-phase-board">{prelim.length > 0 && <section className="qualifier-zone public-prelim-zone"><h3><b>附加赛</b><span>{prelim.length}场 · 胜者进入标准签表</span></h3><div className="public-prelim-grid">{prelim.map((match, index) => <PublicTreeMatch key={match.id} match={match} round={0} index={index} width={154} query={query} showSlots={false} slotStart={1} prefix="附" />)}</div></section>}{Array.from({ length: divisions }, (_, divisionIndex) => { const divisionNo = divisionIndex + 1; const region = matches.filter((match) => match.divisionNo === divisionNo && match.roundNo > 0); return <section className="qualifier-zone" key={divisionNo} data-region={divisionNo}><h3><b>第{divisionNo}区</b><span>单败 · 产生1名直接晋级选手</span></h3><PublicKnockoutTree firstRoundCount={divisionSize / 2} labels={["32进16", "16进8", "8进4", "4进2", "分区决胜"]} matches={region} query={query} showSlots slotStart={divisionIndex * divisionSize + 1} prefix={`第${divisionNo}区-`} /></section>; })}</div>;
}

function PublicDoubleElimGroup({ groupNo, matches, query }: { groupNo: number; matches: PublicDisplayMatch[]; query: string }) {
  const centerLeft = 500, centerWidth = 154, loserOneLeft = 324, loserTwoLeft = 152, loserTerminalLeft = 0, winnerLeft = 704, winnerTerminalLeft = 868; const routeWidth = 116, terminalWidth = 104; const centerY = [125, 295, 465, 635], routeY = [210, 550];
  const first = matches.filter((match) => match.roundName === "小组第一轮"); const loserOne = matches.filter((match) => match.roundName === "败部第一轮"); const winner = matches.filter((match) => match.roundName === "胜部晋级轮"); const loserTwo = matches.filter((match) => match.roundName === "败部晋级轮");
  const pairLines = (direction: "left" | "right", pair: number) => { const y1 = centerY[pair * 2], y2 = centerY[pair * 2 + 1], mid = (y1 + y2) / 2; if (direction === "right") { const start = centerLeft + centerWidth, end = winnerLeft, turn = (start + end) / 2; return <span className="double-path-set" key={`wr-${pair}`}><RoutePath className="horizontal" style={{ left: start, top: y1, width: turn - start }} /><RoutePath className="horizontal" style={{ left: start, top: y2, width: turn - start }} /><RoutePath className="vertical" style={{ left: turn, top: y1, height: y2 - y1 }} /><RoutePath className="horizontal" style={{ left: turn, top: mid, width: end - turn }} /></span>; } const start = centerLeft, end = loserOneLeft + routeWidth, turn = (start + end) / 2; return <span className="double-path-set" key={`lr-${pair}`}><RoutePath className="horizontal" style={{ left: turn, top: y1, width: start - turn }} /><RoutePath className="horizontal" style={{ left: turn, top: y2, width: start - turn }} /><RoutePath className="vertical" style={{ left: turn, top: y1, height: y2 - y1 }} /><RoutePath className="horizontal" style={{ left: end, top: mid, width: turn - end }} /></span>; };
  return <section className="double-elim-group"><h3><b>第{groupNo}组</b><span>双败8进4 · 胜部2人、败部2人晋级</span></h3><div className="double-elim-stage"><div className="double-column-title" style={{ left: loserTerminalLeft, width: terminalWidth }}>败部晋级</div><div className="double-column-title" style={{ left: loserTwoLeft, width: routeWidth }}>败部第二轮</div><div className="double-column-title" style={{ left: loserOneLeft, width: routeWidth }}>败部第一轮</div><div className="double-column-title center-title" style={{ left: centerLeft, width: centerWidth }}>首轮对阵 / 胜部第一轮</div><div className="double-column-title" style={{ left: winnerLeft, width: routeWidth }}>胜部第二轮</div><div className="double-column-title" style={{ left: winnerTerminalLeft, width: terminalWidth }}>胜部晋级</div>
    {centerY.map((y, index) => <div className="stage-tree-match-wrap" style={{ left: centerLeft, top: y - STAGE_MATCH_HEIGHT / 2, width: centerWidth, height: STAGE_MATCH_HEIGHT }} key={`c-${index}`}><PublicTreeMatch match={first[index]} round={0} index={index} width={centerWidth} query={query} showSlots slotStart={(groupNo - 1) * 8 + 1} prefix={`第${groupNo}组-`} /></div>)}
    {routeY.map((y, index) => <div className="stage-tree-match-wrap" style={{ left: winnerLeft, top: y - STAGE_MATCH_HEIGHT / 2, width: routeWidth, height: STAGE_MATCH_HEIGHT }} key={`w-${index}`}><PublicTreeMatch match={winner[index]} round={1} index={index} width={routeWidth} query={query} showSlots={false} slotStart={1} prefix="胜部-" /></div>)}
    {routeY.map((y, index) => <div className="stage-tree-match-wrap" style={{ left: loserOneLeft, top: y - STAGE_MATCH_HEIGHT / 2, width: routeWidth, height: STAGE_MATCH_HEIGHT }} key={`l1-${index}`}><PublicTreeMatch match={loserOne[index]} round={0} index={index} width={routeWidth} query={query} showSlots={false} slotStart={1} prefix="败部-" /></div>)}
    {routeY.map((y, index) => <div className="stage-tree-match-wrap" style={{ left: loserTwoLeft, top: y - STAGE_MATCH_HEIGHT / 2, width: routeWidth, height: STAGE_MATCH_HEIGHT }} key={`l2-${index}`}><PublicTreeMatch match={loserTwo[index]} round={1} index={index} width={routeWidth} query={query} showSlots={false} slotStart={1} prefix="败部-" /></div>)}
    {routeY.map((y, index) => <div className="terminal-player-wrap" style={{ left: winnerTerminalLeft, top: y - 24, width: terminalWidth }} key={`wt-${index}`}><TerminalPlayer label={`晋级${index + 1}`} name={winner[index]?.winnerPlayerName || "晋级者待定"} /></div>)}{routeY.map((y, index) => <div className="terminal-player-wrap" style={{ left: loserTerminalLeft, top: y - 24, width: terminalWidth }} key={`lt-${index}`}><TerminalPlayer label={`晋级${index + 3}`} name={loserTwo[index]?.winnerPlayerName || "晋级者待定"} /></div>)}
    <span className="double-lines">{[0, 1].map((pair) => pairLines("right", pair))}{[0, 1].map((pair) => pairLines("left", pair))}{routeY.map((y, index) => <span key={`straight-${index}`}><RoutePath className="horizontal" style={{ left: loserTwoLeft + routeWidth, top: y, width: loserOneLeft - (loserTwoLeft + routeWidth) }} /><RoutePath className="horizontal" style={{ left: loserTerminalLeft + terminalWidth, top: y, width: loserTwoLeft - (loserTerminalLeft + terminalWidth) }} /><RoutePath className="horizontal" style={{ left: winnerLeft + routeWidth, top: y, width: winnerTerminalLeft - (winnerLeft + routeWidth) }} /></span>)}<RoutePath className="vertical dashed" style={{ left: winnerLeft - 10, top: 58, height: routeY[0] - 58 }} /><RoutePath className="horizontal dashed" style={{ left: loserTwoLeft + routeWidth, top: 58, width: winnerLeft - 10 - (loserTwoLeft + routeWidth) }} /><RoutePath className="vertical dashed" style={{ left: loserTwoLeft + routeWidth, top: 58, height: routeY[0] - 58 }} /><RoutePath className="vertical dashed" style={{ left: winnerLeft - 10, top: routeY[1], height: 690 - routeY[1] }} /><RoutePath className="horizontal dashed" style={{ left: loserTwoLeft + routeWidth, top: 690, width: winnerLeft - 10 - (loserTwoLeft + routeWidth) }} /><RoutePath className="vertical dashed" style={{ left: loserTwoLeft + routeWidth, top: routeY[1], height: 690 - routeY[1] }} /></span><span className="double-feed-note feed-top">胜部负者转入败部</span><span className="double-feed-note feed-bottom">胜部负者转入败部</span>
  </div></section>;
}

function CompetitionTreeShell({ station, group, setGroup, phaseId, note, query, setQuery, children }: { station: StationMeta; group: Group; setGroup: (group: Group) => void; phaseId: PhaseId; note: string; query: string; setQuery: (value: string) => void; children: ReactNode }) {
  const [fullscreen, setFullscreen] = useState(false); const pan = usePublicPanZoom();
  const { reset, setOffset } = pan;
  useEffect(() => { if (!query.trim()) { reset(); return; } const timer = window.setTimeout(() => { const viewport = document.querySelector<HTMLElement>(`[data-public-board="${phaseId}"]`); const hit = viewport?.querySelector<HTMLElement>('[data-public-live-hit="true"]'); if (!viewport || !hit) return; const vr = viewport.getBoundingClientRect(), hr = hit.getBoundingClientRect(); setOffset((current) => ({ x: current.x + vr.left + vr.width / 2 - (hr.left + hr.width / 2), y: current.y + vr.top + vr.height / 2 - (hr.top + hr.height / 2) })); }, 80); return () => window.clearTimeout(timer); }, [query, phaseId, reset, setOffset]);
  return <div className="bracket-page stack public-live-stage-detail"><section className="bracket-title with-group compact-head"><div><small className="event-name-kicker">{station.title}</small><h1>{PHASE_LABELS[phaseId]}</h1><p>本阶段全部签位集中在一张赛程表</p></div><GroupSwitch group={group} setGroup={(value) => { setGroup(value); setQuery(""); pan.reset(); }} /></section><section className={`draw-shell unified-draw-shell ${fullscreen ? "draw-fullscreen" : ""}`}><div className="draw-toolbar"><div><small>{group} · 详细赛程表</small><h2>{PHASE_LABELS[phaseId]}</h2><p>{note}</p></div><label><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索球员、球台或场次" /></label><div className="board-controls"><button onClick={() => pan.setZoom((value) => Math.max(.45, value - .1))}>−</button><b>{Math.round(pan.zoom * 100)}%</b><button onClick={() => pan.setZoom((value) => Math.min(1.5, value + .1))}>＋</button><button onClick={pan.reset}>复位</button><button className="fullscreen-btn" onClick={() => { setFullscreen((value) => !value); pan.reset(); }}>{fullscreen ? "关闭全屏" : "全屏查看"}</button></div></div><section className="bracket-viewport upgraded unified-viewport" data-public-board={phaseId} onPointerDown={pan.down} onPointerMove={pan.move} onPointerUp={pan.up} onPointerCancel={pan.up}><div className="bracket-canvas corrected-canvas unified-canvas" style={{ transform: `translate(${pan.offset.x}px,${pan.offset.y}px) scale(${pan.zoom})` }}>{children}</div></section><p className="drag-tip">拖动查看整张签表；搜索命中后会自动定位并高亮。</p></section></div>;
}

function QualifierStageDetail({ station, data, group, setGroup, phaseId, onBack }: { station: StationMeta; data: PublicCompetitionDisplayEvent; group: Group; setGroup: (group: Group) => void; phaseId: PhaseId; onBack: () => void }) {
  const [query, setQuery] = useState(""); const summary = phaseSummary(data, group, phaseId); const matches = phaseMatches(data, group, phaseId);
  return <div className="stack public-competition-overlay"><button className="draw-back" onClick={onBack}>‹ 返回赛程阶段</button><CompetitionTreeShell station={station} group={group} setGroup={setGroup} phaseId={phaseId} query={query} setQuery={setQuery} note="16个区连续排列；每区签表末端标出直接晋级选手"><>{summary && <div className="public-stage-summary"><strong>{summary.entrantCount}人参赛</strong> · {summary.playoffMatchCount}场附加赛 · {summary.byeCount}个轮空 · {summary.divisionCount}个分区</div>}<PublicQualifierBoard summary={summary} matches={matches} query={query} /></></CompetitionTreeShell></div>;
}

function MainOneDetail({ station, data, group, setGroup, onBack }: { station: StationMeta; data: PublicCompetitionDisplayEvent; group: Group; setGroup: (group: Group) => void; onBack: () => void }) {
  const [query, setQuery] = useState(""); const matches = phaseMatches(data, group, "main-one");
  return <div className="stack public-competition-overlay"><button className="draw-back" onClick={onBack}>‹ 返回赛程阶段</button><CompetitionTreeShell station={station} group={group} setGroup={setGroup} phaseId="main-one" query={query} setQuery={setQuery} note="中间首轮对阵，右侧胜部、左侧败部；每组4人晋级"><>{!matches.length && <div className="public-main-empty-note"><strong>赛程表已开放：</strong>当前签位、球台和晋级关系尚未发布的部分统一显示“待定”。</div>}<div className="double-elim-phase-board">{Array.from({ length: 8 }, (_, index) => <PublicDoubleElimGroup key={index + 1} groupNo={index + 1} matches={matches.filter((match) => match.divisionNo === index + 1)} query={query} />)}</div></></CompetitionTreeShell></div>;
}

function MainTwoDetail({ station, data, group, setGroup, onBack }: { station: StationMeta; data: PublicCompetitionDisplayEvent; group: Group; setGroup: (group: Group) => void; onBack: () => void }) {
  const [query, setQuery] = useState(""); const matches = phaseMatches(data, group, "main-two"); const bracket = matches.filter((match) => match.matchCode !== "M2-3RD"); const third = matches.find((match) => match.matchCode === "M2-3RD");
  return <div className="stack public-competition-overlay"><button className="draw-back" onClick={onBack}>‹ 返回赛程阶段</button><CompetitionTreeShell station={station} group={group} setGroup={setGroup} phaseId="main-two" query={query} setQuery={setQuery} note="32强重新抽签，单败淘汰至冠军；未产生的数据统一显示待定"><>{!matches.length && <div className="public-main-empty-note"><strong>赛程表已开放：</strong>等待正赛第一阶段产生32强后重新抽签，当前选手、时间、球台和晋级节点显示待定。</div>}<PublicKnockoutTree firstRoundCount={16} labels={["32进16", "16进8", "8进4", "半决赛", "决赛"]} matches={bracket} query={query} showSlots slotStart={1} prefix="正赛-" terminalLabel="冠军" />{third && <div className="public-third-place"><h3>三、四名决赛</h3><PublicTreeMatch match={third} round={4} index={0} width={154} query={query} showSlots={false} slotStart={1} prefix="季军赛" /></div>}</></CompetitionTreeShell></div>;
}

function MainRosterDetail({ station, data, group, setGroup, onBack }: { station: StationMeta; data: PublicCompetitionDisplayEvent; group: Group; setGroup: (group: Group) => void; onBack: () => void }) {
  const roster = data.mainRoster.filter((item) => item.group === group).sort((a, b) => a.sortOrder - b.sortOrder); const q1 = roster.filter((item) => item.sourceType === "qualifier_one_qualified"); const q2 = roster.filter((item) => item.sourceType === "qualifier_two_qualified"); const seeds = roster.filter((item) => item.sourceType === "seed");
  return <div className="bracket-page stack public-live-stage-detail"><button className="draw-back" onClick={onBack}>‹ 返回赛程阶段</button><section className="bracket-title with-group compact-head"><div><small className="event-name-kicker">{station.title}</small><h1>正赛64人名单</h1><p>资格赛晋级48人 + 种子16人</p></div><GroupSwitch group={group} setGroup={setGroup} /></section><section className="public-roster-intro"><small>正赛 · 64人</small><h2><strong>{roster.length}/64</strong> 正赛名单已就绪</h2><p>两场资格赛各晋级24人，共48人；另有16名种子选手进入正赛。</p></section><section className="public-roster-groups">{[["资格赛第一场晋级", q1], ["资格赛第二场晋级", q2], ["种子选手", seeds]].map(([title, values]) => <article className="public-roster-group" key={String(title)}><header><h3>{String(title)}</h3><span>{(values as typeof roster).length}人</span></header><div className="public-roster-grid">{(values as typeof roster).map((player, index) => <div key={player.playerId}><span>{String(index + 1).padStart(2, "0")}</span><strong>{player.playerName}</strong></div>)}</div></article>)}</section></div>;
}

function PublicSchedule({ station, data, detailsReady, ensureDetails }: { station: StationMeta; data: PublicCompetitionDisplayEvent; detailsReady: boolean; ensureDetails: () => void }) {
  const [group, setGroup] = useState<Group>("少年组"); const [detail, setDetail] = useState<PhaseId | null>(null); const [showRoster, setShowRoster] = useState(false);
  const openDetail = (phaseId: PhaseId) => { ensureDetails(); setDetail(phaseId); };
  if (showRoster) return <MainRosterDetail station={station} data={data} group={group} setGroup={setGroup} onBack={() => setShowRoster(false)} />;
  if (detail?.startsWith("qualifier")) return <QualifierStageDetail station={station} data={data} group={group} setGroup={setGroup} phaseId={detail} onBack={() => setDetail(null)} />;
  if (detail === "main-one") return <MainOneDetail station={station} data={data} group={group} setGroup={setGroup} onBack={() => setDetail(null)} />;
  if (detail === "main-two") return <MainTwoDetail station={station} data={data} group={group} setGroup={setGroup} onBack={() => setDetail(null)} />;
  return <div className="schedule-page stack public-competition-overlay"><section className="schedule-head with-group compact-head"><div><small className="event-name-kicker">{station.title}</small><h1>赛程</h1><p>按比赛阶段查看完整赛程表</p></div><GroupSwitch group={group} setGroup={setGroup} /></section><section className="phase-schedule compact-phases">{PHASE_ORDER.map((phaseId) => { const phase = phaseFor(station, phaseId); const summary = phaseSummary(data, group, phaseId); const phaseMs = phaseMatches(data, group, phaseId); const rosterCount = data.mainRoster.filter((item) => item.group === group).length; const qualifier = phaseId.startsWith("qualifier"); const progress = qualifier && summary ? `${summary.entrantCount}人 → 晋级24人` : phaseId === "main-one" ? `64进32 · 正赛名单 ${rosterCount}/64` : "32进1 · 单败淘汰"; const note = !detailsReady ? "详细赛程正在后台预加载" : qualifier && summary ? `${summary.playoffMatchCount ? `附加赛${summary.playoffMatchCount}场 · ` : ""}${summary.byeCount ? `轮空${summary.byeCount}个 · ` : ""}${summary.divisionCount}个分区` : phaseId === "main-one" ? (phaseMs.length ? "8组双败签表与赛程已发布" : "正赛名单已就绪，签表待发布") : (phaseMs.length ? "32强签表与赛程已发布" : "等待32强产生后重新抽签"); return <article className="phase-card compact-phase" key={phaseId}><div className="phase-status-line"><b className={`phase-status status-${phase.status}`}>{phase.status}</b><time>{phase.date}</time></div><h2>{phase.title}</h2><h3>{progress}</h3><div className="phase-meta"><span>{qualifier ? "一次抽签到底 · 16区" : phaseId === "main-one" ? "8组双败" : "32强单败"}</span><span>{raceLabel(group, phaseId)}</span></div>{qualifier && <div className="qualify-rule"><strong>晋级24人</strong><span>16名分区冠军直接晋级</span><i>＋</i><span>决胜负者按局胜率取前8</span></div>}<footer><small>{note}</small><div className="public-phase-actions">{phaseId === "main-one" && rosterCount > 0 && <button className="roster" onClick={() => setShowRoster(true)}>查看正赛名单</button>}<button onClick={() => openDetail(phaseId)}>查看赛程表 <i>›</i></button></div></footer></article>; })}</section></div>;
}

function PublicMatches({ station, data }: { station: StationMeta; data: PublicCompetitionDisplayEvent }) {
  const [group, setGroup] = useState<Group>("少年组");
  const all = useMemo(() => data.matches.filter((match) => match.group === group && match.date), [data.matches, group]);
  const days = useMemo(() => [...new Set(all.map((match) => match.date!).filter(Boolean))].sort(), [all]);
  const defaultDay = latestAvailableDay(days);
  const [day, setDay] = useState(defaultDay);
  const selectedDay = days.includes(day) ? day : defaultDay;
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(40);
  const matches = useMemo(() => {
    const normalizedQuery = query.trim();
    return all.filter((match) => match.date === selectedDay && [match.playerA, match.playerB, match.table, match.roundName, match.matchCode].some((value) => (value ?? "").includes(normalizedQuery)));
  }, [all, query, selectedDay]);
  const visibleMatches = matches.slice(0, visibleCount);
  useEffect(() => { setVisibleCount(40); }, [group, selectedDay, query]);
  return <div className="match-list-page stack public-competition-overlay"><section className="match-list-head with-group compact-head"><div><small className="event-name-kicker">{station.title}</small><h1>对阵</h1><p>默认显示最近一个已有比赛的日期，可切换查看其它比赛日</p></div><GroupSwitch group={group} setGroup={setGroup} /></section><section className="match-filter"><nav className="match-days">{days.map((value) => <button className={selectedDay === value ? "active" : ""} onClick={() => setDay(value)} key={value}><small>{weekday(value)}</small><b>{compactDate(value)}</b></button>)}</nav><label><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索球员、球台或场次" /></label></section><div className="match-count"><strong>{selectedDay ? compactDate(selectedDay) : "—"}</strong><span>{group} · {matches.length}场对阵</span></div>{matches.length ? <><section className="versus-list">{visibleMatches.map((match) => <article className="versus-card" key={match.id}><header><b>{match.time || "待定"}</b><span>{PHASE_LABELS[match.phaseId]} · {match.roundName} · {displayMatchCode(match.matchCode, match.phaseId)}</span></header><section><div className="match-player"><i>{displayName(match.playerA, "待").slice(0, 1)}</i><strong>{displayName(match.playerA, "待定")}</strong></div><div className="match-center"><strong>{scoreLabel(match)}</strong><span className={matchStatus(match) === "已结束" ? "ended" : ""}>{matchStatus(match)}</span><b className={match.isTv ? "tv" : ""}>{match.table || "球台待定"}</b></div><div className="match-player"><i>{displayName(match.playerB, "待").slice(0, 1)}</i><strong>{displayName(match.playerB, "待定")}</strong></div></section></article>)}</section>{visibleMatches.length < matches.length && <div className="public-match-load-more"><button onClick={() => setVisibleCount((count) => Math.min(matches.length, count + 40))}>加载更多 <span>已显示{visibleMatches.length}/{matches.length}场</span></button></div>}</> : <section className="match-empty"><i>○</i><h2>当日对阵待公布</h2><p>该日期目前没有已发布的比赛，可切换其它日期查看。</p></section>}</div>;
}

function rankingNumberStyle(place: number): CSSProperties | undefined {
  if (place === 1) return { background: "linear-gradient(145deg,#f5d36c,#c99316)", color: "#fff", fontWeight: 900 };
  if (place === 2) return { background: "linear-gradient(145deg,#d9dde5,#8e96a4)", color: "#fff", fontWeight: 900 };
  if (place === 3) return { background: "linear-gradient(145deg,#d99a68,#9a5a36)", color: "#fff", fontWeight: 900 };
  if (place === 4) return { background: "linear-gradient(145deg,#7b52e8,#5122c0)", color: "#fff", fontWeight: 900 };
  return undefined;
}

function PublicRankings({ station, rankings }: { station: StationMeta; rankings: PublicRanking[] }) {
  const [group, setGroup] = useState<Group>("少年组"); const finalRows = rankings.filter((row) => row.group === group).sort((a, b) => a.displayOrder - b.displayOrder); const prizes = station.prizes[group] ?? [];
  return <div className="stack public-competition-overlay"><section className="ranking-head"><div><small className="event-name-kicker">{station.title}</small><h1>比赛排名</h1><p>{finalRows.length ? "组委会已发布本站正赛最终排名" : "最终排名待组委会确认并发布"}</p></div><GroupSwitch group={group} setGroup={setGroup} /></section><section className="card ranking"><header><div><small>{group}</small><h2>{finalRows.length ? "本站赛事排名" : "奖金设置"}</h2></div></header>{finalRows.length ? <div className="public-final-ranking">{finalRows.map((row) => <div key={row.id}><span style={rankingNumberStyle(row.displayOrder)}>{row.displayOrder}</span><b>{row.placementLabel}</b><strong>{row.playerName}</strong><em>{row.prizeDisplay || "—"}</em></div>)}</div> : <><div className="ranking-wait"><i /><div><strong>比赛结果尚未全部完成</strong><p>排名仅统计正赛最终名次。待组委会确认并发布本站排名后，这里会自动切换为正式排名。</p></div></div><div className="prizes">{prizes.map(([rank, amount], index) => <div key={`${rank}-${index}`}><span>{index + 1}</span><strong>{rank}</strong><b>{amount}</b></div>)}</div></>}</section></div>;
}

export default function PublicCompetitionLiveV2({ station, contentState, activeTab }: { station: StationMeta; contentState?: PublicContentState; activeTab: PublicCompetitionTab | null }) {
  const [summaryByEvent, setSummaryByEvent] = useState<Map<string, PublicCompetitionDisplayEvent>>(() => new Map([...summaryCache].map(([id, payload]) => [id, payload.event])));
  const [competitionByEvent, setCompetitionByEvent] = useState<Map<string, PublicCompetitionDisplayEvent>>(() => new Map([...competitionCache].map(([id, payload]) => [id, payload.event])));
  const [rankingsByEvent, setRankingsByEvent] = useState<Map<string, PublicRanking[]>>(() => new Map([...rankingsCache].map(([id, payload]) => [id, payload.rankings])));
  const [loadingSummaryId, setLoadingSummaryId] = useState("");
  const [loadingCompetitionId, setLoadingCompetitionId] = useState("");
  const [loadingRankingsId, setLoadingRankingsId] = useState("");
  const [loadError, setLoadError] = useState("");
  const summary = summaryByEvent.get(station.eventId);
  const competition = competitionByEvent.get(station.eventId);
  const rankings = rankingsByEvent.get(station.eventId);
  const published = activeTab ? Boolean(contentState?.publishedModules.includes(activeTab)) : false;

  const loadSummary = useCallback(async (eventId: string, force = false, requestedVersion = "") => {
    if (!force && summaryByEvent.has(eventId)) return;
    setLoadingSummaryId(eventId); setLoadError("");
    try {
      const payload = await requestSummary(eventId, force, requestedVersion);
      setSummaryByEvent((current) => new Map(current).set(eventId, payload.event));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "赛事摘要读取失败。");
    } finally {
      setLoadingSummaryId((current) => current === eventId ? "" : current);
    }
  }, [summaryByEvent]);

  const loadCompetition = useCallback(async (eventId: string, force = false, requestedVersion = "") => {
    if (!force && competitionByEvent.has(eventId)) return;
    setLoadingCompetitionId(eventId); setLoadError("");
    try {
      const payload = await requestCompetition(eventId, force, requestedVersion);
      setCompetitionByEvent((current) => new Map(current).set(eventId, payload.event));
      setSummaryByEvent((current) => new Map(current).set(eventId, { ...payload.event, matches: [] }));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "比赛数据读取失败。");
    } finally {
      setLoadingCompetitionId((current) => current === eventId ? "" : current);
    }
  }, [competitionByEvent]);

  const loadRankings = useCallback(async (eventId: string, force = false, requestedVersion = "") => {
    if (!force && rankingsByEvent.has(eventId)) return;
    setLoadingRankingsId(eventId); setLoadError("");
    try {
      const payload = await requestRankings(eventId, force, requestedVersion);
      setRankingsByEvent((current) => new Map(current).set(eventId, payload.rankings));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "排名数据读取失败。");
    } finally {
      setLoadingRankingsId((current) => current === eventId ? "" : current);
    }
  }, [rankingsByEvent]);

  useEffect(() => {
    if (document.getElementById("public-live-competition-v2-css")) return;
    const style = document.createElement("style");
    style.id = "public-live-competition-v2-css";
    style.textContent = liveCss;
    document.head.append(style);
  }, []);

  useEffect(() => {
    if (!activeTab || !published) return;
    const eventId = station.eventId;
    if (activeTab === "rankings") { void loadRankings(eventId); return; }
    if (activeTab === "matches") { void loadCompetition(eventId); return; }
    void loadSummary(eventId);
    void loadCompetition(eventId);
  }, [activeTab, loadCompetition, loadRankings, loadSummary, published, station.eventId]);

  useEffect(() => {
    if (!activeTab || !published) return;
    const eventId = station.eventId;
    const checkVersion = async () => {
      if (document.hidden) return;
      try {
        const response = await fetch(`/api/public/events/${encodeURIComponent(eventId)}/competition/version`, { cache: "no-store" });
        const payload = await response.json() as { data?: { version: string } };
        const nextVersion = payload.data?.version;
        const currentVersion = competitionVersions.get(eventId);
        if (!nextVersion || !currentVersion || nextVersion === currentVersion) {
          if (nextVersion && !currentVersion) competitionVersions.set(eventId, nextVersion);
          return;
        }
        if (activeTab === "rankings") await loadRankings(eventId, true, nextVersion);
        else if (activeTab === "matches") await loadCompetition(eventId, true, nextVersion);
        else {
          await loadSummary(eventId, true, nextVersion);
          if (competitionCache.has(eventId)) void loadCompetition(eventId, true, nextVersion);
        }
      } catch {
        // Keep the last published snapshot visible when a lightweight version check fails.
      }
    };
    const timer = window.setInterval(checkVersion, 20_000);
    const onVisibility = () => { if (!document.hidden) void checkVersion(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [activeTab, loadCompetition, loadRankings, loadSummary, published, station.eventId]);

  if (!activeTab) return null;

  if (!published) {
    const copy: Record<PublicCompetitionTab, { icon: string; title: string; description: string }> = {
      schedule: { icon: "赛", title: "本站赛程正在编排中", description: "待组委会确认后，将在这里发布完整的分阶段赛程。" },
      matches: { icon: "阵", title: "本站对阵尚未发布", description: "对阵确定后会在这里更新比赛时间、球台和参赛选手。" },
      rankings: { icon: "榜", title: "本站比赛排名待发布", description: "比赛结束并经组委会确认后，这里将显示正式排名和奖金信息。" },
    };
    const state = copy[activeTab];
    return <section className="public-module-state" role="status"><div><span>{state.icon}</span><h2>{state.title}</h2><p>{state.description}<br />感谢关注，最新信息会在确认后及时更新。</p></div></section>;
  }

  const retry = () => {
    if (activeTab === "rankings") void loadRankings(station.eventId, true);
    else if (activeTab === "matches") void loadCompetition(station.eventId, true);
    else void loadSummary(station.eventId, true);
  };

  if (activeTab === "rankings") {
    if (rankings === undefined || (loadingRankingsId === station.eventId && rankings === undefined)) {
      return <section className="public-module-state" aria-busy={!loadError}><div><span>{loadError ? "!" : "…"}</span><h2>{loadError || "正在加载本站排名"}</h2><p>{loadError ? "网络暂时没有响应，已发布内容不会受到影响。" : "排名数据独立加载，不需要等待赛程和对阵。"}</p>{loadError && <button onClick={retry}>重新加载</button>}</div></section>;
    }
    return <PublicRankings station={station} rankings={rankings} />;
  }

  if (activeTab === "schedule") {
    const scheduleData = competition ?? summary;
    if (!scheduleData || (loadingSummaryId === station.eventId && !summary && !competition)) {
      return <section className="public-module-state" aria-busy={!loadError}><div><span>{loadError ? "!" : "…"}</span><h2>{loadError || "正在加载赛程阶段"}</h2><p>{loadError ? "网络暂时没有响应，已发布内容不会受到影响。" : "先显示阶段摘要，详细赛程表会继续在后台预加载。"}</p>{loadError && <button onClick={retry}>重新加载</button>}</div></section>;
    }
    return <PublicSchedule station={station} data={competition ?? scheduleData} detailsReady={Boolean(competition)} ensureDetails={() => { void loadCompetition(station.eventId); }} />;
  }

  if (!competition || (loadingCompetitionId === station.eventId && !competition)) {
    return <section className="public-module-state" aria-busy={!loadError}><div><span>{loadError ? "!" : "…"}</span><h2>{loadError || "正在加载本站对阵"}</h2><p>{loadError ? "网络暂时没有响应，已发布内容不会受到影响。" : "比赛核心数据正在读取，请稍候。"}</p>{loadError && <button onClick={retry}>重新加载</button>}</div></section>;
  }
  return <PublicMatches station={station} data={competition} />;
}
