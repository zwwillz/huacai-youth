"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import type { Group, Phase, PhaseId, Station } from "./public-types";
import type { PublicCompetitionEvent, PublicLiveMatch, PublicPhaseSummary } from "@/db/public-competition-live";

type LiveTab = "schedule" | "matches" | "rankings";
type StationMeta = Pick<Station, "id" | "eventId" | "title" | "city" | "phases" | "format" | "prizes">;

const PHASE_ORDER: PhaseId[] = ["qualifier-one", "qualifier-two", "main-one", "main-two"];
const PHASE_LABELS: Record<PhaseId, string> = {
  "qualifier-one": "资格赛第一场",
  "qualifier-two": "资格赛第二场",
  "main-one": "正赛第一阶段",
  "main-two": "正赛第二阶段",
};

const liveCss = `
.public-competition-mode>.stack:not(.public-competition-overlay){display:none!important}
.public-live-stage-detail{display:flex;flex-direction:column;gap:14px}
.public-live-stage-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border:1px solid #ebe6ef;border-radius:14px;background:#fff}
.public-live-stage-toolbar>div{min-width:0}.public-live-stage-toolbar small{color:#82639e;font-size:8px;font-weight:900}.public-live-stage-toolbar h2{margin:4px 0 3px;font-size:18px}.public-live-stage-toolbar p{margin:0;color:#8d8492;font-size:9px}
.public-live-stage-toolbar label{min-width:250px;display:flex;align-items:center;gap:8px;padding:9px 11px;border:1px solid #e3ddea;border-radius:10px;background:#faf9fb}.public-live-stage-toolbar input{width:100%;border:0;outline:0;background:transparent;font-size:10px}
.public-live-summary{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}.public-live-summary article{padding:12px;border:1px solid #e7e1eb;border-radius:12px;background:#fff}.public-live-summary small{display:block;color:#918699;font-size:7px}.public-live-summary strong{display:block;margin-top:4px;font-size:18px}.public-live-summary span{color:#8c8191;font-size:8px}
.public-live-prelim,.public-live-division{padding:14px;border:1px solid #e6e0e9;border-radius:14px;background:#fff}.public-live-prelim>header,.public-live-division>header{display:flex;align-items:end;justify-content:space-between;gap:12px;margin-bottom:10px}.public-live-prelim h3,.public-live-division h3{margin:4px 0 0;font-size:14px}.public-live-prelim header small,.public-live-division header small{color:#8666a0;font-size:7px;font-weight:900}.public-live-prelim header span,.public-live-division header span{color:#8b8191;font-size:8px}
.public-live-rounds{display:grid;grid-template-columns:repeat(5,minmax(180px,1fr));gap:8px;overflow-x:auto;padding-bottom:4px}.public-live-round{min-width:180px}.public-live-round>h4{margin:0 0 7px;padding:7px 8px;border-radius:8px;color:#684290;background:#f4eff9;font-size:9px}.public-live-round-list{display:flex;flex-direction:column;gap:6px}
.public-live-round-list .stage-tree-match{position:relative!important;left:auto!important;top:auto!important;width:auto!important;min-height:0!important;padding:7px 8px!important;border:1px solid #e9e3ed!important;border-radius:9px!important;background:#fbfafc!important;box-shadow:none!important}.public-live-round-list .stage-tree-match.match-hit{outline:2px solid #9b65d5;background:#f4edfb!important}.public-live-round-list .stage-competitor{display:grid!important;grid-template-columns:28px minmax(0,1fr) 26px!important;align-items:center!important;gap:4px!important;min-height:21px!important;border:0!important;padding:0!important}.public-live-round-list .stage-competitor+.stage-between{margin:3px 0!important}.public-live-round-list .stage-slot{color:#987da9;font-size:7px}.public-live-round-list .stage-competitor span:not(.stage-slot){overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#32293a;font-size:9px;font-weight:700}.public-live-round-list .stage-competitor b{justify-self:end;color:#5f358d;font-size:10px}.public-live-round-list .stage-between{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:5px!important;color:#938799!important;font-size:7px!important}.public-live-round-list .stage-between span.tv{color:#d03e89;font-weight:900}.public-live-round-list .stage-game-no{display:block!important;margin-top:4px;color:#a093a8;font-size:6px!important;font-weight:700!important;text-align:right}
.public-live-prelim-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.public-live-prelim-grid .stage-tree-match{padding:8px;border:1px solid #e8e2ec;border-radius:9px;background:#fbfafc}
.public-live-roster-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-bottom:12px}.public-live-roster-summary article{padding:14px;border:1px solid #e8e2ec;border-radius:12px;background:#fff}.public-live-roster-summary small{display:block;color:#918696;font-size:7px}.public-live-roster-summary strong{display:block;margin-top:5px;font-size:21px}.public-live-roster-summary span{color:#867b8d;font-size:8px}.public-roster-groups{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.public-roster-group{padding:13px;border:1px solid #e8e2ec;border-radius:12px;background:#fff}.public-roster-group header{display:flex;justify-content:space-between;align-items:end;margin-bottom:9px}.public-roster-group h3{margin:3px 0 0;font-size:12px}.public-roster-group header span{color:#774f98;font-size:8px;font-weight:900}.public-roster-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}.public-roster-grid div{display:flex;align-items:center;gap:6px;min-width:0;padding:7px 8px;border-radius:8px;background:#f8f6fa}.public-roster-grid span{width:22px;color:#9b8ba5;font-size:7px}.public-roster-grid strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9px}
.public-live-ranking-note{margin-bottom:12px;padding:13px 14px;border-radius:12px;color:#5f3d83;background:#f1eafa;font-size:9px;line-height:1.7}.public-live-ranking-note strong{font-size:10px}
.public-live-day-status{display:inline-flex;padding:5px 8px;border-radius:999px;color:#287350;background:#e9f8f0;font-size:7px;font-weight:900}
.public-live-main-ready{padding:18px;border:1px solid #e4ddea;border-radius:15px;background:linear-gradient(145deg,#fff,#f6f0fb)}.public-live-main-ready h2{margin:5px 0 7px;font-size:19px}.public-live-main-ready p{margin:0;color:#817488;font-size:9px;line-height:1.7}.public-live-main-ready strong{color:#633891}
@media(max-width:1100px){.public-live-summary{grid-template-columns:repeat(3,minmax(0,1fr))}.public-live-prelim-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.public-roster-groups{grid-template-columns:1fr 1fr}}
@media(max-width:760px){.public-live-stage-toolbar{align-items:stretch;flex-direction:column}.public-live-stage-toolbar label{min-width:0}.public-live-summary{grid-template-columns:1fr 1fr}.public-live-prelim-grid{grid-template-columns:1fr}.public-roster-groups{grid-template-columns:1fr}.public-live-roster-summary{grid-template-columns:1fr 1fr}.public-live-rounds{grid-template-columns:repeat(5,190px)}}
`;

function GroupSwitch({ group, setGroup }: { group: Group; setGroup: (group: Group) => void }) {
  return <div className="group-switch" aria-label="选择比赛组别">
    <button className={group === "少年组" ? "active" : ""} onClick={() => setGroup("少年组")}><b>U16</b><span>少年组</span></button>
    <button className={group === "青年组" ? "active" : ""} onClick={() => setGroup("青年组")}><b>U20</b><span>青年组</span></button>
  </div>;
}

function shortDate(value: string | null) {
  if (!value) return "时间待定";
  const [, month, day] = value.split("-");
  return month && day ? `${Number(month)}月${Number(day)}日` : value;
}
function compactDate(value: string) {
  const [, month, day] = value.split("-");
  return month && day ? `${month}-${day}` : value;
}
function weekday(value: string) {
  const labels = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const date = new Date(`${value}T12:00:00+08:00`);
  return Number.isNaN(date.getTime()) ? "" : labels[date.getDay()];
}
function scoreLabel(match: PublicLiveMatch) {
  if (match.status === "auto_advanced") return "轮空";
  if (match.scoreA == null || match.scoreB == null) return "— : —";
  return `${match.scoreA} : ${match.scoreB}`;
}
function matchStatus(match: PublicLiveMatch) {
  if (match.status === "auto_advanced") return "自动晋级";
  if (match.resultStatus === "confirmed") return "已结束";
  if (match.resultStatus === "submitted") return "待确认";
  return "待开始";
}
function phaseFor(station: StationMeta, id: PhaseId): Phase {
  return station.phases.find((item) => item.id === id) ?? { id, number: String(PHASE_ORDER.indexOf(id) + 1).padStart(2, "0"), title: PHASE_LABELS[id], date: "待公布", status: "待开始" };
}
function phaseSummary(data: PublicCompetitionEvent, group: Group, phaseId: PhaseId) {
  return data.phaseSummaries.find((item) => item.group === group && item.phaseId === phaseId);
}
function phaseMatches(data: PublicCompetitionEvent, group: Group, phaseId: PhaseId) {
  return data.matches.filter((item) => item.group === group && item.phaseId === phaseId);
}
function raceLabel(group: Group, phase: PhaseId) {
  if (phase.startsWith("qualifier")) return group === "少年组" ? "9局5胜" : "13局7胜";
  if (phase === "main-one") return group === "少年组" ? "13局7胜" : "17局9胜";
  return group === "少年组" ? "17局9胜" : "21局11胜";
}

function StageMatchCard({ match, query }: { match: PublicLiveMatch; query: string }) {
  const q = query.trim().toLowerCase();
  const hit = Boolean(q) && [match.playerA, match.playerB, match.table, match.matchCode].some((value) => (value ?? "").toLowerCase().includes(q));
  const showSlots = match.roundNo === 1;
  return <article className={`stage-tree-match${hit ? " match-hit" : ""}`} data-public-live-hit={hit ? "true" : undefined}>
    <div className="stage-competitor">
      <span className="stage-slot">{showSlots && match.sourceAType === "slot" ? String(match.sourceARef ?? "").padStart(3, "0") : ""}</span>
      <span>{match.playerA || "待定"}</span><b>{match.status === "auto_advanced" ? "✓" : match.scoreA ?? "—"}</b>
    </div>
    <div className="stage-between"><time>{match.date ? `${shortDate(match.date)} ${match.time ?? ""}` : match.status === "auto_advanced" ? "自动晋级" : "时间待定"}</time><span className={match.isTv ? "tv" : ""}>{match.table || (match.status === "auto_advanced" ? "轮空" : "球台待定")}</span></div>
    <div className="stage-competitor">
      <span className="stage-slot">{showSlots && match.sourceBType === "slot" ? String(match.sourceBRef ?? "").padStart(3, "0") : ""}</span>
      <span>{match.playerB || (match.status === "auto_advanced" ? "轮空" : "待定")}</span><b>{match.status === "auto_advanced" ? "—" : match.scoreB ?? "—"}</b>
    </div>
    <b className="stage-game-no">{match.matchCode}</b>
  </article>;
}

function QualifierStageDetail({ station, data, group, setGroup, phaseId, onBack }: { station: StationMeta; data: PublicCompetitionEvent; group: Group; setGroup: (group: Group) => void; phaseId: PhaseId; onBack: () => void }) {
  const [query, setQuery] = useState("");
  const summary = phaseSummary(data, group, phaseId);
  const matches = phaseMatches(data, group, phaseId);
  const prelim = matches.filter((item) => item.divisionNo == null);
  const divisions = summary?.divisionCount ?? 16;

  useEffect(() => {
    if (!query.trim()) return;
    const timer = window.setTimeout(() => document.querySelector<HTMLElement>('[data-public-live-hit="true"]')?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
    return () => window.clearTimeout(timer);
  }, [query, group, phaseId]);

  return <div className="bracket-page stack public-live-stage-detail">
    <button className="draw-back" onClick={onBack}>‹ 返回赛程阶段</button>
    <section className="bracket-title with-group compact-head"><div><small className="event-name-kicker">{station.title}</small><h1>{PHASE_LABELS[phaseId]}</h1><p>本阶段16个分区集中在同一张赛程表中，按原前端设计显示签位、比分、时间、台号和场次。</p></div><GroupSwitch group={group} setGroup={setGroup}/></section>
    <section className="public-live-stage-toolbar"><div><small>{group} · 详细赛程表</small><h2>{PHASE_LABELS[phaseId]}</h2><p>{summary ? `${summary.entrantCount}人参赛 · ${summary.divisionCount}区 · 每区${summary.divisionSize}人 · ${raceLabel(group, phaseId)}` : "赛程数据待公布"}</p></div><label><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索球员、球台或场次" /></label></section>
    {summary && <section className="public-live-summary">
      <article><small>实际参赛</small><strong>{summary.entrantCount}</strong><span>人</span></article>
      <article><small>附加赛</small><strong>{summary.playoffMatchCount}</strong><span>场</span></article>
      <article><small>轮空</small><strong>{summary.byeCount}</strong><span>个</span></article>
      <article><small>分区</small><strong>{summary.divisionCount}</strong><span>{summary.divisionSize}人 / 区</span></article>
      <article><small>晋级</small><strong>{summary.totalQualifierCount}</strong><span>{summary.directQualifierCount}直晋 + {summary.rateQualifierCount}增补</span></article>
    </section>}
    {prelim.length > 0 && <section className="public-live-prelim"><header><div><small>PLAY-IN</small><h3>附加赛</h3></div><span>{prelim.length} 场 · 胜者进入512标准签表</span></header><div className="public-live-prelim-grid public-live-round-list">{prelim.map((match) => <StageMatchCard key={match.id} match={match} query={query} />)}</div></section>}
    {Array.from({ length: divisions }, (_, index) => index + 1).map((division) => {
      const divisionMatches = matches.filter((item) => item.divisionNo === division);
      const roundNos = [...new Set(divisionMatches.map((item) => item.roundNo))].sort((a, b) => a - b);
      const final = divisionMatches.find((item) => item.roundNo === Math.max(...roundNos));
      return <section className="public-live-division" key={division}><header><div><small>DIVISION {String(division).padStart(2, "0")}</small><h3>第{division}区</h3></div><span>{final?.winnerPlayerName ? `分区冠军：${final.winnerPlayerName}` : "分区冠军待定"}</span></header><div className="public-live-rounds">{roundNos.map((roundNo) => {
        const roundMatches = divisionMatches.filter((item) => item.roundNo === roundNo);
        return <div className="public-live-round" key={roundNo}><h4>{roundMatches[0]?.roundName || `第${roundNo}轮`}</h4><div className="public-live-round-list">{roundMatches.map((match) => <StageMatchCard key={match.id} match={match} query={query} />)}</div></div>;
      })}</div></section>;
    })}
  </div>;
}

function MainRosterDetail({ station, data, group, setGroup, onBack }: { station: StationMeta; data: PublicCompetitionEvent; group: Group; setGroup: (group: Group) => void; onBack: () => void }) {
  const roster = data.mainRoster.filter((item) => item.group === group).sort((a, b) => a.sortOrder - b.sortOrder);
  const q1 = roster.filter((item) => item.sourceType === "qualifier_one_qualified");
  const q2 = roster.filter((item) => item.sourceType === "qualifier_two_qualified");
  const seeds = roster.filter((item) => item.sourceType === "seed");
  return <div className="bracket-page stack public-live-stage-detail"><button className="draw-back" onClick={onBack}>‹ 返回赛程阶段</button><section className="bracket-title with-group compact-head"><div><small className="event-name-kicker">{station.title}</small><h1>正赛第一阶段</h1><p>资格赛已结束，正赛64人名单已经产生；8月8日开始正赛。</p></div><GroupSwitch group={group} setGroup={setGroup}/></section><section className="public-live-main-ready"><small>MAIN DRAW · 64</small><h2><strong>{roster.length}/64</strong> 正赛名单已就绪</h2><p>两场资格赛各晋级24人，共48人；另有16名种子选手进入正赛。当前仅展示正赛名单，正式双败签表将在正赛抽签完成后发布。</p></section><section className="public-roster-groups">{[["资格赛第一场晋级", q1], ["资格赛第二场晋级", q2], ["种子选手", seeds]].map(([title, values]) => <article className="public-roster-group" key={String(title)}><header><div><small>MAIN ROSTER</small><h3>{String(title)}</h3></div><span>{(values as typeof roster).length}人</span></header><div className="public-roster-grid">{(values as typeof roster).map((player, index) => <div key={player.playerId}><span>{String(index + 1).padStart(2, "0")}</span><strong>{player.playerName}</strong></div>)}</div></article>)}</section></div>;
}

function PublicSchedule({ station, data }: { station: StationMeta; data: PublicCompetitionEvent }) {
  const [group, setGroup] = useState<Group>("少年组");
  const [detailPhase, setDetailPhase] = useState<PhaseId | null>(null);
  if (detailPhase?.startsWith("qualifier")) return <QualifierStageDetail station={station} data={data} group={group} setGroup={setGroup} phaseId={detailPhase} onBack={() => setDetailPhase(null)} />;
  if (detailPhase === "main-one") return <MainRosterDetail station={station} data={data} group={group} setGroup={setGroup} onBack={() => setDetailPhase(null)} />;

  return <div className="schedule-page stack public-competition-overlay"><section className="schedule-head with-group compact-head"><div><small className="event-name-kicker">{station.title}</small><h1>赛程</h1><p>按比赛阶段查看完整赛程表</p></div><GroupSwitch group={group} setGroup={setGroup}/></section><section className="phase-schedule compact-phases">{PHASE_ORDER.map((phaseId) => {
    const phase = phaseFor(station, phaseId);
    const summary = phaseSummary(data, group, phaseId);
    const rosterCount = phaseId === "main-one" ? data.mainRoster.filter((item) => item.group === group).length : 0;
    const qualifier = phaseId.startsWith("qualifier");
    const progress = qualifier && summary ? `${summary.entrantCount}人 → 16名分区冠军 · 晋级24人` : phaseId === "main-one" ? `64进32 · 正赛名单 ${rosterCount}/64` : "32进1 · 单败淘汰";
    const note = qualifier && summary ? `${summary.playoffMatchCount ? `附加赛${summary.playoffMatchCount}场 · ` : ""}${summary.byeCount ? `轮空${summary.byeCount}个 · ` : ""}${summary.divisionCount}个分区` : phaseId === "main-one" ? "8月8日开赛 · 64人分8组双败" : "正赛第一阶段结束后发布完整签表";
    const canOpen = Boolean(summary) || (phaseId === "main-one" && rosterCount > 0);
    return <article className="phase-card compact-phase" key={phaseId}><div className="phase-status-line"><b className={`phase-status status-${phase.status}`}>{phase.status}</b><time>{phase.date}</time></div><h2>{phase.title}</h2><h3>{progress}</h3><div className="phase-meta"><span>{qualifier ? "一次抽签到底 · 16区" : phaseId === "main-one" ? "8组双败" : "32强至冠军"}</span><span>{raceLabel(group, phaseId)}</span></div>{qualifier && <div className="qualify-rule"><strong>晋级24人</strong><span>16名分区冠军直接晋级</span><i>＋</i><span>分区决胜负者按局胜率取前8</span></div>}<footer><small>{note}</small><button disabled={!canOpen} onClick={() => canOpen && setDetailPhase(phaseId)}>{phaseId === "main-one" ? "查看正赛名单" : canOpen ? "查看赛程表" : "赛程待发布"} <i>›</i></button></footer></article>;
  })}</section></div>;
}

function PublicMatches({ station, data }: { station: StationMeta; data: PublicCompetitionEvent }) {
  const [group, setGroup] = useState<Group>("少年组");
  const all = useMemo(() => data.matches.filter((item) => item.group === group && item.date && item.status !== "auto_advanced"), [data.matches, group]);
  const days = useMemo(() => [...new Set(all.map((item) => item.date as string))].sort(), [all]);
  const [day, setDay] = useState(days.at(-1) || "");
  const [query, setQuery] = useState("");
  useEffect(() => { setDay(days.at(-1) || ""); }, [group, days.join("|")]);
  const matches = all.filter((match) => match.date === day && [match.playerA, match.playerB, match.table, match.matchCode, match.roundName].some((item) => (item ?? "").includes(query.trim())));
  return <div className="match-list-page stack public-competition-overlay"><section className="match-list-head with-group compact-head"><div><small className="event-name-kicker">{station.title}</small><h1>对阵</h1><p>按日期查看当天对阵、比分和球台</p></div><GroupSwitch group={group} setGroup={setGroup}/></section><section className="match-filter"><nav className="match-days">{days.map((value) => <button className={day === value ? "active" : ""} onClick={() => setDay(value)} key={value}><small>{weekday(value)}</small><b>{compactDate(value)}</b></button>)}</nav><label><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索球员、球台或场次" /></label></section><div className="match-count"><strong>{day ? compactDate(day) : "—"}</strong><span>{group} · {matches.length}场对阵</span></div>{matches.length ? <section className="versus-list">{matches.map((match) => <article className="versus-card" key={match.id}><header><b>{match.time || "待定"}</b><span>{PHASE_LABELS[match.phaseId]} · {match.roundName} · {match.matchCode}</span></header><section><div className="match-player"><i>{(match.playerA || "待").slice(0, 1)}</i><strong>{match.playerA || "待定"}</strong></div><div className="match-center"><strong>{scoreLabel(match)}</strong><span className={matchStatus(match) === "已结束" ? "ended" : ""}>{matchStatus(match)}</span><b className={match.isTv ? "tv" : ""}>{match.table || "球台待定"}</b></div><div className="match-player"><i>{(match.playerB || "待").slice(0, 1)}</i><strong>{match.playerB || "待定"}</strong></div></section></article>)}</section> : <section className="match-empty"><i>○</i><h2>当日对阵待公布</h2><p>{group}该日期的球员、比分和球台信息将在组委会确认后更新。</p></section>}</div>;
}

function PublicRankings({ station, data }: { station: StationMeta; data: PublicCompetitionEvent }) {
  const [group, setGroup] = useState<Group>("少年组");
  const roster = data.mainRoster.filter((item) => item.group === group).sort((a, b) => a.sortOrder - b.sortOrder);
  const q1 = roster.filter((item) => item.sourceType === "qualifier_one_qualified");
  const q2 = roster.filter((item) => item.sourceType === "qualifier_two_qualified");
  const seeds = roster.filter((item) => item.sourceType === "seed");
  return <div className="stack public-competition-overlay"><section className="ranking-head"><div><small className="event-name-kicker">{station.title}</small><h1>比赛排名</h1><p>资格赛已经结束；正赛尚未开始，当前先公布资格赛晋级和64人正赛名单。</p></div><GroupSwitch group={group} setGroup={setGroup}/></section><section className="public-live-ranking-note"><strong>当前赛事状态：资格赛已结束，明日开始正赛。</strong><br/>最终冠军、亚军、季军、殿军及32强排名将在正赛赛果确认后更新；现在展示的是晋级状态，不提前生成最终排名。</section><section className="public-live-roster-summary"><article><small>资格赛第一场</small><strong>{q1.length}</strong><span>晋级</span></article><article><small>资格赛第二场</small><strong>{q2.length}</strong><span>晋级</span></article><article><small>种子</small><strong>{seeds.length}</strong><span>正赛入位</span></article><article><small>正赛名单</small><strong>{roster.length}</strong><span>/ 64人</span></article></section><section className="public-roster-groups">{[["第一场晋级", q1], ["第二场晋级", q2], ["种子选手", seeds]].map(([title, values]) => <article className="public-roster-group" key={String(title)}><header><div><small>{group}</small><h3>{String(title)}</h3></div><span>{(values as typeof roster).length}人</span></header><div className="public-roster-grid">{(values as typeof roster).map((player, index) => <div key={player.playerId}><span>{String(index + 1).padStart(2, "0")}</span><strong>{player.playerName}</strong></div>)}</div></article>)}</section><section className="card ranking" style={{ marginTop: 12 }}><header><div><small>{group}</small><h2>奖金与最终名次</h2></div></header><div className="ranking-wait"><i/><div><strong>正赛尚未开始</strong><p>最终排名将在正赛结果确认后自动生成。</p></div></div><div className="prizes">{station.prizes[group].map(([rank, amount], index) => <div key={rank}><span>{index + 1}</span><strong>{rank}</strong><b>{amount}</b></div>)}</div></section></div>;
}

function CompetitionOverlay({ tab, station, data }: { tab: LiveTab; station: StationMeta; data: PublicCompetitionEvent }) {
  if (tab === "schedule") return <PublicSchedule station={station} data={data} />;
  if (tab === "matches") return <PublicMatches station={station} data={data} />;
  return <PublicRankings station={station} data={data} />;
}

export default function PublicCompetitionLiveEnhancer({ stations, competitions }: { stations: StationMeta[]; competitions: PublicCompetitionEvent[] }) {
  const [currentStationId, setCurrentStationId] = useState("");
  const [activeTab, setActiveTab] = useState<LiveTab | null>(null);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const competitionByEvent = useMemo(() => new Map(competitions.map((item) => [item.eventId, item])), [competitions]);
  const stationById = useMemo(() => new Map(stations.map((item) => [item.id, item])), [stations]);
  const station = stationById.get(currentStationId);
  const competition = station ? competitionByEvent.get(station.eventId) : undefined;

  useEffect(() => {
    if (!document.getElementById("public-live-competition-styles")) {
      const style = document.createElement("style"); style.id = "public-live-competition-styles"; style.textContent = liveCss; document.head.append(style);
    }
    let lastStation = "";
    const detect = () => {
      const hero = document.querySelector<HTMLElement>(".station-hero");
      const stationClass = hero ? Array.from(hero.classList).find((name) => name.startsWith("station-") && name !== "station-hero") : undefined;
      const nextStation = stationClass?.slice("station-".length) ?? "";
      if (nextStation !== lastStation) {
        lastStation = nextStation;
        setCurrentStationId(nextStation);
        setActiveTab(null);
      }
      const meta = stationById.get(nextStation);
      const live = meta ? competitionByEvent.get(meta.eventId) : undefined;
      const tabs = document.querySelector<HTMLElement>(".tabs");
      const content = document.querySelector<HTMLElement>(".content");
      setTarget((current) => current === content ? current : content);
      document.querySelectorAll<HTMLElement>("[data-public-comp-tab],[data-public-comp-action]").forEach((element) => {
        if (!live && element.isConnected) element.remove();
      });
      if (!live || !tabs) return;
      ([['schedule','赛程'],['matches','对阵'],['rankings','排名']] as Array<[LiveTab,string]>).forEach(([id,label]) => {
        if (tabs.querySelector(`[data-public-comp-tab="${id}"]`)) return;
        const button = document.createElement("button"); button.type = "button"; button.dataset.publicCompTab = id; button.textContent = label; tabs.appendChild(button);
      });
      const heroButtons = document.querySelector<HTMLElement>(".station-hero .hero-buttons");
      if (heroButtons && !heroButtons.querySelector('[data-public-comp-action="schedule"]')) {
        const button = document.createElement("button"); button.type = "button"; button.dataset.publicCompAction = "schedule"; button.textContent = "查看赛程"; heroButtons.prepend(button);
      }
      const introActions = document.querySelector<HTMLElement>(".introduction .inline-actions");
      if (introActions && !introActions.querySelector('[data-public-comp-action="schedule"]')) {
        const button = document.createElement("button"); button.type = "button"; button.dataset.publicCompAction = "schedule"; button.textContent = "查看分阶段赛程"; introActions.appendChild(button);
      }
    };
    const click = (event: MouseEvent) => {
      const element = event.target as Element | null;
      const liveButton = element?.closest<HTMLElement>("[data-public-comp-tab],[data-public-comp-action]");
      if (liveButton) {
        const id = (liveButton.dataset.publicCompTab || liveButton.dataset.publicCompAction) as LiveTab;
        if (id) { event.preventDefault(); event.stopPropagation(); setActiveTab(id); window.scrollTo({ top: 0, behavior: "smooth" }); }
        return;
      }
      const normalTab = element?.closest<HTMLElement>(".tabs button");
      if (normalTab && !normalTab.dataset.publicCompTab) setActiveTab(null);
    };
    document.addEventListener("click", click, true);
    const observer = new MutationObserver(detect); observer.observe(document.body, { childList: true, subtree: true }); detect();
    const timer = window.setInterval(detect, 300);
    return () => { document.removeEventListener("click", click, true); observer.disconnect(); window.clearInterval(timer); document.querySelector<HTMLElement>(".content")?.classList.remove("public-competition-mode"); };
  }, [competitionByEvent, stationById]);

  useEffect(() => {
    const content = document.querySelector<HTMLElement>(".content");
    if (!content) return;
    content.classList.toggle("public-competition-mode", Boolean(activeTab && competition));
    const tabs = content.querySelector<HTMLElement>(".tabs");
    if (activeTab && tabs) {
      tabs.querySelectorAll("button").forEach((button) => button.classList.toggle("active", (button as HTMLElement).dataset.publicCompTab === activeTab));
    }
  }, [activeTab, competition]);

  if (!target || !station || !competition || !activeTab) return null;
  return createPortal(<CompetitionOverlay tab={activeTab} station={station} data={competition} />, target);
}
