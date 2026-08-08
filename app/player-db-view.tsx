"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PublicPlayerDetail, PublicPlayerEvent, PublicPlayerSummary } from "@/db/player-data";
import styles from "./player-db.module.css";

type FilterGroup = "全部" | "少年组" | "青年组";
type DetailTab = "data" | "events";
type YearFilter = "全部" | number;
type PlayerCounts = Record<FilterGroup, number>;
type PlayerPagePayload = { data?: PublicPlayerSummary[]; counts?: PlayerCounts; page?: number; hasMore?: boolean; error?: string };
type SearchPayload = { data?: PublicPlayerSummary[]; total?: number; page?: number; hasMore?: boolean; error?: string };

const PAGE_SIZE = 120;
let persistedPlayers: PublicPlayerSummary[] = [];
let persistedCounts: PlayerCounts = { 全部: 0, 少年组: 0, 青年组: 0 };
let persistedLoadedPage = 0;
const persistedPageCache = new Map<number, PublicPlayerSummary[]>();
const persistedDetailCache = new Map<string, PublicPlayerDetail>();

function mergePlayers(current: PublicPlayerSummary[], incoming: PublicPlayerSummary[]) {
  const byId = new Map(current.map((player) => [player.id, player]));
  incoming.forEach((player) => byId.set(player.id, player));
  return [...byId.values()].sort((a, b) => b.totalPoints - a.totalPoints || a.name.localeCompare(b.name, "zh-CN") || a.id.localeCompare(b.id));
}

function flag(code: string) { return code.toUpperCase() === "CN" ? "🇨🇳" : "🌐"; }
function countryName(code: string) { return code.toUpperCase() === "CN" ? "中国" : code.toUpperCase(); }
function genderName(value: string | null) {
  if (!value) return "○ 未录入";
  const normalized = value.toLowerCase();
  if (normalized === "male" || value === "男") return "♂ 男";
  if (normalized === "female" || value === "女") return "♀ 女";
  return value;
}
function formatPoints(value: number) { return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(value); }
function formatMoney(value: number) { return `¥${new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 }).format(value)}`; }
function PlayerAvatar({name,large=false}:{name:string;large?:boolean}) { return <span className={large ? styles.detailAvatar : styles.listAvatar}>{name.slice(0,1)}</span>; }

function YearSwitch({years,value,onChange}:{years:number[];value:YearFilter;onChange:(value:YearFilter)=>void}) {
  return <nav className={styles.yearSwitch} aria-label="选择年份">
    <button className={value === "全部" ? styles.active : ""} onClick={()=>onChange("全部")}>全部</button>
    {years.map(year=><button className={value === year ? styles.active : ""} onClick={()=>onChange(year)} key={year}>{year}</button>)}
  </nav>;
}

function aggregate(events: PublicPlayerEvent[]) {
  const best = [...events].sort((a,b)=>a.resultRank-b.resultRank)[0];
  return {
    stationCount: events.length,
    matchCount: events.reduce((sum,item)=>sum+item.matchCount,0),
    scoredMatchCount: events.reduce((sum,item)=>sum+item.scoredMatchCount,0),
    racks: events.reduce((sum,item)=>sum+item.racks,0),
    wonRacks: events.reduce((sum,item)=>sum+item.wonRacks,0),
    champions: events.filter(item=>item.bestResult === "冠军").length,
    bestResult: best?.bestResult ?? "—",
    points: events.reduce((sum,item)=>sum+item.points,0),
    prizeYuan: events.reduce((sum,item)=>sum+item.prizeYuan,0),
  };
}

function DetailPanel({detail,onClose}:{detail:PublicPlayerDetail;onClose:()=>void}) {
  const [tab,setTab]=useState<DetailTab>("data");
  const [year,setYear]=useState<YearFilter>("全部");
  const years=useMemo(()=>[...new Set(detail.events.map(item=>item.year))].sort((a,b)=>b-a),[detail.events]);
  const visibleEvents=useMemo(()=>year === "全部" ? detail.events : detail.events.filter(item=>item.year===year),[detail.events,year]);
  const stats=useMemo(()=>aggregate(visibleEvents),[visibleEvents]);

  useEffect(()=>{
    const previous=document.body.style.overflow;
    document.body.style.overflow="hidden";
    return ()=>{document.body.style.overflow=previous};
  },[]);

  return <div className={styles.overlay}>
    <aside className={styles.detailPanel}>
      <button className={styles.close} onClick={onClose} aria-label="关闭">×</button>
      <header className={styles.detailHeader}>
        <PlayerAvatar name={detail.name} large/>
        <div className={styles.identity}>
          <span className={styles.country}>{flag(detail.nationalityCode)} {countryName(detail.nationalityCode)}</span>
          <h2>{detail.displayName}</h2>
          <div className={styles.identityMeta}><span>{genderName(detail.gender)}</span><b>{detail.currentGroupCode}</b><span>{detail.currentGroup}</span></div>
        </div>
      </header>
      <nav className={styles.detailTabs}><button className={tab==="data"?styles.active:""} onClick={()=>setTab("data")}>数据</button><button className={tab==="events"?styles.active:""} onClick={()=>setTab("events")}>赛事</button></nav>
      <div className={styles.detailToolbar}><strong>{tab==="data"?"球员数据":"参赛赛事"}</strong><YearSwitch years={years} value={year} onChange={setYear}/></div>
      {tab==="data" ? <>
        <section className={styles.statsGrid}>
          <article><strong>{stats.stationCount}</strong><span>参与赛事</span></article><article><strong>{stats.matchCount}</strong><span>场次</span></article>
          <article><strong>{stats.scoredMatchCount ? stats.racks : "—"}</strong><span>局数</span></article><article><strong>{stats.scoredMatchCount ? stats.wonRacks : "—"}</strong><span>胜局</span></article>
          <article><strong>{stats.champions}</strong><span>冠军数量</span></article><article><strong>{stats.bestResult}</strong><span>最好成绩</span></article>
          <article><strong>{formatPoints(stats.points)}</strong><span>最新总积分</span></article><article><strong>{formatMoney(stats.prizeYuan)}</strong><span>总奖金</span></article>
        </section>
        <p className={styles.pointsNote}>积分按当前华彩系列赛 E 级赛事规则计算：名次积分 = 奖金金额÷100；参赛积分 = 参赛费÷100，100元以下不计。局数、胜局按数据库已录入比分统计；早期未录入比分的场次不计入局数。</p>
      </> : <section className={styles.eventList}>
        {visibleEvents.length ? visibleEvents.map(item=><article className={styles.eventTag} key={item.eventId}><header><div><small>{item.year} · {item.city}</small><h3>{item.title}</h3></div><strong>{item.bestResult}</strong></header><div className={styles.eventMetrics}><span><b>{item.groupCode}</b>{item.group}</span><span><b>{item.matchCount}</b>场次</span><span><b>{item.scoredMatchCount ? item.racks : "—"}</b>局数</span><span><b>{item.scoredMatchCount ? item.wonRacks : "—"}</b>胜局</span><span><b>{formatPoints(item.points)}</b>积分</span><span><b>{formatMoney(item.prizeYuan)}</b>奖金</span></div></article>) : <div className={styles.empty}>该年份暂无参赛数据</div>}
      </section>}
    </aside>
  </div>;
}

function PlayerLoadingShell() {
  return <div className={styles.root}>
    <section className={styles.hero}><div><small>球员数据库</small><h1>球员数据</h1><p>查看华彩系列赛球员档案、参赛成绩与积分数据</p></div><label><span>⌕</span><input disabled placeholder="搜索球员姓名" /></label></section>
    <section className={styles.listCard}><header className={styles.listHead}><div><small>公开球员</small><h2>全部球员</h2></div></header><div className={styles.countLine}><span>正在读取球员列表…</span><small>页面框架已就绪，数据加载完成后会自动显示</small></div><div className={styles.empty}>首次读取后，切换菜单不会重复加载整页数据。</div></section>
  </div>;
}

function PlayerBrowser({players,counts,loadingMore,loadNextPage}:{players:PublicPlayerSummary[];counts:PlayerCounts;loadingMore:boolean;loadNextPage:()=>Promise<void>}) {
  const [query,setQuery]=useState("");
  const [group,setGroup]=useState<FilterGroup>("全部");
  const [limit,setLimit]=useState(PAGE_SIZE);
  const [selected,setSelected]=useState<PublicPlayerDetail|null>(null);
  const [loadingId,setLoadingId]=useState<string|null>(null);
  const [searchRows,setSearchRows]=useState<PublicPlayerSummary[]>([]);
  const [searchTotal,setSearchTotal]=useState(0);
  const [searchPage,setSearchPage]=useState(0);
  const [searchHasMore,setSearchHasMore]=useState(false);
  const [searching,setSearching]=useState(false);
  const searchRequest=useRef(0);

  useEffect(()=>{
    const needle=query.trim();
    if(!needle){setSearchRows([]);setSearchTotal(0);setSearchPage(0);setSearchHasMore(false);setSearching(false);return}
    const requestId=++searchRequest.current;
    setSearching(true);setLimit(PAGE_SIZE);
    const timer=window.setTimeout(async()=>{
      try{
        const params=new URLSearchParams({q:needle,group,page:"1"});
        const response=await fetch(`/api/public/players/search?${params.toString()}`);
        const payload=await response.json() as SearchPayload;
        if(requestId!==searchRequest.current)return;
        if(!response.ok||!payload.data)throw new Error(payload.error||"球员搜索失败。");
        setSearchRows(payload.data);setSearchTotal(payload.total??payload.data.length);setSearchPage(payload.page??1);setSearchHasMore(Boolean(payload.hasMore));
      }catch{if(requestId===searchRequest.current){setSearchRows([]);setSearchTotal(0);setSearchPage(0);setSearchHasMore(false)}}
      finally{if(requestId===searchRequest.current)setSearching(false)}
    },250);
    return()=>window.clearTimeout(timer);
  },[query,group]);

  const filtered=useMemo(()=>query.trim()?searchRows:players.filter(player=>group==="全部"||player.group===group),[players,query,group,searchRows]);
  const visible=filtered.slice(0,limit);
  const totalForView=query.trim()?searchTotal:counts[group];
  const remaining=Math.max(totalForView-visible.length,0);
  const canShowMore=query.trim()?searchHasMore||visible.length<filtered.length:visible.length<filtered.length||filtered.length<counts[group];

  const loadMoreSearch=async()=>{
    if(!query.trim()||!searchHasMore||searching)return;
    setSearching(true);
    try{
      const nextPage=searchPage+1;
      const params=new URLSearchParams({q:query.trim(),group,page:String(nextPage)});
      const response=await fetch(`/api/public/players/search?${params.toString()}`);
      const payload=await response.json() as SearchPayload;
      if(!response.ok||!payload.data)throw new Error(payload.error||"更多搜索结果读取失败。");
      setSearchRows(current=>mergePlayers(current,payload.data!));setSearchPage(payload.page??nextPage);setSearchHasMore(Boolean(payload.hasMore));setSearchTotal(payload.total??searchTotal);
    }finally{setSearching(false)}
  };

  const showMore=async()=>{
    if(query.trim()){
      if(visible.length>=filtered.length&&searchHasMore)await loadMoreSearch();
      setLimit(value=>value+PAGE_SIZE);
      return;
    }
    if(visible.length>=filtered.length&&filtered.length<counts[group])await loadNextPage();
    setLimit(value=>value+PAGE_SIZE);
  };

  const openPlayer=async(id:string)=>{
    const cached=persistedDetailCache.get(id);
    if(cached){setSelected(cached);return}
    setLoadingId(id);
    try{
      const response=await fetch(`/api/public/players/${encodeURIComponent(id)}`);
      if(!response.ok)return;
      const detail=await response.json() as PublicPlayerDetail;
      persistedDetailCache.set(id,detail);setSelected(detail);
    }finally{setLoadingId(null)}
  };

  return <div className={styles.root}>
    <section className={styles.hero}><div><small>球员数据库</small><h1>球员数据</h1><p>查看华彩系列赛球员档案、参赛成绩与积分数据</p></div><label><span>⌕</span><input value={query} onChange={event=>{setQuery(event.target.value);setLimit(PAGE_SIZE)}} placeholder="搜索球员姓名"/></label></section>
    <section className={styles.listCard}>
      <header className={styles.listHead}><div><small>公开球员</small><h2>{query?`“${query}”的结果`:"全部球员"}</h2></div><div className={styles.groupFilters}>{(["全部","少年组","青年组"] as FilterGroup[]).map(item=><button className={group===item?styles.active:""} onClick={()=>{setGroup(item);setLimit(PAGE_SIZE)}} key={item}>{item}</button>)}</div></header>
      <div className={styles.countLine}><span>{searching&&query.trim()?"正在搜索全部球员…":`共 ${totalForView} 人`}</span><small>按总积分从高到低排序 · 同名选手按身份 ID 区分</small></div>
      <div className={styles.playerGrid}>{visible.map(player=><button className={styles.playerCard} onClick={()=>openPlayer(player.id)} key={player.id} title={`总积分 ${formatPoints(player.totalPoints)}`}><PlayerAvatar name={player.name}/><div className={styles.playerCopy}><strong>{player.displayName}</strong><small><b>{player.groupCode}</b>{player.group} · {player.stationCount}站 · 最好 {player.bestResult}</small></div><i>{loadingId===player.id?"…":"›"}</i></button>)}</div>
      {canShowMore?<button className={styles.more} disabled={loadingMore||searching} onClick={showMore}>{loadingMore||searching?"正在读取更多球员…":`显示更多（还有 ${remaining} 人）`}</button>:null}
      {!searching&&!filtered.length?<div className={styles.empty}>没有找到符合条件的球员</div>:null}
    </section>
    {selected?<DetailPanel detail={selected} onClose={()=>setSelected(null)}/>:null}
  </div>;
}

export default function PlayerDbView() {
  const [target,setTarget]=useState<HTMLElement|null>(null);
  const [players,setPlayers]=useState<PublicPlayerSummary[]>(()=>persistedPlayers);
  const [counts,setCounts]=useState<PlayerCounts>(()=>persistedCounts);
  const [loadedPage,setLoadedPage]=useState(()=>persistedLoadedPage);
  const [loading,setLoading]=useState(()=>persistedLoadedPage===0);
  const [loadingMore,setLoadingMore]=useState(false);
  const [error,setError]=useState("");
  const loaded=useRef(persistedLoadedPage>0);
  const loadingRef=useRef(false);
  const pageLoadingRef=useRef(false);

  const prefetchPage=async(page:number)=>{
    const maxPages=Math.max(1,Math.ceil(Math.max(persistedCounts.少年组,persistedCounts.青年组)/PAGE_SIZE));
    if(page<=1||page>maxPages||persistedPageCache.has(page))return;
    try{
      const response=await fetch(`/api/public/players/page/${page}`);
      const payload=await response.json() as PlayerPagePayload;
      if(response.ok&&payload.data)persistedPageCache.set(page,payload.data);
    }catch{}
  };

  const loadNextPage=async()=>{
    if(pageLoadingRef.current)return;
    const nextPage=loadedPage+1;
    const maxPages=Math.max(1,Math.ceil(Math.max(counts.少年组,counts.青年组)/PAGE_SIZE));
    if(nextPage>maxPages)return;
    pageLoadingRef.current=true;setLoadingMore(true);
    try{
      let pageRows=persistedPageCache.get(nextPage);
      if(!pageRows){
        const response=await fetch(`/api/public/players/page/${nextPage}`);
        const payload=await response.json() as PlayerPagePayload;
        if(!response.ok||!payload.data)throw new Error(payload.error||"更多球员数据读取失败。");
        pageRows=payload.data;persistedPageCache.set(nextPage,pageRows);
      }
      const merged=mergePlayers(players,pageRows);
      persistedPlayers=merged;persistedLoadedPage=nextPage;setPlayers(merged);setLoadedPage(nextPage);
      void prefetchPage(nextPage+1);
    }catch(reason){setError(reason instanceof Error?reason.message:"更多球员数据读取失败。")}
    finally{pageLoadingRef.current=false;setLoadingMore(false)}
  };

  useEffect(()=>{
    let original:HTMLElement|null=null;
    let host:HTMLElement|null=null;
    const load=async()=>{
      if(loaded.current||loadingRef.current)return;
      loadingRef.current=true;setLoading(true);setError("");
      try{
        const response=await fetch("/api/public/players");
        const payload=await response.json() as PlayerPagePayload;
        if(!response.ok||!payload.data)throw new Error(payload.error||"球员数据读取失败。");
        const fallbackCounts:PlayerCounts={全部:payload.data.length,少年组:payload.data.filter(player=>player.group==="少年组").length,青年组:payload.data.filter(player=>player.group==="青年组").length};
        const nextCounts=payload.counts??fallbackCounts;
        persistedPlayers=payload.data;persistedCounts=nextCounts;persistedLoadedPage=1;
        setPlayers(payload.data);setCounts(nextCounts);setLoadedPage(1);loaded.current=true;
        window.setTimeout(()=>{void prefetchPage(2)},150);
      }catch(reason){setError(reason instanceof Error?reason.message:"球员数据读取失败。")}
      finally{loadingRef.current=false;setLoading(false)}
    };
    const sync=()=>{
      const root=document.querySelector<HTMLElement>("main[data-huacai-view]");
      const active=root?.dataset.huacaiView==="players";
      const hero=active?document.querySelector<HTMLElement>(".player-hero"):null;
      const stack=hero?.closest<HTMLElement>(".stack")??null;
      if(!stack){if(original)original.style.display="";original=null;if(host){host.remove();host=null}setTarget(current=>current===null?current:null);return}
      if(original!==stack){if(original)original.style.display="";original=stack}
      stack.style.display="none";
      if(!host||!host.isConnected){host=document.createElement("div");host.dataset.playerDbHost="true";stack.insertAdjacentElement("afterend",host)}
      setTarget(current=>current===host?current:host);void load();
    };
    window.addEventListener("huacai:navigation",sync);sync();
    return()=>{window.removeEventListener("huacai:navigation",sync);if(original)original.style.display="";if(host)host.remove()};
  },[]);

  if(!target)return null;
  if(loading&&!players.length)return createPortal(<PlayerLoadingShell/>,target);
  if(error&&!players.length)return createPortal(<div className={styles.root}><section className={styles.listCard}><div className={styles.empty}>{error}</div></section></div>,target);
  return createPortal(<PlayerBrowser players={players} counts={counts} loadingMore={loadingMore} loadNextPage={loadNextPage}/>,target);
}
