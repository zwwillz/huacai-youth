"use client";
/* eslint-disable @next/next/no-img-element */

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import MePreview from "./me-preview";
import { PlayerLoadingShell } from "./public-view-loading";
import type { PublicCompetitionTab } from "./public-competition-live-v2";
import type { EventData, Group, Station } from "./public-types";
import type { PublicContentState } from "@/db/public-content";

type MainView = "event" | "players" | "me";
type EventTab = "overview" | "rules" | "schedule" | "matches" | "rankings" | "guide";
type GuideKind = "transport" | "clothing";
type EventDetail = { station: Station; contentState: PublicContentState | null };
type CompetitionWarmIntent = "entry" | PublicCompetitionTab;

const PublicCompetitionLiveV2 = dynamic(() => import("./public-competition-live-v2"), { ssr: false });
const PlayerDbView = dynamic(() => import("./player-db-view"), { ssr: false, loading: () => <PlayerLoadingShell /> });

const eventDetailCache = new Map<string, { data: EventDetail; loadedAt: number }>();
const eventDetailRequests = new Map<string, Promise<EventDetail | null>>();
const EVENT_DETAIL_TTL = 300_000;

function preloadMainView(view: MainView) {
  if (view === "players") {
    void import("./player-db-view")
      .then((module) => module.preloadPlayerDb())
      .catch(() => undefined);
  }
}

function requestEventDetail(eventId: string) {
  const cached = eventDetailCache.get(eventId);
  if (cached && Date.now() - cached.loadedAt < EVENT_DETAIL_TTL) return Promise.resolve(cached.data);
  const pending = eventDetailRequests.get(eventId);
  if (pending) return pending;
  const request = fetch(`/api/public/events/${encodeURIComponent(eventId)}/detail`)
    .then(async (response) => {
      if (!response.ok) return null;
      const payload = await response.json() as { data?: EventDetail };
      if (!payload.data) return null;
      eventDetailCache.set(eventId, { data: payload.data, loadedAt: Date.now() });
      return payload.data;
    })
    .catch(() => null)
    .finally(() => { eventDetailRequests.delete(eventId); });
  eventDetailRequests.set(eventId, request);
  return request;
}

function warmCompetition(eventId: string, intent: CompetitionWarmIntent = "entry") {
  return import("./public-competition-live-v2")
    .then((module) => module.preloadPublicCompetition(eventId, intent))
    .catch(() => undefined);
}

function EventCenter({data,openEvent}:{data:EventData;openEvent:(id:string)=>void}) {
  const [year,setYear]=useState(2026);
  const years=[2025,2026,2027,2028];
  const stationList=data.stations.filter(station=>station.year===year);
  const hasEvents=stationList.length>0;
  return <div className="event-center stack"><section className="center-hero"><div><h1>官方赛事</h1><p>中国华彩十六球青少年系列赛</p></div><span><strong>{hasEvents?stationList.length:0}</strong>{year}赛季分站</span></section><nav className="year-switch" aria-label="选择赛事年份">{years.map(item=><button className={year===item?"active":""} onClick={()=>setYear(item)} key={item}><b>{item}</b><span>赛季</span></button>)}</nav><section className="event-list-head"><div><small>{year}年</small><h2>赛事列表</h2></div><span>按时间倒序</span></section>{hasEvents?<section className="event-list">{stationList.map((station,index)=><button className={`event-row ${station.active?"featured":""}`} onClick={()=>openEvent(station.id)} key={station.id}><div className={`event-cover cover-${station.id}`}><span>{station.stop}</span><strong>{station.city}</strong></div><div className="event-info"><div><span>{station.stop}</span><b className={station.active?"current":"ended"}>{station.status}</b></div><h3>{station.title}</h3><p><i>◆</i>{station.venue}</p><small>{station.date}</small></div><b className="event-arrow">{index===0?"进入赛事":"查看详情"}<i>›</i></b></button>)}</section>:<section className="year-empty"><span>赛</span><h2>{year}年赛事待公布</h2><p>该年度的分站信息将在组委会确认后更新。</p></section>}</div>;
}

function StationHero({station,openSchedule,openRules}:{station:Station;openSchedule?:()=>void;openRules:()=>void}) {
  return <section className={`hero station-hero station-${station.id}`}><div className="hero-copy"><span className="live"><i /> {station.stop} · {station.status}</span><p>2026 中国华彩十六球青少年系列赛</p><h1>{station.city}</h1><h2>{station.sponsor}</h2><div className="hero-meta"><span>{station.date}</span><span>{station.venue}</span></div><div className="hero-buttons">{openSchedule&&<button onClick={openSchedule}>查看赛程</button>}<button className={openSchedule?"ghost":""} onClick={openRules}>竞赛规程</button></div></div><div className="hero-poster"><strong>{station.stop}</strong><span>{station.shortCity}</span></div></section>;
}

function guideIcon(title: string, guideType: string) {
  if (guideType === "transport" || /交通|住宿|停车/.test(title)) return "行";
  if (guideType === "clothing" || /服装|着装/.test(title)) return "装";
  if (/报到|签到|检录/.test(title)) return "报";
  return title.slice(0, 1) || "提";
}

const PARTNER_TYPE_LABELS: Record<string, string> = {
  title: "冠名赞助",
  sponsor: "合作伙伴",
  equipment: "指定器材",
  support: "支持品牌",
};

function PartnerSection({ station }: { station: Station }) {
  const partners = (station.partners ?? []).filter((partner) => partner.name && partner.logo);
  if (partners.length) {
    return <section className="card sponsor-section"><header><div><small>赛事支持</small><h2>合作伙伴</h2></div></header><div className="partner-logo-grid">{partners.map((partner, index) => {
      const content = <><img src={partner.logo} alt={`${partner.name} Logo`} /><strong>{partner.name}</strong><small>{PARTNER_TYPE_LABELS[partner.type] ?? "合作伙伴"}</small></>;
      return partner.website
        ? <a className="partner-logo-card" href={partner.website} target="_blank" rel="noreferrer" key={`${partner.name}-${index}`}>{content}</a>
        : <article className="partner-logo-card" key={`${partner.name}-${index}`}>{content}</article>;
    })}</div></section>;
  }
  if (station.id === "langfang") {
    return <section className="card sponsor-section"><header><div><small>赛事支持</small><h2>合作伙伴</h2></div></header><img src="/langfang-sponsors.jpg" alt="河北廊坊站合作伙伴标识" width="1242" height="367" /></section>;
  }
  return null;
}

function StationOverview({station,contentState,openRules,openSchedule,openGuide}:{station:Station;contentState?:PublicContentState;openRules:()=>void;openSchedule:()=>void;openGuide:(kind:GuideKind)=>void}) {
  const isLangfang = station.id === "langfang";
  const guides = contentState?.guides ?? [];
  return <div className="stack">
    <StationHero station={station} openRules={openRules} openSchedule={openSchedule} />
    <section className="metrics">
      <article><strong>{station.totalPrize}</strong><span>本站总奖金</span></article>
      {isLangfang ? <><article><strong>{station.publicPlayerCount ?? "—"}</strong><span>少年组已公布出场选手</span></article><article><strong>{station.publicMatchCount ?? "—"}</strong><span>少年组已公布首轮对阵</span></article></> : <><article><strong>2</strong><span>少年组与青年组</span></article><article><strong>{station.mainSize}</strong><span>正赛规模</span></article></>}
      <article><strong>{station.duration}</strong><span>本站比赛周期</span></article>
    </section>
    <section className="card introduction"><div><small>赛事简介</small><h2>{station.stop} · {station.city}</h2></div><div><p>{station.intro}</p><div className="inline-actions"><button onClick={openRules}>查看完整竞赛规程</button><button onClick={openSchedule}>查看分阶段赛程</button></div></div></section>
    <section className="rules">
      <article className="card"><small>少年组 U16</small><h2>{station.age.少年组}</h2><p>{station.format[0]?.[2] ?? "详情加载中"}；本站少年组冠军奖金{station.prizes.少年组[0]?.[1] ?? "详情加载中"}。</p><dl><div><dt>组别</dt><dd>少年组</dd></div><div><dt>正赛规模</dt><dd>64人</dd></div></dl></article>
      <article className="card"><small>青年组 U20</small><h2>{station.age.青年组}</h2><p>{station.format[0]?.[3] ?? "详情加载中"}；本站青年组冠军奖金{station.prizes.青年组[0]?.[1] ?? "详情加载中"}。</p><dl><div><dt>组别</dt><dd>青年组</dd></div><div><dt>正赛规模</dt><dd>64人</dd></div></dl></article>
    </section>
    <section className="card organizers"><div><small>官方信息</small><h2>赛事组织</h2></div><dl>{station.organizers.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}<div><dt>比赛地点</dt><dd>{station.venueDetail}</dd></div></dl></section>
    <section className="card participant-tips"><header><div><small>参赛提示</small><h2>参赛友好提示</h2></div><b>信息将持续更新</b></header><div className="tip-links">{guides.length ? guides.map((guide) => <a href={`/guide/${encodeURIComponent(guide.id)}`} className="dynamic-guide-link" key={guide.id}><span>{guideIcon(guide.title, guide.guideType)}</span><div><strong>{guide.title}</strong><small>查看组委会发布的参赛提示</small></div><b>查看 ›</b></a>) : <><button onClick={() => openGuide("transport")}><span>行</span><div><strong>交通住宿攻略</strong><small>路线、场馆周边及住宿信息</small></div><b>查看 ›</b></button><button onClick={() => openGuide("clothing")}><span>装</span><div><strong>服装要求</strong><small>查看参赛着装相关提示</small></div><b>查看 ›</b></button></>}</div></section>
    <PartnerSection station={station} />
  </div>;
}

function CompetitionRules({ station, contentState }: { station: Station; contentState?: PublicContentState }) {
  const regulationDocument = contentState?.documents.regulation;
  const refereeDocument = contentState?.documents.referee_list;
  return <div className="regulation stack">
    <section className="regulation-head"><h1>{station.city}竞赛规程</h1><p>{station.title}</p><span>以下为竞赛规程重点摘要，具体执行以官方原文及组委会最新通知为准</span><div className="pdf-actions">{regulationDocument?.published && regulationDocument.url ? <a className="pdf-button" href={regulationDocument.url} target="_blank" rel="noreferrer">查看完整竞赛规程 <b>原文 ↗</b></a> : <span className="pdf-pending">完整规程原文待组委会发布</span>}{refereeDocument?.published && refereeDocument.url ? <a className="pdf-button referee-button" href={refereeDocument.url} target="_blank" rel="noreferrer">查看裁判员名单 <b>原文 ↗</b></a> : <span className="pdf-pending">裁判员名单待组委会发布</span>}</div></section>
    <section className="rule-nav">{["基本信息", "参赛资格", "竞赛办法", "种子与抽签", "报名与费用", "奖金设置"].map((item, index) => <a href={`#rule-${station.id}-${index + 1}`} key={item}><b>{String(index + 1).padStart(2, "0")}</b>{item}</a>)}</section>
    <section id={`rule-${station.id}-1`} className="rule-section card"><header><span>01</span><div><small>赛事基本信息</small><h2>时间、地点与组织机构</h2></div></header><dl className="facts"><div><dt>比赛时间</dt><dd>资格赛：{station.qualDate}<br />正赛：{station.mainDate}</dd></div><div><dt>比赛地点</dt><dd>{station.venueDetail}</dd></div>{station.organizers.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl></section>
    <section id={`rule-${station.id}-2`} className="rule-section card"><header><span>02</span><div><small>参赛资格</small><h2>少年组与青年组</h2></div></header><div className="eligibility"><article><b>U16</b><h3>少年组</h3><p>{station.age.少年组}</p></article><article><b>U20</b><h3>青年组</h3><p>{station.age.青年组}</p></article></div><p className="rule-note">{station.minimumAge}</p></section>
    <section id={`rule-${station.id}-3`} className="rule-section card"><header><span>03</span><div><small>竞赛办法</small><h2>资格赛、正赛与局数</h2></div></header><div className="format-table"><div><b>阶段</b><b>赛制</b><b>少年组</b><b>青年组</b></div>{station.format.map((row) => <div key={row[0]}><span>{row[0]}</span><span>{row[1]}</span><span>{row[2]}</span><span>{row[3]}</span></div>)}</div></section>
    <section id={`rule-${station.id}-4`} className="rule-section card"><header><span>04</span><div><small>种子与抽签</small><h2>抽签与入位规则</h2></div></header><ol>{station.draw.length ? station.draw.map((item, index) => <li key={index}>{item}</li>) : <li>抽签规则待组委会确认后发布。</li>}</ol></section>
    <section id={`rule-${station.id}-5`} className="rule-section card"><header><span>05</span><div><small>报名与费用</small><h2>报名须知</h2></div></header><div className="fee"><strong>¥100</strong><span>单站参赛费</span></div><p className="rule-note">{station.signup}</p></section>
    <section id={`rule-${station.id}-6`} className="rule-section card"><header><span>06</span><div><small>奖金设置</small><h2>本站总奖金 {station.totalPrize}</h2></div></header><div className="dual-prize">{(["少年组", "青年组"] as Group[]).map((group) => <article key={group}><h3>{group}</h3>{station.prizes[group].map(([rank, amount]) => <div key={rank}><span>{rank}</span><b>{amount}</b></div>)}</article>)}</div><p className="rule-note">以上均为税前奖金；奖金领取、积分和颁奖要求以正式规程为准。</p></section>
  </div>;
}

function PublicModuleEmpty({ icon, title, description }: { icon: string; title: string; description: string }) {
  return <section className="public-module-state" role="status"><div><span>{icon}</span><h2>{title}</h2><p>{description}<br />感谢关注，最新信息会在确认后及时更新。</p></div></section>;
}

function ParticipantGuide({kind,onBack}:{kind:GuideKind;onBack:()=>void}){
  const isClothing=kind==="clothing";
  return <div className="guide-page stack"><button className="draw-back" onClick={onBack}>‹ 返回赛事概览</button><section className="guide-hero"><span>{isClothing?"装":"行"}</span><div><small>参赛友好提示</small><h1>{isClothing?"服装要求":"交通住宿攻略"}</h1><p>2026中国华彩十六球青少年系列赛廊坊站</p></div></section><section className="card guide-placeholder"><span>待</span><h2>待组委会更新</h2><p>{isClothing?"参赛服装、鞋履及现场着装要求将在组委会确认后更新。":"场馆交通路线、停车信息及周边住宿建议将在组委会确认后更新。"}</p></section></div>;
}

export default function EventApp({ data }: { data: EventData }) {
  const [view, setView] = useState<MainView>("event");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<EventTab>("overview");
  const [guideKind, setGuideKind] = useState<GuideKind>("clothing");
  const [eventDetails, setEventDetails] = useState<Map<string, EventDetail>>(() => new Map([...eventDetailCache].map(([id, value]) => [id, value.data])));
  const baseStation = selectedId ? data.stations.find((item) => item.id === selectedId) ?? null : null;
  const detail = baseStation ? eventDetails.get(baseStation.eventId) : undefined;
  const station = detail?.station ?? baseStation;
  const contentState = detail?.contentState ?? undefined;
  const requestedCompetitionTab = tab === "schedule" || tab === "matches" || tab === "rankings" ? tab as PublicCompetitionTab : null;
  const activeCompetitionTab = requestedCompetitionTab && contentState ? requestedCompetitionTab : null;

  const hydrateEvent = (eventId: string) => {
    void requestEventDetail(eventId).then((next) => {
      if (!next) return;
      setEventDetails((current) => new Map(current).set(eventId, next));
    });
  };

  const openEvent = (id: string) => {
    const next = data.stations.find((item) => item.id === id);
    if (next) {
      hydrateEvent(next.eventId);
      void warmCompetition(next.eventId, "entry");
    }
    setSelectedId(id);
    setTab("overview");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const back = () => { setSelectedId(null); setTab("overview"); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const enter = (nextView: MainView) => { preloadMainView(nextView); setView(nextView); if (nextView === "event") setSelectedId(null); };
  const title = view === "players" ? "球员数据" : view === "me" ? "个人中心" : station?.city || "赛事中心";
  const openGuide = (kind: GuideKind) => { setGuideKind(kind); setTab("guide"); if (station) void warmCompetition(station.eventId, "entry"); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const changeTab = (nextTab: EventTab) => {
    if (station) {
      const intent: CompetitionWarmIntent = nextTab === "schedule" || nextTab === "matches" || nextTab === "rankings" ? nextTab : "entry";
      void warmCompetition(station.eventId, intent);
    }
    setTab(nextTab);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (connection?.saveData || connection?.effectiveType === "slow-2g" || connection?.effectiveType === "2g") return;
    let timer = 0;
    const warmPlayers = () => { timer = window.setTimeout(() => preloadMainView("players"), 650); };
    if (document.readyState === "complete") warmPlayers();
    else window.addEventListener("load", warmPlayers, { once: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("load", warmPlayers);
    };
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("huacai:navigation", { detail: { view, stationId: selectedId ?? "", tab } }));
  }, [view, selectedId, tab]);

  return <main data-huacai-view={view} data-huacai-station={selectedId ?? ""} data-huacai-tab={tab}>
    <header className="top"><button className="brand" onClick={() => { setView("event"); back(); }}><span>华</span><strong>华彩赛事</strong></button><h3>{title}</h3><a className="admin" href="/admin">后台管理</a></header>
    <div className="layout">
      <aside className="side">{[["event", "赛", "赛事", "官方赛事与赛程"], ["players", "员", "球员", "球员档案与数据"], ["me", "我", "我的", "报名、比赛与积分"]].map((item) => { const nextView=item[0] as MainView; return <button className={view === item[0] ? "active":""} onPointerEnter={() => preloadMainView(nextView)} onPointerDown={() => preloadMainView(nextView)} onFocus={() => preloadMainView(nextView)} onClick={() => enter(nextView)} key={item[0]}><span>{item[1]}</span><div><strong>{item[2]}</strong><small>{item[3]}</small></div></button>; })}</aside>
      <div className="content">
        {view === "event" && !station && <EventCenter data={data} openEvent={openEvent} />}
        {view === "event" && station && <>
          <button className="back" onClick={back}>‹ 返回赛事中心</button>
          <nav className="tabs public-five-tabs public-unified-tabs" aria-label="赛事内容">{([["overview", "概览"], ["rules", "竞赛规程"], ["schedule", "赛程"], ["matches", "对阵"], ["rankings", "排名"]] as [EventTab, string][]).map(([id, label]) => <button className={tab === id || (tab === "guide" && id === "overview") ? "active" : ""} onClick={() => changeTab(id)} key={id}>{label}</button>)}</nav>
          {tab === "overview" && <StationOverview station={station} contentState={contentState} openRules={() => changeTab("rules")} openSchedule={() => changeTab("schedule")} openGuide={openGuide} />}
          {tab === "guide" && <ParticipantGuide kind={guideKind} onBack={() => changeTab("overview")} />}
          {tab === "rules" && (!contentState ? <PublicModuleEmpty icon="…" title="正在读取竞赛规程" description="赛事页面已经打开，详细规程正在后台补齐。" /> : contentState.publishedModules.includes("regulation") ? <CompetitionRules station={station} contentState={contentState} /> : <PublicModuleEmpty icon="规" title="本站竞赛规程正在完善中" description="待组委会确认后，将在这里发布正式规程、参赛要求和相关文件。" />)}
          {requestedCompetitionTab && !contentState ? <PublicModuleEmpty icon="…" title="正在准备本站比赛数据" description="页面框架已打开，本站公开数据正在后台按优先级补齐。" /> : null}
          <PublicCompetitionLiveV2 station={station} contentState={contentState} activeTab={activeCompetitionTab} />
        </>}
        {view === "players" && <PlayerDbView />}
        {view === "me" && <MePreview />}
      </div>
    </div>
    <nav className="bottom">{[["event", "赛", "赛事"], ["players", "员", "球员"], ["me", "我", "我的"]].map((item) => { const nextView=item[0] as MainView; return <button className={view === item[0] ? "active" : ""} onPointerEnter={() => preloadMainView(nextView)} onPointerDown={() => preloadMainView(nextView)} onFocus={() => preloadMainView(nextView)} onClick={() => enter(nextView)} key={item[0]}><span>{item[1]}</span><strong>{item[2]}</strong></button>; })}</nav>
  </main>;
}
