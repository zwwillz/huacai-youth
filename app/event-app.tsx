"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";

import PublicCompetitionLiveV2, { type PublicCompetitionTab } from "./public-competition-live-v2";
import type { EventData, Group, Station } from "./public-types";
import type { PublicContentState } from "@/db/public-content";

type MainView = "event" | "players" | "me";
type EventTab = "overview" | "rules" | "schedule" | "matches" | "rankings" | "guide";
type GuideKind = "transport" | "clothing";

const shortDate = (value:string) => { const [,m,d]=value.split("-"); return `${Number(m)}月${Number(d)}日`; };

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

function StationOverview({
  station,
  data,
  contentState,
  openRules,
  openSchedule,
  openGuide,
}: {
  station: Station;
  data: EventData;
  contentState?: PublicContentState;
  openRules: () => void;
  openSchedule: () => void;
  openGuide: (kind: GuideKind) => void;
}) {
  const isLangfang = station.id === "langfang";
  const stationYouthMatches = data.matches.filter((match) => match.eventId === station.eventId && match.group === "少年组");
  const stationYouthPlayers = isLangfang ? data.players : [];
  const guides = contentState?.guides ?? [];

  return <div className="stack">
    <StationHero station={station} openRules={openRules} openSchedule={openSchedule} />
    <section className="metrics">
      <article><strong>{station.totalPrize}</strong><span>本站总奖金</span></article>
      {isLangfang ? <>
        <article><strong>{stationYouthPlayers.length}</strong><span>少年组已公布出场选手</span></article>
        <article><strong>{stationYouthMatches.length}</strong><span>少年组已公布首轮对阵</span></article>
      </> : <>
        <article><strong>2</strong><span>少年组与青年组</span></article>
        <article><strong>{station.mainSize}</strong><span>正赛规模</span></article>
      </>}
      <article><strong>{station.duration}</strong><span>本站比赛周期</span></article>
    </section>
    <section className="card introduction">
      <div><small>赛事简介</small><h2>{station.stop} · {station.city}</h2></div>
      <div><p>{station.intro}</p><div className="inline-actions"><button onClick={openRules}>查看完整竞赛规程</button><button onClick={openSchedule}>查看分阶段赛程</button></div></div>
    </section>
    <section className="rules">
      <article className="card"><small>少年组 U16</small><h2>{station.age.少年组}</h2><p>{station.format[0][2]}；本站少年组冠军奖金{station.prizes.少年组[0][1]}。</p><dl><div><dt>组别</dt><dd>少年组</dd></div><div><dt>正赛规模</dt><dd>64人</dd></div></dl></article>
      <article className="card"><small>青年组 U20</small><h2>{station.age.青年组}</h2><p>{station.format[0][3]}；本站青年组冠军奖金{station.prizes.青年组[0][1]}。</p><dl><div><dt>组别</dt><dd>青年组</dd></div><div><dt>正赛规模</dt><dd>64人</dd></div></dl></article>
    </section>
    <section className="card organizers">
      <div><small>官方信息</small><h2>赛事组织</h2></div>
      <dl>{station.organizers.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}<div><dt>比赛地点</dt><dd>{station.venueDetail}</dd></div></dl>
    </section>
    <section className="card participant-tips">
      <header><div><small>参赛提示</small><h2>参赛友好提示</h2></div><b>信息将持续更新</b></header>
      <div className="tip-links">
        {guides.length ? guides.map((guide) => <a href={`/guide/${encodeURIComponent(guide.id)}`} className="dynamic-guide-link" key={guide.id}><span>{guideIcon(guide.title, guide.guideType)}</span><div><strong>{guide.title}</strong><small>查看组委会发布的参赛提示</small></div><b>查看 ›</b></a>) : <>
          <button onClick={() => openGuide("transport")}><span>行</span><div><strong>交通住宿攻略</strong><small>路线、场馆周边及住宿信息</small></div><b>查看 ›</b></button>
          <button onClick={() => openGuide("clothing")}><span>装</span><div><strong>服装要求</strong><small>查看参赛着装相关提示</small></div><b>查看 ›</b></button>
        </>}
      </div>
    </section>
    {isLangfang && <section className="card sponsor-section"><header><div><small>赛事支持</small><h2>合作伙伴</h2></div></header><img src="/langfang-sponsors.jpg" alt="河北廊坊站合作伙伴标识" width="1242" height="367" /></section>}
  </div>;
}

function CompetitionRules({ station, contentState }: { station: Station; contentState?: PublicContentState }) {
  const regulationDocument = contentState?.documents.regulation;
  const refereeDocument = contentState?.documents.referee_list;
  return <div className="regulation stack">
    <section className="regulation-head">
      <h1>{station.city}竞赛规程</h1><p>{station.title}</p>
      <span>以下为竞赛规程重点摘要，具体执行以官方原文及组委会最新通知为准</span>
      <div className="pdf-actions">
        {regulationDocument?.published && regulationDocument.url ? <a className="pdf-button" href={regulationDocument.url} target="_blank" rel="noreferrer">查看完整竞赛规程 <b>原文 ↗</b></a> : <span className="pdf-pending">完整规程原文待组委会发布</span>}
        {refereeDocument?.published && refereeDocument.url ? <a className="pdf-button referee-button" href={refereeDocument.url} target="_blank" rel="noreferrer">查看裁判员名单 <b>原文 ↗</b></a> : <span className="pdf-pending">裁判员名单待组委会发布</span>}
      </div>
    </section>
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

function Players({data}:{data:EventData}){const [query,setQuery]=useState(""),[selected,setSelected]=useState("");const list=useMemo(()=>data.players.filter(name=>name.includes(query.trim())).slice(0,90),[data.players,query]);const related=selected?data.matches.filter(match=>match.playerA===selected||match.playerB===selected):[];return <div className="stack"><section className="player-hero"><h1>球员数据</h1><p>当前已录入河北廊坊站少年组资格赛第一场。</p><label><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="输入少年组选手姓名"/></label></section><section className="card"><header><div><small>河北廊坊站 · 少年组</small><h2>{query?`“${query}”的结果`:"已公布出场选手"}</h2></div><b>{data.players.length} 人</b></header><div className="players-grid">{list.map(name=>{const count=data.matches.filter(match=>match.playerA===name||match.playerB===name).length;return <button onClick={()=>setSelected(name)} key={name}><span>{name[0]}</span><div><strong>{name}</strong><small>{count} 场已公布赛程</small></div><b>›</b></button>})}</div></section>{selected&&<div className="overlay" onClick={()=>setSelected("")}><aside onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setSelected("")}>×</button><div className="avatar">{selected[0]}</div><span className="tag">少年组</span><h2>{selected}</h2><p>2026华彩十六球青少年系列赛 · 河北廊坊站</p><div className="player-stats"><div><strong>{related.length}</strong><span>已公布场次</span></div><div><strong>{related.filter(match=>match.isTv).length}</strong><span>转播台场次</span></div></div><h3>比赛安排</h3>{related.map(match=><article className="player-match" key={match.id}><div><strong>{shortDate(match.date)} {match.time}</strong><span>{match.progress} · {match.race}</span></div><b>{match.table}</b></article>)}</aside></div>}</div>}
function Me(){return <div className="stack"><section className="profile"><div>选</div><span><h1>个人中心</h1><p>登录后查看报名、赛程、成绩与积分。</p></span></section><section className="quick">{[["报名","我的报名","审核及缴费状态"],["赛程","我的比赛","检录、时间和球台"],["成绩","参赛记录","排名与赛事积分"],["家长","选手管理","绑定青少年选手"]].map(item=><article key={item[0]}><span>{item[0]}</span><strong>{item[1]}</strong><small>{item[2]}</small></article>)}</section><section className="card signin"><div><small>后续功能</small><h2>账户功能下一阶段接入</h2><p>当前阶段先完善公开赛事、竞赛规程、赛程和对阵图；报名、裁判及组委会操作将在下一阶段接入。</p></div><button>体验登录流程</button></section></div>}

function ParticipantGuide({kind,onBack}:{kind:GuideKind;onBack:()=>void}){
  const isClothing=kind==="clothing";
  return <div className="guide-page stack"><button className="draw-back" onClick={onBack}>‹ 返回赛事概览</button><section className="guide-hero"><span>{isClothing?"装":"行"}</span><div><small>参赛友好提示</small><h1>{isClothing?"服装要求":"交通住宿攻略"}</h1><p>2026中国华彩十六球青少年系列赛廊坊站</p></div></section><section className="card guide-placeholder"><span>待</span><h2>待组委会更新</h2><p>{isClothing?"参赛服装、鞋履及现场着装要求将在组委会确认后更新。":"场馆交通路线、停车信息及周边住宿建议将在组委会确认后更新。"}</p></section></div>;
}

export default function EventApp({ data, contentStates }: { data: EventData; contentStates: PublicContentState[] }) {
  const [view, setView] = useState<MainView>("event");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<EventTab>("overview");
  const [guideKind, setGuideKind] = useState<GuideKind>("clothing");
  const station = selectedId ? data.stations.find((item) => item.id === selectedId) ?? null : null;
  const contentState = station ? contentStates.find((item) => item.eventId === station.eventId) : undefined;
  const activeCompetitionTab = tab === "schedule" || tab === "matches" || tab === "rankings" ? tab as PublicCompetitionTab : null;

  const openEvent = (id: string) => { setSelectedId(id); setTab("overview"); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const back = () => { setSelectedId(null); setTab("overview"); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const enter = (nextView: MainView) => { setView(nextView); if (nextView === "event") setSelectedId(null); };
  const title = view === "players" ? "球员数据" : view === "me" ? "个人中心" : station?.city || "赛事中心";
  const openGuide = (kind: GuideKind) => { setGuideKind(kind); setTab("guide"); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const changeTab = (nextTab: EventTab) => { setTab(nextTab); window.scrollTo({ top: 0, behavior: "smooth" }); };

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("huacai:navigation", { detail: { view, stationId: selectedId ?? "", tab } }));
  }, [view, selectedId, tab]);

  return <main data-huacai-view={view} data-huacai-station={selectedId ?? ""} data-huacai-tab={tab}>
    <header className="top"><button className="brand" onClick={() => { setView("event"); back(); }}><span>华</span><strong>华彩赛事</strong></button><h3>{title}</h3><a className="admin" href="/admin">组委会入口</a></header>
    <div className="layout">
      <aside className="side">{[["event", "赛", "赛事", "官方赛事与赛程"], ["players", "员", "球员", "球员档案与数据"], ["me", "我", "我的", "报名、比赛与积分"]].map((item) => <button className={view === item[0] ? "active" : ""} onClick={() => enter(item[0] as MainView)} key={item[0]}><span>{item[1]}</span><div><strong>{item[2]}</strong><small>{item[3]}</small></div></button>)}</aside>
      <div className="content">
        {view === "event" && !station && <EventCenter data={data} openEvent={openEvent} />}
        {view === "event" && station && <>
          <button className="back" onClick={back}>‹ 返回赛事中心</button>
          <nav className="tabs public-five-tabs public-unified-tabs" aria-label="赛事内容">
            {([["overview", "概览"], ["rules", "竞赛规程"], ["schedule", "赛程"], ["matches", "对阵"], ["rankings", "排名"]] as [EventTab, string][]).map(([id, label]) => <button className={tab === id || (tab === "guide" && id === "overview") ? "active" : ""} onClick={() => changeTab(id)} key={id}>{label}</button>)}
          </nav>
          {tab === "overview" && <StationOverview station={station} data={data} contentState={contentState} openRules={() => changeTab("rules")} openSchedule={() => changeTab("schedule")} openGuide={openGuide} />}
          {tab === "guide" && <ParticipantGuide kind={guideKind} onBack={() => changeTab("overview")} />}
          {tab === "rules" && (contentState?.publishedModules.includes("regulation") ? <CompetitionRules station={station} contentState={contentState} /> : <PublicModuleEmpty icon="规" title="本站竞赛规程正在完善中" description="待组委会确认后，将在这里发布正式规程、参赛要求和相关文件。" />)}
          <PublicCompetitionLiveV2 station={station} contentState={contentState} activeTab={activeCompetitionTab} />
        </>}
        {view === "players" && <Players data={data} />}
        {view === "me" && <Me />}
      </div>
    </div>
    <nav className="bottom">{[["event", "赛", "赛事"], ["players", "员", "球员"], ["me", "我", "我的"]].map((item) => <button className={view === item[0] ? "active" : ""} onClick={() => enter(item[0] as MainView)} key={item[0]}><span>{item[1]}</span><strong>{item[2]}</strong></button>)}</nav>
  </main>;
}
