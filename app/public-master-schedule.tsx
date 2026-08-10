"use client";

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import type { PublicContentState } from "@/db/public-content";
import type { MasterScheduleCode, ScheduleGroup } from "@/db/schedule-publish";
import type { Station } from "./public-types";
import PublicCompetitionLiveV2 from "./public-competition-live-v2";

const PHASE_INDEX: Record<MasterScheduleCode, number> = {
  "qualifier-one": 0,
  "qualifier-two": 1,
  "main-one": 2,
  "main-two": 3,
};

const css = `
.public-master-schedule{display:flex;flex-direction:column;gap:18px}.public-master-schedule .master-schedule-note{padding:10px 15px;border:1px solid #e7e0ef;border-radius:13px;color:#7c7085;background:#fbf9fd;font-size:9px;line-height:1.7}.public-master-schedule .master-schedule-note strong{color:#5c348e}.public-master-schedule .phase-meta{display:flex;gap:7px;flex-wrap:wrap}.public-master-schedule .phase-meta span{padding:5px 8px;border-radius:999px;color:#613896;background:#f0ebf8;font-size:8px;font-weight:800}.public-master-schedule .master-qualification{margin-top:13px;padding:11px 12px;border-radius:11px;color:#6f6177;background:#f8f5fa;font-size:9px;line-height:1.7}.public-master-schedule .master-qualification strong{display:block;margin-bottom:3px;color:#4f2b85;font-size:8px}.public-master-schedule .compact-phase>footer{margin-top:15px}.public-master-empty{min-height:260px;padding:30px;border:1px solid #e5deed;border-radius:18px;background:linear-gradient(145deg,#fff,#f8f4fb);display:grid;place-items:center;text-align:center}.public-master-empty>div{max-width:460px}.public-master-empty span{width:50px;height:50px;margin:0 auto 13px;border-radius:15px;color:#fff;background:linear-gradient(145deg,#6834ce,#d9469b);display:grid;place-items:center;font-size:17px;font-weight:900}.public-master-empty h2{margin:0 0 8px;font-size:19px}.public-master-empty p{margin:0;color:#817589;font-size:10px;line-height:1.8}.public-master-empty button{margin-top:15px;padding:9px 15px;border:0;border-radius:999px;color:#fff;background:#6034aa;font-size:9px;font-weight:900;cursor:pointer}.public-master-detail-shell{position:relative;min-height:300px}.public-master-detail-shell.is-opening>.public-master-detail-content{position:absolute;inset:0;visibility:hidden;pointer-events:none;overflow:hidden}.public-master-detail-loading{min-height:300px;padding:36px 22px;border:1px solid #e6dff0;border-radius:18px;background:linear-gradient(145deg,#fff,#f8f4fb);display:grid;place-items:center;text-align:center}.public-master-detail-loading>div{max-width:430px}.public-master-detail-loading span{width:50px;height:50px;display:grid;place-items:center;margin:0 auto 13px;border-radius:15px;color:#fff;background:linear-gradient(145deg,#6834ce,#d9469b);font-size:17px;font-weight:900}.public-master-detail-loading h2{margin:0 0 8px;font-size:18px}.public-master-detail-loading p{margin:0;color:#817589;font-size:10px;line-height:1.8}
`;

function GroupSwitch({ group, setGroup }: { group: ScheduleGroup; setGroup: (group: ScheduleGroup) => void }) {
  return <div className="group-switch" aria-label="选择比赛组别"><button className={group === "少年组" ? "active" : ""} onClick={() => setGroup("少年组")}><b>U16</b><span>少年组</span></button><button className={group === "青年组" ? "active" : ""} onClick={() => setGroup("青年组")}><b>U20</b><span>青年组</span></button></div>;
}

function DirectScheduleDetail({ station, contentState, group, phaseId, onBack, onGroupChange }: {
  station: Station;
  contentState: PublicContentState;
  group: ScheduleGroup;
  phaseId: MasterScheduleCode;
  onBack: () => void;
  onGroupChange: (group: ScheduleGroup) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const openedRef = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    openedRef.current = false;
    setReady(false);

    const openRequestedPhase = () => {
      const detail = host.querySelector<HTMLElement>(".public-live-stage-detail");
      if (detail) {
        setReady(true);
        return;
      }

      const moduleState = host.querySelector<HTMLElement>(".public-module-state");
      if (moduleState) {
        const text = moduleState.textContent || "";
        if (!/正在加载|正在读取|正在准备/.test(text)) setReady(true);
        return;
      }

      const switcher = host.querySelector<HTMLElement>(".schedule-head .group-switch") || host.querySelector<HTMLElement>(".group-switch");
      const groupButtons = switcher?.querySelectorAll<HTMLButtonElement>("button");
      const wantedGroup = group === "少年组" ? 0 : 1;
      const groupButton = groupButtons?.[wantedGroup];
      if (groupButton && !groupButton.classList.contains("active")) {
        groupButton.click();
        return;
      }

      const cards = host.querySelectorAll<HTMLElement>(".phase-card");
      const card = cards[PHASE_INDEX[phaseId]];
      const detailButton = card?.querySelector<HTMLButtonElement>(".public-phase-actions button:last-child");
      if (detailButton && !openedRef.current) {
        openedRef.current = true;
        detailButton.click();
      }
    };

    const observer = new MutationObserver(openRequestedPhase);
    observer.observe(host, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    const timer = window.setInterval(openRequestedPhase, 120);
    const fallback = window.setTimeout(() => setReady(true), 6000);
    openRequestedPhase();
    return () => {
      observer.disconnect();
      window.clearInterval(timer);
      window.clearTimeout(fallback);
    };
  }, [group, phaseId, station.eventId]);

  const captureClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest(".draw-back")) {
      event.preventDefault();
      event.stopPropagation();
      onBack();
      return;
    }
    const groupButton = target.closest(".group-switch button");
    if (groupButton) {
      const text = groupButton.textContent || "";
      if (text.includes("少年组")) onGroupChange("少年组");
      if (text.includes("青年组")) onGroupChange("青年组");
    }
  };

  return <div ref={hostRef} className={`public-master-detail-shell ${ready ? "is-ready" : "is-opening"}`} onClickCapture={captureClick}>
    <style>{css}</style>
    {!ready && <section className="public-master-detail-loading" aria-busy="true"><div><span>赛</span><h2>正在打开详细赛程表</h2><p>正在读取当前组别与阶段的签表、场次和球台信息。</p></div></section>}
    <div className="public-master-detail-content"><PublicCompetitionLiveV2 station={station} contentState={contentState} activeTab="schedule" /></div>
  </div>;
}

export default function PublicMasterSchedule({ station, contentState }: { station: Station; contentState?: PublicContentState }) {
  const [group, setGroup] = useState<ScheduleGroup>("少年组");
  const [selectedPhase, setSelectedPhase] = useState<MasterScheduleCode | null>(null);

  const u16Published = Boolean(contentState?.masterSchedule?.groups.少年组.published);
  const u20Published = Boolean(contentState?.masterSchedule?.groups.青年组.published);

  useEffect(() => {
    if (!contentState || selectedPhase) return;
    const currentPublished = Boolean(contentState.masterSchedule?.groups[group].published);
    if (currentPublished) return;
    if (u16Published) setGroup("少年组");
    else if (u20Published) setGroup("青年组");
  }, [contentState, group, selectedPhase, u16Published, u20Published]);

  if (selectedPhase && contentState) {
    return <DirectScheduleDetail station={station} contentState={contentState} group={group} phaseId={selectedPhase} onBack={() => setSelectedPhase(null)} onGroupChange={setGroup} />;
  }

  if (!contentState) return <><style>{css}</style><section className="public-master-empty"><div><span>…</span><h2>正在读取本站赛程</h2><p>赛事页面已经打开，分阶段主赛程正在后台补齐。</p></div></section></>;

  const groupSchedule = contentState.masterSchedule?.groups[group];
  const published = Boolean(groupSchedule?.published);
  const stages = groupSchedule?.stages ?? [];

  return <div className="schedule-page stack public-master-schedule"><style>{css}</style><section className="schedule-head with-group compact-head"><div><small className="event-name-kicker">{station.title}</small><h1>赛程</h1><p>按组别查看阶段主赛程；详细签表直接从对应阶段进入。</p></div><GroupSwitch group={group} setGroup={(next) => { setGroup(next); setSelectedPhase(null); }} /></section>{!published ? <section className="public-master-empty"><div><span>赛</span><h2>{group}赛程待组委会发布</h2><p>{group === "少年组" ? "U16少年组" : "U20青年组"}的阶段时间、赛制与晋级说明确认后会在这里发布；另一组别可独立发布，不受影响。</p></div></section> : <><div className="master-schedule-note"><strong>{group}主赛程：</strong>阶段时间、赛制与晋级规则由组委会发布；点击某一阶段的“查看赛程表”，会直接进入该阶段已经发布的详细签表。</div><section className="phase-schedule compact-phases">{stages.map((stage) => { const phase = station.phases.find((item) => item.id === stage.code); const status = phase?.status || "待开始"; return <article className="phase-card compact-phase" key={`${group}-${stage.code}`}><div className="phase-status-line"><b className={`phase-status status-${status}`}>{status}</b><time>{stage.dateLabel || phase?.date || "时间待定"}</time></div><h2>{stage.title}</h2><h3>{stage.advancementText}</h3><div className="phase-meta">{stage.tags.map((tag) => <span key={tag}>{tag}</span>)}{stage.raceLabel && <span>{stage.raceLabel}</span>}</div>{stage.qualificationNote && <div className="master-qualification"><strong>晋级说明</strong>{stage.qualificationNote}</div>}<footer><small>详细赛程、签表、球台与对阵读取竞赛执行已发布内容</small><div className="public-phase-actions"><button type="button" onClick={() => setSelectedPhase(stage.code)}>查看赛程表 <i>›</i></button></div></footer></article>; })}</section></>}</div>;
}
