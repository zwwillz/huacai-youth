"use client";
/* eslint-disable @next/next/no-img-element */

import { useMemo, useState } from "react";
import type { GroupName, PrizeMap, PublicGuide, PublicMatch, PublicSiteData, PublicStation } from "./public-types";

type MainView = "event" | "players" | "me";
type EventTab = "overview" | "rules" | "schedule" | "bracket" | "draw" | "ranking" | "guide";
type GuideKind = "transport" | "clothing";

const GROUPS: GroupName[] = ["少年组", "青年组"];

function shortDate(value: string) {
  const [, month, day] = value.split("-");
  return month && day ? `${Number(month)}月${Number(day)}日` : value;
}

function groupCode(group: GroupName) {
  return group === "少年组" ? "U16" : "U20";
}

function GroupSwitch({ group, setGroup }: { group: GroupName; setGroup: (group: GroupName) => void }) {
  return <div className="group-switch" aria-label="选择比赛组别">{GROUPS.map((item) => <button className={group === item ? "active" : ""} onClick={() => setGroup(item)} key={item}><b>{groupCode(item)}</b><span>{item}</span></button>)}</div>;
}

function EventCenter({ stations, openEvent }: { stations: PublicStation[]; openEvent: (id: string) => void }) {
  const years = useMemo(() => [...new Set(stations.map((station) => station.year))].sort((a, b) => b - a), [stations]);
  const [year, setYear] = useState(years[0] ?? new Date().getFullYear());
  const list = stations.filter((station) => station.year === year);
  return <div className="event-center stack">
    <section className="center-hero"><div><h1>官方赛事</h1><p>中国华彩十六球青少年系列赛</p></div><span><strong>{list.length}</strong>{year}赛季分站</span></section>
    <nav className="year-switch" aria-label="选择赛事年份">{years.map((item) => <button className={year === item ? "active" : ""} onClick={() => setYear(item)} key={item}><b>{item}</b><span>赛季</span></button>)}</nav>
    <section className="event-list-head"><div><small>{year}年</small><h2>赛事列表</h2></div><span>按分站倒序</span></section>
    {list.length ? <section className="event-list">{list.map((station) => <button className={`event-row ${station.active ? "featured" : ""}`} onClick={() => openEvent(station.id)} key={station.id}>
      <div className={`event-cover cover-${station.visualKey}`}><span>{station.stop}</span><strong>{station.city}</strong></div>
      <div className="event-info"><div><span>{station.stop}</span><b className={station.active ? "live" : ""}>{station.status}</b></div><h3>{station.title}</h3><p>{station.date} · {station.venue}</p></div><b>›</b>
    </button>)}</section> : <section className="match-empty"><i>○</i><h2>暂无已发布赛事</h2><p>该赛季尚未发布公开赛事。</p></section>}
  </div>;
}

function StationHero({ station, openRules, openSchedule }: { station: PublicStation; openRules: () => void; openSchedule?: () => void }) {
  return <section className={`station-hero cover-${station.visualKey}`}><div className="station-hero-shade"/><div className="station-hero-content"><div className="station-badges"><span>{station.stop}</span><b>{station.status}</b></div><h1>{station.title}</h1>{station.sponsor && <p className="station-sponsor">{station.sponsor}</p>}<div className="station-meta"><span>{station.date}</span><span>{station.venue}</span></div><div className="station-actions"><button onClick={openRules}>查看竞赛规程</button>{openSchedule && <button className="primary" onClick={openSchedule}>查看赛程</button>}</div></div></section>;
}

function StationOverview({ station, data, openRules, openSchedule, openGuide }: { station: PublicStation; data: PublicSiteData; openRules: () => void; openSchedule?: () => void; openGuide: (kind: GuideKind) => void }) {
  const eventMatches = data.matches.filter((match) => match.eventId === station.id);
  const participants = data.participants.filter((item) => item.eventId === station.id);
  return <div className="stack"><StationHero station={station} openRules={openRules} openSchedule={openSchedule}/>
    <section className="stat-grid"><article><small>比赛时间</small><strong>{station.date}</strong><span>{station.duration}</span></article><article><small>正赛规模</small><strong>{station.mainSize}</strong><span>{participants.length ? `${participants.length}名已录入选手` : "名单待公布"}</span></article><article><small>奖金信息</small><strong>{station.totalPrize}</strong><span>以组委会发布为准</span></article><article><small>赛程数据</small><strong>{eventMatches.length}</strong><span>场已进入数据库</span></article></section>
    <section className="card event-intro"><header><div><small>EVENT INFO</small><h2>赛事简介</h2></div></header><p>{station.intro}</p></section>
    <section className="card"><header><div><small>VENUE</small><h2>比赛场馆</h2></div></header><div className="venue-block"><strong>{station.venue}</strong><p>{station.venueDetail}</p></div></section>
    <section className="card"><header><div><small>ORGANIZATION</small><h2>组织机构</h2></div></header>{station.organizers.length ? <div className="organizers">{station.organizers.map(([label, name]) => <div key={`${label}-${name}`}><span>{label}</span><strong>{name}</strong></div>)}</div> : <p>组织机构信息待组委会更新。</p>}</section>
    <section className="quick guide-quick"><button onClick={() => openGuide("transport")}><span>行</span><strong>交通住宿攻略</strong><small>场馆路线与住宿提示</small></button><button onClick={() => openGuide("clothing")}><span>装</span><strong>服装要求</strong><small>参赛着装与鞋履规范</small></button></section>
  </div>;
}

function CompetitionRules({ station }: { station: PublicStation }) {
  return <div className="stack rules-page"><section className="ranking-head"><div><small className="event-name-kicker">{station.title}</small><h1>竞赛规程</h1><p>以下内容直接读取赛事数据库。</p></div></section>
    <section className="card"><header><div><small>GROUPS</small><h2>组别与年龄</h2></div></header><div className="rule-groups">{GROUPS.map((group) => <article key={group}><b>{groupCode(group)}</b><strong>{group}</strong><p>{station.age[group]}</p></article>)}</div><p>{station.minimumAge}</p></section>
    <section className="card"><header><div><small>FORMAT</small><h2>竞赛办法</h2></div></header>{station.format.length ? <div className="format-table">{station.format.map((row, index) => <article key={`${row[0]}-${index}`}>{row.map((cell, cellIndex) => cellIndex === 0 ? <strong key={cellIndex}>{cell}</strong> : <span key={cellIndex}>{cell}</span>)}</article>)}</div> : <p>竞赛办法待组委会发布。</p>}</section>
    <section className="card"><header><div><small>DRAW</small><h2>抽签规则</h2></div></header>{station.draw.length ? <ol className="draw-rules">{station.draw.map((item) => <li key={item}>{item}</li>)}</ol> : <p>抽签规则待组委会发布。</p>}</section>
    <section className="card"><header><div><small>REGISTRATION</small><h2>报名与报到</h2></div></header><p>{station.signup}</p></section>
    <section className="card"><header><div><small>PRIZE</small><h2>奖金设置</h2></div></header>{GROUPS.map((group) => <div className="rules-prize-group" key={group}><h3>{group}</h3>{station.prizes[group].length ? <div className="prizes">{station.prizes[group].map(([rank, amount], index) => <div key={`${group}-${rank}`}><span>{index + 1}</span><strong>{rank}</strong><b>{amount}</b></div>)}</div> : <p>奖金明细待公布。</p>}</div>)}</section>
    {(station.rulesPdf || station.refereesPdf) && <section className="doc-actions">{station.rulesPdf && <a href={station.rulesPdf} target="_blank" rel="noreferrer">打开竞赛规程文件</a>}{station.refereesPdf && <a href={station.refereesPdf} target="_blank" rel="noreferrer">查看裁判员名单</a>}</section>}
  </div>;
}

function Schedule({ station, data, group, setGroup, openBracket }: { station: PublicStation; data: PublicSiteData; group: GroupName; setGroup: (group: GroupName) => void; openBracket: (phaseId: string) => void }) {
  const groupMatches = data.matches.filter((match) => match.eventId === station.id && match.group === group);
  return <div className="stack"><section className="match-list-head with-group compact-head"><div><small className="event-name-kicker">{station.title}</small><h1>赛程</h1><p>按比赛阶段查看已发布赛程与签表。</p></div><GroupSwitch group={group} setGroup={setGroup}/></section>
    {station.phases.length ? <section className="phase-list">{station.phases.map((phase) => { const count = groupMatches.filter((match) => match.phaseId === phase.id).length; return <button className="phase-card" onClick={() => openBracket(phase.id)} key={phase.id}><span>{phase.number}</span><div><small>{phase.date}</small><h2>{phase.title}</h2><p>{count ? `${group}已录入 ${count} 场比赛` : `${group}赛程待公布`}</p></div><b className={phase.status === "进行中" ? "live" : ""}>{phase.status}</b></button>; })}</section> : <section className="match-empty"><i>○</i><h2>比赛阶段待发布</h2><p>组委会尚未发布该站的阶段安排。</p></section>}
  </div>;
}

function MatchList({ station, data, group, setGroup }: { station: PublicStation; data: PublicSiteData; group: GroupName; setGroup: (group: GroupName) => void }) {
  const source = useMemo(() => data.matches.filter((match) => match.eventId === station.id && match.group === group), [data.matches, station.id, group]);
  const days = useMemo(() => [...new Set(source.map((match) => match.date))].sort(), [source]);
  const [query, setQuery] = useState("");
  const [selectedDay, setSelectedDay] = useState<string>("");
  const day = selectedDay && days.includes(selectedDay) ? selectedDay : days[0] ?? "";
  const filtered = source.filter((match) => (!day || match.date === day) && [match.playerA, match.playerB, match.table, match.progress, match.round].some((item) => item.includes(query.trim())));
  return <div className="match-list-page stack"><section className="match-list-head with-group compact-head"><div><small className="event-name-kicker">{station.title}</small><h1>对阵</h1><p>数据库中的已发布比赛名单</p></div><GroupSwitch group={group} setGroup={setGroup}/></section>
    <section className="match-filter">{days.length > 0 && <nav className="match-days">{days.map((value) => <button className={day === value ? "active" : ""} onClick={() => setSelectedDay(value)} key={value}><small>{shortDate(value)}</small><b>{value.slice(5)}</b></button>)}</nav>}<label><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索球员、球台或轮次"/></label></section>
    <div className="match-count"><strong>{day ? shortDate(day) : "待公布"}</strong><span>{group} · {filtered.length}场对阵</span></div>
    {filtered.length ? <section className="versus-list">{filtered.map((match) => <MatchCard match={match} key={match.id}/>)}</section> : <section className="match-empty"><i>○</i><h2>对阵待公布</h2><p>{group}当前没有符合条件的已发布比赛。</p></section>}
  </div>;
}

function MatchCard({ match }: { match: PublicMatch }) {
  return <article className="versus-card"><header><b>{match.time || "时间待定"}</b><span>{[match.progress, match.round, match.order ? `第${match.order}场` : ""].filter(Boolean).join(" · ")}</span></header><section><div className="match-player"><i>{match.playerA.slice(0, 1) || "?"}</i><strong>{match.playerA || "待定"}</strong></div><div className="match-center"><strong>— : —</strong><span className="ended">{match.status === "published" ? "已公布" : match.status}</span><b className={match.isTv ? "tv" : ""}>{match.table}</b></div><div className="match-player"><i>{match.playerB.slice(0, 1) || "?"}</i><strong>{match.playerB || "待定"}</strong></div></section></article>;
}

function DrawBoard({ station, data, group, setGroup, phaseId, onBack }: { station: PublicStation; data: PublicSiteData; group: GroupName; setGroup: (group: GroupName) => void; phaseId: string; onBack: () => void }) {
  const phase = station.phases.find((item) => item.id === phaseId);
  const [query, setQuery] = useState("");
  const matches = data.matches.filter((match) => match.eventId === station.id && match.group === group && match.phaseId === phaseId && [match.playerA, match.playerB, match.table, match.round, match.progress].some((item) => item.includes(query.trim())));
  const blocks = useMemo(() => { const map = new Map<string, PublicMatch[]>(); for (const match of matches) { const key = `${match.date} ${match.time}`; map.set(key, [...(map.get(key) ?? []), match]); } return [...map.entries()]; }, [matches]);
  return <div className="stack draw-page"><button className="draw-back" onClick={onBack}>‹ 返回赛程</button><section className="draw-head"><div><small>{station.title}</small><h1>{phase?.title || "阶段签表"}</h1><p>{phase?.date || "日期待公布"} · {group}</p></div><GroupSwitch group={group} setGroup={setGroup}/></section><section className="draw-toolbar"><label><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索球员、球台或轮次"/></label></section>
    {blocks.length ? <section className="draw-data-board">{blocks.map(([key, items]) => <article className="draw-data-group" key={key}><header><strong>{shortDate(items[0].date)} {items[0].time}</strong><span>{items.length} 场</span></header><div className="versus-list">{items.map((match) => <MatchCard match={match} key={match.id}/>)}</div></article>)}</section> : <section className="match-empty"><i>○</i><h2>该阶段签表待公布</h2><p>组委会录入并发布后，这里会直接从数据库显示。</p></section>}
  </div>;
}

function Ranking({ station, group, setGroup, prizes }: { station: PublicStation; group: GroupName; setGroup: (group: GroupName) => void; prizes: PrizeMap }) {
  return <div className="stack"><section className="ranking-head"><div><small className="event-name-kicker">{station.title}</small><h1>比赛排名</h1><p>当前数据库尚未建立最终排名结果表，先展示赛事奖金设置。</p></div><GroupSwitch group={group} setGroup={setGroup}/></section><section className="card ranking"><header><div><small>{group}</small><h2>奖金与最终名次</h2></div></header><div className="ranking-wait"><i/><div><strong>最终排名待录入</strong><p>排名数据表接入后将自动显示最终成绩。</p></div></div>{prizes[group].length ? <div className="prizes">{prizes[group].map(([rank, amount], index) => <div key={rank}><span>{index + 1}</span><strong>{rank}</strong><b>{amount}</b></div>)}</div> : <p>奖金明细待公布。</p>}</section></div>;
}

function Players({ data }: { data: PublicSiteData }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const list = useMemo(() => data.players.filter((name) => name.includes(query.trim())).slice(0, 120), [data.players, query]);
  const related = selected ? data.matches.filter((match) => match.playerA === selected || match.playerB === selected) : [];
  const entries = selected ? data.participants.filter((item) => item.playerName === selected) : [];
  return <div className="stack"><section className="player-hero"><h1>球员数据</h1><p>公开球员名单来自赛事报名与历史导入数据库。</p><label><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="输入选手姓名"/></label></section><section className="card"><header><div><small>PUBLIC PLAYERS</small><h2>{query ? `“${query}”的结果` : "已录入选手"}</h2></div><b>{data.players.length} 人</b></header>{list.length ? <div className="players-grid">{list.map((name) => { const count = data.matches.filter((match) => match.playerA === name || match.playerB === name).length; return <button onClick={() => setSelected(name)} key={name}><span>{name[0]}</span><div><strong>{name}</strong><small>{count} 场已公布赛程</small></div><b>›</b></button>; })}</div> : <p>未找到匹配选手。</p>}</section>
    {selected && <div className="overlay" onClick={() => setSelected("")}><aside onClick={(event) => event.stopPropagation()}><button className="close" onClick={() => setSelected("")}>×</button><div className="avatar">{selected[0]}</div><h2>{selected}</h2><p>{entries.map((item) => `${item.group}`).filter((value, index, array) => array.indexOf(value) === index).join(" / ") || "公开选手"}</p><div className="player-stats"><div><strong>{related.length}</strong><span>已公布场次</span></div><div><strong>{related.filter((match) => match.isTv).length}</strong><span>转播台场次</span></div></div><h3>比赛安排</h3>{related.slice(0, 30).map((match) => <article className="player-match" key={match.id}><div><strong>{shortDate(match.date)} {match.time}</strong><span>{match.progress} · {match.race}</span></div><b>{match.table}</b></article>)}</aside></div>}
  </div>;
}

function ParticipantGuide({ station, kind, onBack }: { station: PublicStation; kind: GuideKind; onBack: () => void }) {
  const guide: PublicGuide | undefined = station.guides[kind];
  const isClothing = kind === "clothing";
  const link = guide?.externalUrl || guide?.fileUrl;
  return <div className="guide-page stack"><button className="draw-back" onClick={onBack}>‹ 返回赛事概览</button><section className="guide-hero"><span>{isClothing ? "装" : "行"}</span><div><small>参赛友好提示</small><h1>{guide?.title || (isClothing ? "服装要求" : "交通住宿攻略")}</h1><p>{station.title}</p></div></section>{guide ? <section className="card guide-placeholder"><h2>{guide.title}</h2><p>{guide.body || "详细内容请查看附件。"}</p>{link && <a href={link} target="_blank" rel="noreferrer">查看完整内容</a>}</section> : <section className="card guide-placeholder"><span>待</span><h2>待组委会更新</h2><p>{isClothing ? "参赛服装、鞋履及现场着装要求将在组委会确认后更新。" : "场馆交通路线、停车信息及周边住宿建议将在组委会确认后更新。"}</p></section>}</div>;
}

function Me() {
  return <div className="stack"><section className="profile"><div>选</div><span><h1>个人中心</h1><p>登录后查看报名、赛程、成绩与积分。</p></span></section><section className="quick">{[["报名", "我的报名", "审核及缴费状态"], ["赛程", "我的比赛", "检录、时间和球台"], ["成绩", "参赛记录", "排名与赛事积分"], ["家长", "选手管理", "绑定青少年选手"]].map((item) => <article key={item[0]}><span>{item[0]}</span><strong>{item[1]}</strong><small>{item[2]}</small></article>)}</section><section className="card signin"><div><small>后续功能</small><h2>账户功能下一阶段接入</h2><p>当前阶段先完善公开赛事数据库读取；球员和家长注册按后续版本计划接入。</p></div><button>体验登录流程</button></section></div>;
}

export default function EventApp({ data }: { data: PublicSiteData }) {
  const [view, setView] = useState<MainView>("event");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<EventTab>("overview");
  const [group, setGroup] = useState<GroupName>("少年组");
  const [phaseId, setPhaseId] = useState("");
  const [guideKind, setGuideKind] = useState<GuideKind>("clothing");
  const station = selectedId ? data.stations.find((item) => item.id === selectedId) ?? null : null;
  const stationMatches = station ? data.matches.filter((match) => match.eventId === station.id) : [];
  const hasCompetitionData = Boolean(station && (station.phases.length || stationMatches.length));

  const scrollTop = () => window.scrollTo({ top: 0, behavior: "smooth" });
  const openEvent = (id: string) => { setSelectedId(id); setTab("overview"); setPhaseId(""); scrollTop(); };
  const back = () => { setSelectedId(null); setTab("overview"); setPhaseId(""); scrollTop(); };
  const enter = (next: MainView) => { setView(next); if (next === "event") setSelectedId(null); scrollTop(); };
  const openDraw = (nextPhaseId: string) => { setPhaseId(nextPhaseId); setTab("draw"); scrollTop(); };
  const openGuide = (kind: GuideKind) => { setGuideKind(kind); setTab("guide"); scrollTop(); };
  const title = view === "players" ? "球员数据" : view === "me" ? "个人中心" : station?.city || "赛事中心";
  const tabs: [EventTab, string][] = [["overview", "概览"], ["rules", "竞赛规程"], ...(hasCompetitionData ? [["schedule", "赛程"], ["bracket", "对阵"], ["ranking", "排名"]] as [EventTab, string][] : [])];

  return <main><header className="top"><button className="brand" onClick={() => { setView("event"); back(); }}><span>华</span><strong>华彩赛事</strong></button><h3>{title}</h3><a className="admin" href="/admin">组委会入口</a></header><div className="layout"><aside className="side">{[["event", "赛", "赛事", "官方赛事与赛程"], ["players", "员", "球员", "球员档案与数据"], ["me", "我", "我的", "报名、比赛与积分"]].map((item) => <button className={view === item[0] ? "active" : ""} onClick={() => enter(item[0] as MainView)} key={item[0]}><span>{item[1]}</span><div><strong>{item[2]}</strong><small>{item[3]}</small></div></button>)}</aside><div className="content">
    {view === "event" && !station && <EventCenter stations={data.stations} openEvent={openEvent}/>} 
    {view === "event" && station && <><button className="back" onClick={back}>‹ 返回赛事中心</button><nav className={`tabs ${!hasCompetitionData ? "short-tabs" : ""}`}>{tabs.map((item) => <button className={tab === item[0] || (tab === "draw" && item[0] === "schedule") || (tab === "guide" && item[0] === "overview") ? "active" : ""} onClick={() => setTab(item[0])} key={item[0]}>{item[1]}</button>)}</nav>
      {tab === "overview" && <StationOverview station={station} data={data} openRules={() => setTab("rules")} openSchedule={hasCompetitionData ? () => setTab("schedule") : undefined} openGuide={openGuide}/>} 
      {tab === "guide" && <ParticipantGuide station={station} kind={guideKind} onBack={() => setTab("overview")}/>} 
      {tab === "rules" && <CompetitionRules station={station}/>} 
      {tab === "schedule" && <Schedule station={station} data={data} group={group} setGroup={setGroup} openBracket={openDraw}/>} 
      {tab === "bracket" && <MatchList station={station} data={data} group={group} setGroup={setGroup}/>} 
      {tab === "draw" && <DrawBoard station={station} data={data} group={group} setGroup={setGroup} phaseId={phaseId} onBack={() => setTab("schedule")}/>} 
      {tab === "ranking" && <Ranking station={station} group={group} setGroup={setGroup} prizes={station.prizes}/>}</>}
    {view === "players" && <Players data={data}/>} {view === "me" && <Me/>}
  </div></div><nav className="bottom">{[["event", "赛", "赛事"], ["players", "员", "球员"], ["me", "我", "我的"]].map((item) => <button className={view === item[0] ? "active" : ""} onClick={() => enter(item[0] as MainView)} key={item[0]}><span>{item[1]}</span><strong>{item[2]}</strong></button>)}</nav></main>;
}
