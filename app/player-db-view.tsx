"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PublicPlayerDetail, PublicPlayerEvent, PublicPlayerSummary } from "@/db/player-data";
import styles from "./player-db.module.css";

type FilterGroup = "全部" | "少年组" | "青年组";
type DetailTab = "data" | "events";
type YearFilter = "全部" | number;

function flag(code: string) {
  return code.toUpperCase() === "CN" ? "🇨🇳" : "🌐";
}

function countryName(code: string) {
  return code.toUpperCase() === "CN" ? "中国" : code.toUpperCase();
}

function genderName(value: string | null) {
  if (!value) return "○ 未录入";
  const normalized = value.toLowerCase();
  if (normalized === "male" || value === "男") return "♂ 男";
  if (normalized === "female" || value === "女") return "♀ 女";
  return value;
}

function formatPoints(value: number) {
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(value);
}

function formatMoney(value: number) {
  return `¥${new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 }).format(value)}`;
}

function PlayerAvatar({name,large=false}:{name:string;large?:boolean}) {
  return <span className={large ? styles.detailAvatar : styles.listAvatar}>{name.slice(0,1)}</span>;
}

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
          <div className={styles.identityMeta}>
            <span>{genderName(detail.gender)}</span>
            <b>{detail.currentGroupCode}</b>
            <span>{detail.currentGroup}</span>
          </div>
        </div>
      </header>

      <nav className={styles.detailTabs}>
        <button className={tab==="data"?styles.active:""} onClick={()=>setTab("data")}>数据</button>
        <button className={tab==="events"?styles.active:""} onClick={()=>setTab("events")}>赛事</button>
      </nav>

      <div className={styles.detailToolbar}>
        <strong>{tab==="data"?"球员数据":"参赛赛事"}</strong>
        <YearSwitch years={years} value={year} onChange={setYear}/>
      </div>

      {tab==="data" ? <>
        <section className={styles.statsGrid}>
          <article><strong>{stats.stationCount}</strong><span>参与赛事</span></article>
          <article><strong>{stats.matchCount}</strong><span>场次</span></article>
          <article><strong>{stats.scoredMatchCount ? stats.racks : "—"}</strong><span>局数</span></article>
          <article><strong>{stats.scoredMatchCount ? stats.wonRacks : "—"}</strong><span>胜局</span></article>
          <article><strong>{stats.champions}</strong><span>冠军数量</span></article>
          <article><strong>{stats.bestResult}</strong><span>最好成绩</span></article>
          <article><strong>{formatPoints(stats.points)}</strong><span>最新总积分</span></article>
          <article><strong>{formatMoney(stats.prizeYuan)}</strong><span>总奖金</span></article>
        </section>
        <p className={styles.pointsNote}>积分按当前华彩系列赛 E 级赛事规则计算：名次积分 = 奖金金额÷100；参赛积分 = 参赛费÷100，100元以下不计。局数、胜局按数据库已录入比分统计；早期未录入比分的场次不计入局数。</p>
      </> : <section className={styles.eventList}>
        {visibleEvents.length ? visibleEvents.map(item=><article className={styles.eventTag} key={item.eventId}>
          <header>
            <div><small>{item.year} · {item.city}</small><h3>{item.title}</h3></div>
            <strong>{item.bestResult}</strong>
          </header>
          <div className={styles.eventMetrics}>
            <span><b>{item.groupCode}</b>{item.group}</span>
            <span><b>{item.matchCount}</b>场次</span>
            <span><b>{item.scoredMatchCount ? item.racks : "—"}</b>局数</span>
            <span><b>{item.scoredMatchCount ? item.wonRacks : "—"}</b>胜局</span>
            <span><b>{formatPoints(item.points)}</b>积分</span>
            <span><b>{formatMoney(item.prizeYuan)}</b>奖金</span>
          </div>
        </article>) : <div className={styles.empty}>该年份暂无参赛数据</div>}
      </section>}
    </aside>
  </div>;
}

function PlayerBrowser({players}:{players:PublicPlayerSummary[]}) {
  const [query,setQuery]=useState("");
  const [group,setGroup]=useState<FilterGroup>("全部");
  const [limit,setLimit]=useState(120);
  const [selected,setSelected]=useState<PublicPlayerDetail|null>(null);
  const [loadingId,setLoadingId]=useState<string|null>(null);
  const cache=useRef(new Map<string,PublicPlayerDetail>());

  const filtered=useMemo(()=>players.filter(player=>{
    if(group!=="全部"&&player.group!==group)return false;
    const needle=query.trim();
    return player.name.includes(needle)||player.displayName.includes(needle);
  }),[players,query,group]);
  const visible=filtered.slice(0,limit);

  const changeGroup=(value:FilterGroup)=>{setGroup(value);setLimit(120)};
  const changeQuery=(value:string)=>{setQuery(value);setLimit(120)};

  const openPlayer=async(id:string)=>{
    const cached=cache.current.get(id);
    if(cached){setSelected(cached);return}
    setLoadingId(id);
    try{
      const response=await fetch(`/api/public/players/${encodeURIComponent(id)}`);
      if(!response.ok)return;
      const detail=await response.json() as PublicPlayerDetail;
      cache.current.set(id,detail);
      setSelected(detail);
    }finally{setLoadingId(null)}
  };

  return <div className={styles.root}>
    <section className={styles.hero}>
      <div><small>球员数据库</small><h1>球员数据</h1><p>查看华彩系列赛球员档案、参赛成绩与积分数据</p></div>
      <label><span>⌕</span><input value={query} onChange={event=>changeQuery(event.target.value)} placeholder="搜索球员姓名"/></label>
    </section>

    <section className={styles.listCard}>
      <header className={styles.listHead}>
        <div><small>公开球员</small><h2>{query?`“${query}”的结果`:"全部球员"}</h2></div>
        <div className={styles.groupFilters}>
          {(["全部","少年组","青年组"] as FilterGroup[]).map(item=><button className={group===item?styles.active:""} onClick={()=>changeGroup(item)} key={item}>{item}</button>)}
        </div>
      </header>
      <div className={styles.countLine}><span>共 {filtered.length} 人</span><small>按总积分从高到低排序 · 同名选手按身份 ID 区分</small></div>
      <div className={styles.playerGrid}>
        {visible.map(player=><button className={styles.playerCard} onClick={()=>openPlayer(player.id)} key={player.id} title={`总积分 ${formatPoints(player.totalPoints)}`}>
          <PlayerAvatar name={player.name}/>
          <div className={styles.playerCopy}>
            <strong>{player.displayName}</strong>
            <small><b>{player.groupCode}</b>{player.group} · {player.stationCount}站 · 最好 {player.bestResult}</small>
          </div>
          <i>{loadingId===player.id?"…":"›"}</i>
        </button>)}
      </div>
      {visible.length<filtered.length?<button className={styles.more} onClick={()=>setLimit(value=>value+120)}>显示更多（还有 {filtered.length-visible.length} 人）</button>:null}
      {!filtered.length?<div className={styles.empty}>没有找到符合条件的球员</div>:null}
    </section>
    {selected?<DetailPanel detail={selected} onClose={()=>setSelected(null)}/>:null}
  </div>;
}

export default function PlayerDbView() {
  const [target,setTarget]=useState<HTMLElement|null>(null);
  const [players,setPlayers]=useState<PublicPlayerSummary[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const loaded=useRef(false);

  useEffect(()=>{
    let original:HTMLElement|null=null;
    let host:HTMLElement|null=null;

    const load=async()=>{
      if(loaded.current||loading)return;
      setLoading(true);setError("");
      try{
        const response=await fetch("/api/public/players");
        const payload=await response.json() as {data?:PublicPlayerSummary[];error?:string};
        if(!response.ok||!payload.data)throw new Error(payload.error||"球员数据读取失败。");
        setPlayers(payload.data);loaded.current=true;
      }catch(reason){setError(reason instanceof Error?reason.message:"球员数据读取失败。")}
      finally{setLoading(false)}
    };

    const sync=()=>{
      const root=document.querySelector<HTMLElement>("main[data-huacai-view]");
      const active=root?.dataset.huacaiView==="players";
      const hero=active?document.querySelector<HTMLElement>(".player-hero"):null;
      const stack=hero?.closest<HTMLElement>(".stack")??null;
      if(!stack){
        if(original)original.style.display="";
        original=null;
        if(host){host.remove();host=null}
        setTarget(current=>current===null?current:null);
        return;
      }
      if(original!==stack){if(original)original.style.display="";original=stack}
      stack.style.display="none";
      if(!host||!host.isConnected){host=document.createElement("div");host.dataset.playerDbHost="true";stack.insertAdjacentElement("afterend",host)}
      setTarget(current=>current===host?current:host);
      void load();
    };

    window.addEventListener("huacai:navigation",sync);
    sync();
    const preloadHandle=window.setTimeout(()=>{void load()},250);
    return()=>{window.removeEventListener("huacai:navigation",sync);window.clearTimeout(preloadHandle);if(original)original.style.display="";if(host)host.remove()};
  },[loading]);

  if(!target)return null;
  if(loading&&!players.length)return createPortal(<div className={styles.empty}>正在读取球员数据…</div>,target);
  if(error&&!players.length)return createPortal(<div className={styles.empty}>{error}</div>,target);
  return createPortal(<PlayerBrowser players={players}/>,target);
}
