"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import rawData from "./data/langfang-static-results.json";

type Group = "少年组" | "青年组";
type AgeKey = "s" | "y";
type CompactMatch = [string,string,string,string,string];
type StaticData = {
  r: Record<AgeKey,string[]>;
  f: Record<AgeKey,Record<string,CompactMatch[]>>;
  k: Record<AgeKey,CompactMatch[]>;
};
type ExpandedMatch = {
  phase:"正赛第一阶段"|"正赛第二阶段";
  pool:string;
  code:string;
  round:string;
  date:string;
  time:string;
  a:string;
  sa:string;
  b:string;
  sb:string;
};

const data = rawData as unknown as StaticData;
const pools = ["A","B","C","D","E","F","G","H"];
const rankingPrize: Record<Group,Record<string,string>> = {
  少年组:{冠军:"¥50,000",亚军:"¥30,000",季军:"¥15,000",殿军:"¥10,000","8强":"¥3,500","16强":"¥2,000","32强":"¥1,000","64强":"¥600"},
  青年组:{冠军:"¥60,000",亚军:"¥30,000",季军:"¥15,000",殿军:"¥10,000","8强":"¥3,500","16强":"¥2,000","32强":"¥1,000","64强":"¥600"},
};

const ageKey = (group:Group):AgeKey => group==="少年组"?"s":"y";
const tierForPlace = (place:number) => place===1?"冠军":place===2?"亚军":place===3?"季军":place===4?"殿军":place<=8?"8强":place<=16?"16强":place<=32?"32强":"64强";
const scoreValue = (value:string) => value==="X"?-1:Number(value);
const winnerOf = (match:CompactMatch) => scoreValue(match[2])>scoreValue(match[4])?match[1]:match[3];
const displayDate = (date:string) => {const [,m,d]=date.split("-");return `${Number(m)}月${Number(d)}日`;};

const medalBackground = (place:number) => {
  if(place===1)return "linear-gradient(145deg,#f5d36c,#c99316)";
  if(place===2)return "linear-gradient(145deg,#d9dde5,#8e96a4)";
  if(place===3)return "linear-gradient(145deg,#d99a68,#9a5a36)";
  if(place===4)return "linear-gradient(145deg,#7b52e8,#5122c0)";
  return undefined;
};

function firstRoundName(n:number){return n<=4?"第一轮":n<=6?"败部第一轮":n<=8?"胜部晋级轮":"败部晋级轮";}
function firstSchedule(group:Group,pool:string,n:number){
  if(group==="少年组"){
    if(n<=4)return ["2026-07-31",pool<="D"?"12:30":"17:00"] as const;
    if(n<=6)return ["2026-08-01","10:00"] as const;
    if(n<=8)return ["2026-08-01","15:00"] as const;
    return ["2026-08-01","19:30"] as const;
  }
  if(n<=4)return ["2026-07-31",pool<="D"?"10:00":"14:30"] as const;
  if(n<=6)return ["2026-07-31","19:30"] as const;
  if(n<=8)return ["2026-08-01","12:30"] as const;
  return ["2026-08-01","17:00"] as const;
}
function knockoutRoundName(n:number){return n<=16?"32进16":n<=24?"16进8":n<=28?"8进4":n<=30?"半决赛":n===31?"三四名决赛":"决赛";}
function knockoutSchedule(group:Group,n:number){
  if(group==="少年组"){
    if(n<=16)return ["2026-08-02","10:00"] as const;
    if(n<=24)return ["2026-08-02","15:00"] as const;
    if(n<=28)return ["2026-08-03","10:00"] as const;
    if(n<=30)return ["2026-08-03","15:00"] as const;
    if(n===31)return ["2026-08-04","10:00"] as const;
    return ["2026-08-04","13:00"] as const;
  }
  if(n<=16)return ["2026-08-02","12:30"] as const;
  if(n<=24)return ["2026-08-02","17:00"] as const;
  if(n<=28)return ["2026-08-03","12:30"] as const;
  if(n<=30)return ["2026-08-03","17:00"] as const;
  if(n===31)return ["2026-08-04","10:00"] as const;
  return ["2026-08-04","15:00"] as const;
}

function expandedMatches(group:Group):ExpandedMatch[]{
  const key=ageKey(group);
  const first=pools.flatMap(pool=>data.f[key][pool].map(match=>{
    const n=Number(match[0]),[date,time]=firstSchedule(group,pool,n);
    return {phase:"正赛第一阶段" as const,pool,code:`${pool}${n}`,round:firstRoundName(n),date,time,a:match[1],sa:match[2],b:match[3],sb:match[4]};
  }));
  const second=data.k[key].map(match=>{
    const n=Number(match[0]),[date,time]=knockoutSchedule(group,n);
    return {phase:"正赛第二阶段" as const,pool:"",code:match[0],round:knockoutRoundName(n),date,time,a:match[1],sa:match[2],b:match[3],sb:match[4]};
  });
  return [...first,...second];
}

function ResultCard({match}:{match:ExpandedMatch}){
  const aWin=scoreValue(match.sa)>scoreValue(match.sb);
  return <article className="static-result-card">
    <header><span>场次 {match.code}</span><time>{displayDate(match.date)} {match.time}</time></header>
    <div className={aWin?"winner":""}><strong>{match.a}</strong><b>{match.sa}</b></div>
    <div className={!aWin?"winner":""}><strong>{match.b}</strong><b>{match.sb}</b></div>
  </article>;
}

function FirstStageBoard({group}:{group:Group}){
  const key=ageKey(group);
  return <div className="static-pools">{pools.map(pool=>{
    const records=data.f[key][pool];
    const matches=records.map(rec=>{const n=Number(rec[0]),[date,time]=firstSchedule(group,pool,n);return {phase:"正赛第一阶段" as const,pool,code:`${pool}${n}`,round:firstRoundName(n),date,time,a:rec[1],sa:rec[2],b:rec[3],sb:rec[4]};});
    const qualifiers=records.filter(rec=>Number(rec[0])>=7).map(winnerOf);
    const sections=["第一轮","胜部晋级轮","败部第一轮","败部晋级轮"];
    return <section className="static-pool" key={pool}>
      <header className="static-pool-head"><div><span>{pool}组</span><strong>双败淘汰赛</strong></div><aside><small>晋级32强</small>{qualifiers.map(name=><b key={name}>{name}</b>)}</aside></header>
      <div className="static-rounds">{sections.map(round=><section key={round}><h3>{round}</h3>{matches.filter(match=>match.round===round).map(match=><ResultCard match={match} key={match.code}/>)}</section>)}</div>
    </section>;
  })}</div>;
}

function SecondStageBoard({group}:{group:Group}){
  const key=ageKey(group);
  const matches=data.k[key].map(rec=>{const n=Number(rec[0]),[date,time]=knockoutSchedule(group,n);return {phase:"正赛第二阶段" as const,pool:"",code:rec[0],round:knockoutRoundName(n),date,time,a:rec[1],sa:rec[2],b:rec[3],sb:rec[4]};});
  const rounds=["32进16","16进8","8进4","半决赛","决赛","三四名决赛"];
  return <div className="static-knockout">{rounds.map(round=><section className="static-knockout-round" key={round}><h3>{round}</h3><div>{matches.filter(match=>match.round===round).map(match=><ResultCard match={match} key={match.code}/>)}</div></section>)}</div>;
}

function RankingPanel({group}:{group:Group}){
  const names=data.r[ageKey(group)];
  return <section className="card ranking static-ranking">
    <header><div><small>{group}</small><h2>64强最终排名</h2></div><b>已录入 {names.length} 人</b></header>
    <div className="prizes" style={{marginTop:0}}>{names.map((name,index)=>{
      const place=index+1,tier=tierForPlace(place),medal=medalBackground(place);
      return <div key={`${group}-${place}-${name}`} style={{gridTemplateColumns:"36px 62px minmax(0,1fr) auto",gap:"10px"}}>
        <span style={medal?{background:medal,color:"#fff",fontWeight:900}:{fontWeight:800}}>{place}</span>
        <strong style={{color:place<=4?"#3f207f":"#716b7e"}}>{tier}</strong>
        <strong style={{fontSize:"12px",color:"#171528"}}>{name}</strong>
        <b>{rankingPrize[group][tier]}</b>
      </div>;
    })}</div>
    <p className="static-data-note">33—64序号按正赛第一阶段签位顺序展示，名次档位均为64强。</p>
  </section>;
}

function BracketPanel({group,phase}:{group:Group;phase:"正赛第一阶段"|"正赛第二阶段"}){
  return <section className="draw-shell static-results-shell">
    <div className="static-results-title"><div><small>{group} · 已录入真实赛果</small><h2>{phase}</h2><p>{phase==="正赛第一阶段"?"A—H组双败淘汰赛，包含比分、时间、场次编号与晋级结果。":"32强单败至冠军，包含全部淘汰轮次及三四名决赛。"}</p></div><b>{phase==="正赛第一阶段"?"80场":"32场"}</b></div>
    {phase==="正赛第一阶段"?<FirstStageBoard group={group}/>:<SecondStageBoard group={group}/>}
    <p className="static-data-note">签表PDF明确标注的是场次编号（A1—H10 / 1—32），未见独立球台号字段；本页按原表场次编号录入。</p>
  </section>;
}

function MatchPanel({group}:{group:Group}){
  const [day,setDay]=useState("2026-07-31");
  const [query,setQuery]=useState("");
  const all=useMemo(()=>expandedMatches(group),[group]);
  const days=["2026-07-31","2026-08-01","2026-08-02","2026-08-03","2026-08-04"];
  const shown=all.filter(match=>match.date===day&&[match.a,match.b,match.code,match.round,match.pool].some(value=>value.includes(query.trim()))).sort((a,b)=>a.time.localeCompare(b.time)||a.code.localeCompare(b.code,undefined,{numeric:true}));
  return <section className="static-match-results">
    <div className="static-daybar">{days.map(value=><button className={day===value?"active":""} onClick={()=>setDay(value)} key={value}><small>{displayDate(value)}</small><b>{all.filter(match=>match.date===value).length}场</b></button>)}</div>
    <div className="static-search"><span><strong>{displayDate(day)}</strong>{group} · {shown.length}场对阵</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜索球员、场次或轮次"/></div>
    <div className="static-match-grid">{shown.map(match=><article className="static-list-match" key={`${match.phase}-${match.code}`}><header><div><b>{match.time}</b><span>{match.phase} · {match.pool?`${match.pool}组 · `:""}{match.round}</span></div><strong>场次 {match.code}</strong></header><section><div className={scoreValue(match.sa)>scoreValue(match.sb)?"winner":""}><span>{match.a}</span><b>{match.sa}</b></div><i>:</i><div className={scoreValue(match.sb)>scoreValue(match.sa)?"winner":""}><b>{match.sb}</b><span>{match.b}</span></div></section></article>)}</div>
    {!shown.length&&<div className="static-empty">没有符合条件的比赛。</div>}
    <p className="static-data-note">当前静态页已补录正赛第一阶段与第二阶段赛果；签表未单独标注球台号，因此不把场次编号误写为台号。</p>
  </section>;
}

const styles=`
.static-data-note{margin:14px 0 0;color:#8f8799;font-size:9px;line-height:1.65}.static-results-title{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:18px}.static-results-title small{color:#8d7aaa;font-size:9px;font-weight:800;letter-spacing:.08em}.static-results-title h2{margin:5px 0 4px;font-size:22px}.static-results-title p{margin:0;color:#7a7283;font-size:10px}.static-results-title>b{padding:7px 10px;border-radius:999px;color:#5a35a0;background:#f0ebf9;font-size:10px}.static-pools{display:grid;gap:18px}.static-pool{border:1px solid #e9e5f0;border-radius:17px;overflow:hidden;background:#fbfafd}.static-pool-head{padding:14px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;background:linear-gradient(90deg,#f3effb,#fbf9fd)}.static-pool-head>div{display:flex;align-items:baseline;gap:9px}.static-pool-head>div span{font-size:17px;font-weight:900;color:#4f2995}.static-pool-head>div strong{font-size:10px;color:#7c7287}.static-pool-head aside{display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end}.static-pool-head aside small{color:#8c8394;font-size:8px}.static-pool-head aside b{padding:5px 7px;border-radius:8px;background:#fff;color:#4f2995;font-size:9px;border:1px solid #e7e0f1}.static-rounds{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:12px;padding:14px}.static-rounds>section,.static-knockout-round{min-width:0}.static-rounds h3,.static-knockout-round h3{margin:0 0 9px;color:#756a82;font-size:10px}.static-result-card{overflow:hidden;border:1px solid #e8e4ed;border-radius:11px;background:#fff;margin-bottom:8px}.static-result-card header{margin:0!important;padding:6px 8px;display:flex!important;align-items:center!important;justify-content:space-between!important;background:#f8f6fa;border-bottom:1px solid #eeeaf2}.static-result-card header span,.static-result-card header time{font-size:7px;color:#8a8192}.static-result-card>div{min-height:29px;padding:0 8px;display:flex;align-items:center;justify-content:space-between;gap:8px;border-bottom:1px solid #f2eff4}.static-result-card>div:last-child{border-bottom:0}.static-result-card strong{font-size:10px}.static-result-card>div b{font-size:11px;color:#7b7186}.static-result-card>div.winner strong,.static-result-card>div.winner b{color:#5429a2;font-weight:900}.static-knockout{display:grid;grid-template-columns:repeat(6,minmax(145px,1fr));gap:12px;align-items:start;overflow-x:auto;padding-bottom:7px}.static-knockout-round>div{min-width:145px}.static-match-results{display:flex;flex-direction:column;gap:14px}.static-daybar{display:grid;grid-template-columns:repeat(5,1fr);gap:7px}.static-daybar button{border:1px solid #e7e3ec;border-radius:12px;background:#fff;padding:10px 8px;display:flex;flex-direction:column;gap:4px;align-items:flex-start;cursor:pointer}.static-daybar button small{color:#756d7d;font-size:9px}.static-daybar button b{font-size:11px}.static-daybar button.active{border-color:#6f42ce;background:#f2ecfb;color:#4d2498}.static-search{display:flex;align-items:center;justify-content:space-between;gap:12px}.static-search span{display:flex;align-items:baseline;gap:8px;color:#766e7c;font-size:10px}.static-search span strong{color:#28174f;font-size:15px}.static-search input{width:min(320px,100%);height:39px;padding:0 12px;border:1px solid #e6e1eb;border-radius:10px;background:#fff;outline:0;font-size:10px}.static-match-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.static-list-match{border:1px solid #e8e4ed;border-radius:13px;background:#fff;overflow:hidden}.static-list-match header{padding:9px 11px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #eeeaf2;background:#faf9fb}.static-list-match header div{display:flex;align-items:baseline;gap:7px}.static-list-match header b{font-size:13px}.static-list-match header span{color:#817888;font-size:8px}.static-list-match header>strong{color:#5c329f;font-size:8px}.static-list-match section{padding:12px;display:grid;grid-template-columns:1fr 12px 1fr;align-items:center}.static-list-match section>div{display:flex;align-items:center;justify-content:space-between;gap:8px}.static-list-match section>div:last-child span{text-align:right}.static-list-match section span{font-size:11px;font-weight:700}.static-list-match section b{font-size:16px;color:#8b8390}.static-list-match section .winner span,.static-list-match section .winner b{color:#5429a2;font-weight:900}.static-list-match section i{font-size:10px;color:#aaa2af;text-align:center;font-style:normal}.static-empty{padding:40px;text-align:center;border-radius:14px;background:#f8f6fa;color:#8b8390;font-size:11px}
@media(max-width:900px){.static-rounds{grid-template-columns:1fr 1fr}.static-match-grid{grid-template-columns:1fr}.static-knockout{grid-template-columns:repeat(6,170px)}}
@media(max-width:620px){.static-pool-head{align-items:flex-start;flex-direction:column}.static-pool-head aside{justify-content:flex-start}.static-rounds{grid-template-columns:1fr}.static-daybar{grid-template-columns:repeat(5,96px);overflow-x:auto}.static-search{align-items:stretch;flex-direction:column}.static-search input{width:100%}}
`;

export default function LangfangRankingStatic(){
  const [rankingTarget,setRankingTarget]=useState<HTMLElement|null>(null);
  const [bracketTarget,setBracketTarget]=useState<HTMLElement|null>(null);
  const [matchTarget,setMatchTarget]=useState<HTMLElement|null>(null);
  const [group,setGroup]=useState<Group>("少年组");
  const [phase,setPhase]=useState<"正赛第一阶段"|"正赛第二阶段"|null>(null);

  useEffect(()=>{
    const hidden=new Set<HTMLElement>();
    const hide=(el:HTMLElement|null)=>{if(el){el.style.display="none";hidden.add(el);}};
    const restore=()=>{hidden.forEach(el=>el.style.display="");hidden.clear();};
    const sync=()=>{
      restore();
      const rankingCard=document.querySelector<HTMLElement>(".card.ranking:not(.static-ranking)");
      const rankingHead=document.querySelector<HTMLElement>(".ranking-head");
      if(rankingCard&&rankingHead){hide(rankingCard);setRankingTarget(current=>current===rankingCard.parentElement?current:rankingCard.parentElement);}else setRankingTarget(null);

      const bracketPage=document.querySelector<HTMLElement>(".bracket-page");
      const bracketShell=bracketPage?.querySelector<HTMLElement>(".draw-shell:not(.static-results-shell)")||null;
      const phaseText=bracketPage?.querySelector(".bracket-title h1")?.textContent?.trim()||"";
      const nextPhase=phaseText.includes("正赛第一阶段")?"正赛第一阶段":phaseText.includes("正赛第二阶段")?"正赛第二阶段":null;
      if(bracketPage&&bracketShell&&nextPhase){hide(bracketShell);setBracketTarget(current=>current===bracketPage?current:bracketPage);setPhase(current=>current===nextPhase?current:nextPhase);}else{setBracketTarget(null);setPhase(null);}

      const matchPage=document.querySelector<HTMLElement>(".match-list-page");
      if(matchPage){
        matchPage.querySelectorAll<HTMLElement>(".match-filter,.match-count,.versus-list,.match-empty").forEach(hide);
        setMatchTarget(current=>current===matchPage?current:matchPage);
      }else setMatchTarget(null);

      const active=document.querySelector<HTMLElement>(".ranking-head .group-switch button.active span,.bracket-title .group-switch button.active span,.match-list-head .group-switch button.active span");
      const text=active?.textContent?.trim();
      if(text==="少年组"||text==="青年组")setGroup(current=>current===text?current:text);
    };
    const frame=requestAnimationFrame(sync);
    const observer=new MutationObserver(sync);
    observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:["class"]});
    return ()=>{cancelAnimationFrame(frame);observer.disconnect();restore();};
  },[]);

  return <><style>{styles}</style>
    {rankingTarget&&createPortal(<RankingPanel group={group}/>,rankingTarget)}
    {bracketTarget&&phase&&createPortal(<BracketPanel group={group} phase={phase}/>,bracketTarget)}
    {matchTarget&&createPortal(<MatchPanel group={group}/>,matchTarget)}
  </>;
}
