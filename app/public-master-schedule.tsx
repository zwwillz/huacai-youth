"use client";

import { useState } from "react";
import type { PublicContentState } from "@/db/public-content";
import type { ScheduleGroup } from "@/db/schedule-publish";
import type { Station } from "./public-types";
import PublicCompetitionLiveV2 from "./public-competition-live-v2";

const css = `
.public-master-schedule{display:flex;flex-direction:column;gap:18px}.public-master-schedule .master-schedule-note{padding:10px 15px;border:1px solid #e7e0ef;border-radius:13px;color:#7c7085;background:#fbf9fd;font-size:9px;line-height:1.7}.public-master-schedule .master-schedule-note strong{color:#5c348e}.public-master-schedule .phase-meta{display:flex;gap:7px;flex-wrap:wrap}.public-master-schedule .phase-meta span{padding:5px 8px;border-radius:999px;color:#613896;background:#f0ebf8;font-size:8px;font-weight:800}.public-master-schedule .master-qualification{margin-top:13px;padding:11px 12px;border-radius:11px;color:#6f6177;background:#f8f5fa;font-size:9px;line-height:1.7}.public-master-schedule .master-qualification strong{display:block;margin-bottom:3px;color:#4f2b85;font-size:8px}.public-master-schedule .compact-phase>footer{margin-top:15px}.public-master-empty{min-height:260px;padding:30px;border:1px solid #e5deed;border-radius:18px;background:linear-gradient(145deg,#fff,#f8f4fb);display:grid;place-items:center;text-align:center}.public-master-empty>div{max-width:460px}.public-master-empty span{width:50px;height:50px;margin:0 auto 13px;border-radius:15px;color:#fff;background:linear-gradient(145deg,#6834ce,#d9469b);display:grid;place-items:center;font-size:17px;font-weight:900}.public-master-empty h2{margin:0 0 8px;font-size:19px}.public-master-empty p{margin:0;color:#817589;font-size:10px;line-height:1.8}.public-master-empty button{margin-top:15px;padding:9px 15px;border:0;border-radius:999px;color:#fff;background:#6034aa;font-size:9px;font-weight:900;cursor:pointer}.public-master-detail-shell{display:flex;flex-direction:column;gap:14px}.public-master-detail-back{align-self:flex-start;padding:7px 12px;border:1px solid #e2dbe8;border-radius:999px;color:#6436a0;background:#fff;font-size:9px;font-weight:900;cursor:pointer}@media(max-width:700px){.public-master-detail-back{padding-left:0;border:0;background:transparent}}
`;

function GroupSwitch({ group, setGroup }: { group: ScheduleGroup; setGroup: (group: ScheduleGroup) => void }) {
  return <div className="group-switch" aria-label="选择比赛组别"><button className={group === "少年组" ? "active" : ""} onClick={() => setGroup("少年组")}><b>U16</b><span>少年组</span></button><button className={group === "青年组" ? "active" : ""} onClick={() => setGroup("青年组")}><b>U20</b><span>青年组</span></button></div>;
}

export default function PublicMasterSchedule({ station, contentState }: { station: Station; contentState?: PublicContentState }) {
  const [group, setGroup] = useState<ScheduleGroup>("少年组");
  const [showDetailed, setShowDetailed] = useState(false);

  if (showDetailed) {
    return <div className="public-master-detail-shell public-competition-overlay"><style>{css}</style><button className="public-master-detail-back" type="button" onClick={() => setShowDetailed(false)}>‹ 返回主赛程</button><PublicCompetitionLiveV2 station={station} contentState={contentState} activeTab="schedule" /></div>;
  }

  if (!contentState) return <><style>{css}</style><section className="public-master-empty"><div><span>…</span><h2>正在读取本站赛程</h2><p>赛事页面已经打开，分阶段主赛程正在后台补齐。</p></div></section></>;

  const groupSchedule = contentState.masterSchedule?.groups[group];
  const published = Boolean(groupSchedule?.published);
  const stages = groupSchedule?.stages ?? [];

  return <div className="schedule-page stack public-master-schedule"><style>{css}</style><section className="schedule-head with-group compact-head"><div><small className="event-name-kicker">{station.title}</small><h1>赛程</h1><p>少年组与青年组主赛程分别发布，详细签表与场次沿用竞赛执行已发布数据。</p></div><GroupSwitch group={group} setGroup={setGroup} /></section>{!published ? <section className="public-master-empty"><div><span>赛</span><h2>{group}赛程待组委会发布</h2><p>{group === "少年组" ? "U16少年组" : "U20青年组"}的阶段时间、赛制与晋级说明确认后会在这里发布；另一组别可独立发布，不受影响。</p></div></section> : <><div className="master-schedule-note"><strong>{group}主赛程：</strong>阶段时间、赛制与晋级规则由组委会发布；点击任一阶段的“查看赛程表”后，会进入原有竞赛执行详细赛程页面。</div><section className="phase-schedule compact-phases">{stages.map((stage) => { const phase = station.phases.find((item) => item.id === stage.code); const status = phase?.status || "待开始"; return <article className="phase-card compact-phase" key={`${group}-${stage.code}`}><div className="phase-status-line"><b className={`phase-status status-${status}`}>{status}</b><time>{stage.dateLabel || phase?.date || "时间待定"}</time></div><h2>{stage.title}</h2><h3>{stage.advancementText}</h3><div className="phase-meta">{stage.tags.map((tag) => <span key={tag}>{tag}</span>)}{stage.raceLabel && <span>{stage.raceLabel}</span>}</div>{stage.qualificationNote && <div className="master-qualification"><strong>晋级说明</strong>{stage.qualificationNote}</div>}<footer><small>详细赛程、签表、球台与对阵继续读取原竞赛执行发布内容</small><div className="public-phase-actions"><button type="button" onClick={() => setShowDetailed(true)}>查看赛程表 <i>›</i></button></div></footer></article>; })}</section></>}</div>;
}
