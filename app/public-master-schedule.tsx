"use client";

import { useMemo, useState } from "react";
import type { PublicContentState } from "@/db/public-content";
import type { PublicCompetitionEvent, PublicLiveMatch } from "@/db/public-competition-live";
import type { Group, PhaseId, Station } from "./public-types";

const css = `
.public-master-schedule{display:flex;flex-direction:column;gap:18px}.public-master-schedule .master-schedule-note{padding:10px 15px;border:1px solid #e7e0ef;border-radius:13px;color:#7c7085;background:#fbf9fd;font-size:9px;line-height:1.7}.public-master-schedule .master-schedule-note strong{color:#5c348e}.public-master-schedule .phase-meta{display:flex;gap:7px;flex-wrap:wrap}.public-master-schedule .phase-meta span{padding:5px 8px;border-radius:999px;color:#613896;background:#f0ebf8;font-size:8px;font-weight:800}.public-master-schedule .master-qualification{margin-top:13px;padding:11px 12px;border-radius:11px;color:#6f6177;background:#f8f5fa;font-size:9px;line-height:1.7}.public-master-schedule .master-qualification strong{display:block;margin-bottom:3px;color:#4f2b85;font-size:8px}.public-master-schedule .compact-phase>footer{margin-top:15px}.public-master-detail-list{display:flex;flex-direction:column;gap:8px}.public-master-detail-row{padding:13px 15px;border:1px solid #e8e3ed;border-radius:13px;background:#fff;display:grid;grid-template-columns:125px minmax(0,1fr) 105px;gap:14px;align-items:center}.public-master-detail-row time{font-size:10px;font-weight:900}.public-master-detail-row time small{display:block;margin-top:3px;color:#8b8290;font-size:8px;font-weight:500}.public-master-detail-row>div{min-width:0}.public-master-detail-row>div>small{display:block;color:#897d90;font-size:7px}.public-master-detail-row>div>strong{display:block;margin-top:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px}.public-master-detail-row>div>span{display:block;margin-top:4px;color:#6a5d71;font-size:8px}.public-master-detail-row>b{padding:7px 8px;border-radius:9px;color:#5d3890;background:#f0ebf7;text-align:center;font-size:8px}.public-master-detail-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}.public-master-detail-head h1{margin:5px 0 4px;font-size:27px}.public-master-detail-head p{margin:0;color:#827789;font-size:10px}.public-master-detail-head>button{border:0;background:transparent;color:#6637a4;font-size:10px;font-weight:900;cursor:pointer}.public-master-empty{min-height:260px;padding:30px;border:1px solid #e5deed;border-radius:18px;background:linear-gradient(145deg,#fff,#f8f4fb);display:grid;place-items:center;text-align:center}.public-master-empty>div{max-width:460px}.public-master-empty span{width:50px;height:50px;margin:0 auto 13px;border-radius:15px;color:#fff;background:linear-gradient(145deg,#6834ce,#d9469b);display:grid;place-items:center;font-size:17px;font-weight:900}.public-master-empty h2{margin:0 0 8px;font-size:19px}.public-master-empty p{margin:0;color:#817589;font-size:10px;line-height:1.8}.public-master-empty button{margin-top:15px;padding:9px 15px;border:0;border-radius:999px;color:#fff;background:#6034aa;font-size:9px;font-weight:900;cursor:pointer}@media(max-width:700px){.public-master-detail-row{grid-template-columns:1fr;gap:7px}.public-master-detail-row>b{justify-self:start}.public-master-detail-head{flex-direction:column-reverse}.public-master-detail-head>button{padding:0}}
`;

type DetailPayload = { version: string; event: PublicCompetitionEvent };

function GroupSwitch({ group, setGroup }: { group: Group; setGroup: (group: Group) => void }) {
  return <div className="group-switch" aria-label="选择比赛组别"><button className={group === "少年组" ? "active" : ""} onClick={() => setGroup("少年组")}><b>U16</b><span>少年组</span></button><button className={group === "青年组" ? "active" : ""} onClick={() => setGroup("青年组")}><b>U20</b><span>青年组</span></button></div>;
}

function phaseMeta(station: Station, phaseId: string) {
  return station.phases.find((phase) => phase.id === phaseId) ?? null;
}

function matchDate(match: PublicLiveMatch) {
  if (!match.date) return "日期待定";
  const [, month, day] = match.date.split("-");
  return month && day ? `${Number(month)}月${Number(day)}日` : match.date;
}

function detailMatchLabel(match: PublicLiveMatch) {
  if (match.matchCode) return match.matchCode;
  return match.roundName || "比赛场次";
}

export default function PublicMasterSchedule({ station, contentState }: { station: Station; contentState?: PublicContentState }) {
  const [group, setGroup] = useState<Group>("少年组");
  const [detailCode, setDetailCode] = useState<PhaseId | null>(null);
  const [detailPayload, setDetailPayload] = useState<DetailPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const master = contentState?.masterSchedule;
  const stages = master?.stages ?? [];
  const masterPublished = Boolean(master?.published && stages.length);
  const detailedPublished = Boolean(master?.detailedScheduleReady);
  const detailStage = detailCode ? stages.find((stage) => stage.code === detailCode) : undefined;
  const detailMatches = useMemo(() => detailPayload?.event.matches.filter((match) => match.group === group && match.phaseId === detailCode) ?? [], [detailPayload, detailCode, group]);

  const openDetail = async (phaseId: PhaseId) => {
    setDetailCode(phaseId); setError("");
    if (!detailedPublished || detailPayload) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/public/events/${encodeURIComponent(station.eventId)}/competition/matches`);
      const payload = await response.json() as { data?: DetailPayload; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || "详细赛程读取失败。");
      setDetailPayload(payload.data);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "详细赛程读取失败。");
    } finally { setLoading(false); }
  };

  if (!contentState) return <section className="public-master-empty"><div><span>…</span><h2>正在读取本站赛程</h2><p>赛事页面已经打开，分阶段主赛程正在后台补齐。</p></div></section>;
  if (!masterPublished) return <section className="public-master-empty"><div><span>赛</span><h2>本站赛程正在编排中</h2><p>待组委会确认后，将在这里发布资格赛和正赛的阶段时间、赛制与晋级说明。</p></div></section>;

  if (detailCode) {
    if (!detailedPublished) return <div className="public-master-schedule"><style>{css}</style><button className="draw-back" onClick={() => setDetailCode(null)}>‹ 返回赛程阶段</button><section className="public-master-empty"><div><span>编</span><h2>{detailStage?.title || "本阶段"}详细赛程正在编排中</h2><p>阶段时间和赛制已经公布；具体签表、比赛场次、球台和对阵将在竞赛执行确认并发布后显示。</p><button onClick={() => setDetailCode(null)}>返回阶段赛程</button></div></section></div>;
    if (loading) return <div className="public-master-schedule"><style>{css}</style><button className="draw-back" onClick={() => setDetailCode(null)}>‹ 返回赛程阶段</button><section className="public-master-empty"><div><span>…</span><h2>正在读取详细赛程</h2><p>正在从竞赛执行已发布的数据中读取本阶段签表和场次。</p></div></section></div>;
    if (error) return <div className="public-master-schedule"><style>{css}</style><button className="draw-back" onClick={() => setDetailCode(null)}>‹ 返回赛程阶段</button><section className="public-master-empty"><div><span>!</span><h2>详细赛程暂时没有读取成功</h2><p>{error}</p><button onClick={() => { setDetailPayload(null); void openDetail(detailCode); }}>重新读取</button></div></section></div>;
    if (!detailMatches.length) return <div className="public-master-schedule"><style>{css}</style><button className="draw-back" onClick={() => setDetailCode(null)}>‹ 返回赛程阶段</button><section className="public-master-empty"><div><span>编</span><h2>{detailStage?.title || "本阶段"}详细赛程正在编排中</h2><p>竞赛执行已经开放赛程发布，但本阶段目前还没有可展示的具体场次。组委会确认后会自动更新。</p></div></section></div>;
    return <div className="public-master-schedule"><style>{css}</style><section className="public-master-detail-head"><div><small className="event-name-kicker">{station.title}</small><h1>{detailStage?.title || "详细赛程"}</h1><p>{group} · 已发布具体场次</p></div><GroupSwitch group={group} setGroup={setGroup} /><button onClick={() => setDetailCode(null)}>‹ 返回阶段赛程</button></section><section className="public-master-detail-list">{detailMatches.map((match) => <article className="public-master-detail-row" key={match.id}><time>{matchDate(match)}<small>{match.time || "时间待定"}</small></time><div><small>{match.roundName || detailMatchLabel(match)}</small><strong>{match.playerA || "待定"}　VS　{match.playerB || "待定"}</strong><span>{detailMatchLabel(match)}</span></div><b>{match.table || "球台待定"}</b></article>)}</section></div>;
  }

  return <div className="schedule-page stack public-master-schedule"><style>{css}</style><section className="schedule-head with-group compact-head"><div><small className="event-name-kicker">{station.title}</small><h1>赛程</h1><p>按比赛阶段查看主赛程与已发布的详细赛程表</p></div><GroupSwitch group={group} setGroup={setGroup} /></section><div className="master-schedule-note"><strong>赛事主赛程：</strong>阶段时间、赛制与晋级规则由组委会统一发布；具体签表和场次由竞赛执行单独确认。</div><section className="phase-schedule compact-phases">{stages.map((stage) => { const phase = phaseMeta(station, stage.code); const race = group === "少年组" ? stage.u16RaceLabel : stage.u20RaceLabel; return <article className="phase-card compact-phase" key={stage.code}><div className="phase-status-line"><b className={`phase-status status-${phase?.status || "待开始"}`}>{phase?.status || "待开始"}</b><time>{stage.dateLabel || phase?.date || "时间待定"}</time></div><h2>{stage.title}</h2><h3>{stage.advancementText}</h3><div className="phase-meta">{stage.tags.map((tag) => <span key={tag}>{tag}</span>)}{race && <span>{race}</span>}</div>{stage.qualificationNote && <div className="master-qualification"><strong>晋级说明</strong>{stage.qualificationNote}</div>}<footer><small>{detailedPublished ? "具体赛程表按竞赛执行已发布内容显示" : "具体签表与场次正在竞赛执行中编排"}</small><div className="public-phase-actions"><button onClick={() => void openDetail(stage.code as PhaseId)}>查看赛程表 <i>›</i></button></div></footer></article>; })}</section></div>;
}
