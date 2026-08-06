"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import raw from "./data/langfang-static-results.json";

type Group = "少年组" | "青年组";
type Key = "s" | "y";
type RawMatch = [string,string,string,string,string];
type StaticData = { f:Record<Key,Record<string,RawMatch[]>>; k:Record<Key,RawMatch[]> };
type DisplayMatch = {
  code:string; playerA:string; scoreA:string; playerB:string; scoreB:string;
  date:string; time:string; progress:string; round:string; order:number;
};

const data = raw as unknown as StaticData;
const pools = ["A","B","C","D","E","F","G","H"];
const keyOf=(group:Group):Key=>group==="少年组"?"s":"y";
const scoreNumber=(value:string)=>value==="X"?-1:Number(value);
const winner=(match:RawMatch)=>scoreNumber(match[2])>scoreNumber(match[4])?match[1]:match[3];
const shortDate=(date:string)=>{const [,m,d]=date.split("-");return `${Number(m)}月${Number(d)}日`;};

function correctedFirst(group:Group,pool:string){
  const list=[...(data.f[keyOf(group)][pool]||[])];
  // Source PDF: 少年组 F4 为 谈炜琦 2 : 7 王梓豪元。
  if(group==="少年组"&&pool==="F"){
    const i=list.findIndex(item=>item[0]==="4");
    if(i>=0)list[i]=["4","谈炜琦","2","王梓豪元","7"];
  }
  return list;
}

function firstTiming(group:Group,pool:string,no:number){
  const late=pools.indexOf(pool)>=4;
  if(group==="少年组"){
    if(no<=4)return ["2026-7-31",late?"17:00":"12:30"] as const;
    if(no<=6)return ["2026-8-1","10:00"] as const;
    if(no<=8)return ["2026-8-1","15:00"] as const;
    return ["2026-8-1","19:30"] as const;
  }
  if(no<=4)return ["2026-7-31",late?"14:30":"10:00"] as const;
  if(no<=6)return ["2026-7-31","19:30"] as const;
  if(no<=8)return ["2026-8-1","12:30"] as const;
  return ["2026-8-1","17:00"] as const;
}

function secondTiming(group:Group,no:number){
  if(group==="少年组"){
    if(no<=16)return ["2026-8-2","10:00"] as const;
    if(no<=24)return ["2026-8-2","15:00"] as const;
    if(no<=28)return ["2026-8-3","10:00"] as const;
    if(no<=30)return ["2026-8-3","15:00"] as const;
    if(no===31)return ["2026-8-4","10:00"] as const;
    return ["2026-8-4","13:00"] as const;
  }
  if(no<=16)return ["2026-8-2","12:30"] as const;
  if(no<=24)return ["2026-8-2","17:00"] as const;
  if(no<=28)return ["2026-8-3","12:30"] as const;
  if(no<=30)return ["2026-8-3","17:00"] as const;
  if(no===31)return ["2026-8-4","10:00"] as const;
  return ["2026-8-4","15:00"] as const;
}

function firstRound(no:number){return no<=4?"第一轮":no<=6?"败部第一轮":no<=8?"胜部晋级轮":"败部晋级轮";}
function secondRound(no:number){return no<=16?"32进16":no<=24?"16进8":no<=28?"8进4":no<=30?"半决赛":no===31?"三四名决赛":"决赛";}

function allFinals(group:Group):DisplayMatch[]{
  const first=pools.flatMap(pool=>correctedFirst(group,pool).map(item=>{
    const no=Number(item[0]); const [date,time]=firstTiming(group,pool,no);
    return {code:`${pool}${no}`,playerA:item[1],scoreA:item[2],playerB:item[3],scoreB:item[4],date,time,progress:"正赛第一阶段",round:`${pool}组 · ${firstRound(no)}`,order:no};
  }));
  const second=(data.k[keyOf(group)]||[]).map(item=>{
    const no=Number(item[0]); const [date,time]=secondTiming(group,no);
    return {code:String(no),playerA:item[1],scoreA:item[2],playerB:item[3],scoreB:item[4],date,time,progress:"正赛第二阶段",round:secondRound(no),order:no};
  });
  return [...first,...second];
}

function readGroup(root:ParentNode):Group{
  return root.querySelector<HTMLElement>(".group-switch button.active span")?.textContent?.trim()==="青年组"?"青年组":"少年组";
}
function setText(el:Element|null,value:string){if(el&&el.textContent!==value)el.textContent=value;}

function MatchRows({matches}:{matches:DisplayMatch[]}){
  return <>{matches.map(match=><article className="versus-card" key={`${match.progress}-${match.code}-${match.playerA}`}>
    <header><b>{match.time}</b><span>{match.progress} · {match.round} · 第{match.order}场</span></header>
    <section>
      <div className="match-player"><i>{match.playerA.slice(0,1)}</i><strong>{match.playerA}</strong></div>
      <div className="match-center"><strong>{match.scoreA} : {match.scoreB}</strong><span className="ended">已结束</span><b>{match.code}</b></div>
      <div className="match-player"><i>{match.playerB.slice(0,1)}</i><strong>{match.playerB}</strong></div>
    </section>
  </article>)}</>;
}
function EmptyRows({group}:{group:Group}){
  return <><i>○</i><h2>当日对阵待公布</h2><p>{group}该日期的球员、比分和球台信息将在组委会确认后更新。</p></>;
}

function patchArticle(article:Element|undefined,raw:RawMatch|undefined,code:string,date:string,time:string){
  if(!article||!raw)return;
  const lines=article.querySelectorAll(".stage-competitor");
  if(lines[0]){setText(lines[0].querySelector("span"),raw[1]);setText(lines[0].querySelector("b"),raw[2]);}
  if(lines[1]){setText(lines[1].querySelector("span"),raw[3]);setText(lines[1].querySelector("b"),raw[4]);}
  setText(article.querySelector(".stage-between time"),`${shortDate(date)} ${time}`);
  setText(article.querySelector(".stage-between span"),code);
  setText(article.querySelector(".stage-game-no"),code);
}

function patchFirstStage(group:Group){
  const board=document.querySelector(".double-elim-phase-board");
  if(!board)return;
  const sections=Array.from(board.querySelectorAll<HTMLElement>(".double-elim-group"));
  sections.forEach((section,index)=>{
    const pool=pools[index];
    const matches=correctedFirst(group,pool);
    const articles=Array.from(section.querySelectorAll<HTMLElement>(".stage-tree-match"));
    // DOM order: first round 1-4, winner round 7-8, loser round 5-6, loser qualification 9-10.
    const order=[0,1,2,3,6,7,4,5,8,9];
    articles.forEach((article,articleIndex)=>{
      const rawMatch=matches[order[articleIndex]];
      if(!rawMatch)return;
      const no=Number(rawMatch[0]); const [date,time]=firstTiming(group,pool,no);
      patchArticle(article,rawMatch,`${pool}${no}`,date,time);
    });
    const terminals=Array.from(section.querySelectorAll<HTMLElement>(".terminal-player strong"));
    [6,7,8,9].forEach((rawIndex,terminalIndex)=>{
      const rawMatch=matches[rawIndex]; if(rawMatch)setText(terminals[terminalIndex],winner(rawMatch));
    });
  });
}

function patchSecondStage(group:Group){
  const tree=document.querySelector(".stage-knockout-tree");
  if(!tree||tree.closest(".qualification-phase-board"))return;
  const matches=data.k[keyOf(group)]||[];
  const byNo=new Map(matches.map(item=>[Number(item[0]),item]));
  const articles=Array.from(tree.querySelectorAll<HTMLElement>(".stage-tree-match"));
  // Third-place match 31 is not a node in the preserved original championship tree.
  const matchNos=[...Array.from({length:16},(_,i)=>i+1),...Array.from({length:8},(_,i)=>17+i),...Array.from({length:4},(_,i)=>25+i),29,30,32];
  articles.forEach((article,index)=>{
    const no=matchNos[index]; const rawMatch=byNo.get(no); if(!rawMatch)return;
    const [date,time]=secondTiming(group,no);
    patchArticle(article,rawMatch,String(no),date,time);
  });
  const final=byNo.get(32); if(final)setText(tree.querySelector(".terminal-player strong"),winner(final));
}

export default function LangfangFinalsEnhancer(){
  const [mount,setMount]=useState<HTMLElement|null>(null);
  const [group,setGroup]=useState<Group>("少年组");
  const [day,setDay]=useState("");
  const [query,setQuery]=useState("");
  const finals=useMemo(()=>allFinals(group),[group]);
  const visible=useMemo(()=>finals.filter(match=>match.date===day&&[match.playerA,match.playerB,match.code,match.progress,match.round].some(value=>value.includes(query.trim()))),[finals,day,query]);

  useEffect(()=>{
    let input:HTMLInputElement|null=null;
    let host:HTMLElement|null=null;
    const onInput=(e:Event)=>setQuery((e.target as HTMLInputElement).value);

    const sync=()=>{
      const matchPage=document.querySelector<HTMLElement>(".match-list-page");
      if(matchPage){
        const nextGroup=readGroup(matchPage); setGroup(current=>current===nextGroup?current:nextGroup);
        const active=matchPage.querySelector<HTMLElement>(".match-days button.active b")?.textContent?.trim()||"";
        if(active){const [m,d]=active.split("-");setDay(`2026-${Number(m)}-${Number(d)}`);}
        const nextInput=matchPage.querySelector<HTMLInputElement>(".match-filter input");
        if(nextInput!==input){if(input)input.removeEventListener("input",onInput);input=nextInput;if(input){input.addEventListener("input",onInput);setQuery(input.value);}}

        const isFinalDay=["07-31","08-01","08-02","08-03","08-04"].includes(active);
        const mustOverride=nextGroup==="青年组"||isFinalDay;
        const originals=matchPage.querySelectorAll<HTMLElement>(".versus-list:not([data-lf-finals]), .match-empty:not([data-lf-finals])");
        if(mustOverride){
          originals.forEach(el=>el.style.display="none");
          host=matchPage.querySelector<HTMLElement>("[data-lf-finals]");
          if(!host){host=document.createElement("section");host.dataset.lfFinals="true";matchPage.querySelector(".match-count")?.insertAdjacentElement("afterend",host);}
          host.className=visible.length?"versus-list":"match-empty";
          setMount(current=>current===host?current:host);
          const countText=matchPage.querySelector<HTMLElement>(".match-count span");
          if(countText)setText(countText,`${nextGroup} · ${visible.length}场对阵`);
        }else{
          originals.forEach(el=>el.style.display="");
          const owned=matchPage.querySelector<HTMLElement>("[data-lf-finals]"); if(owned)owned.remove();
          host=null; setMount(null);
        }
      }else{
        if(input){input.removeEventListener("input",onInput);input=null;}
        setMount(null);
      }

      const bracket=document.querySelector<HTMLElement>(".bracket-page");
      if(bracket){
        const nextGroup=readGroup(bracket);
        const title=bracket.querySelector<HTMLElement>(".bracket-title h1")?.textContent?.trim();
        if(title==="正赛第一阶段")patchFirstStage(nextGroup);
        if(title==="正赛第二阶段")patchSecondStage(nextGroup);
      }
    };

    sync();
    const timer=window.setInterval(sync,160);
    return ()=>{window.clearInterval(timer);if(input)input.removeEventListener("input",onInput);document.querySelector<HTMLElement>("[data-lf-finals]")?.remove();};
  },[visible.length]);

  if(!mount)return null;
  return createPortal(visible.length?<MatchRows matches={visible}/>:<EmptyRows group={group}/>,mount);
}
