"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import staticResults from "./data/langfang-static-results.json";

type Group = "少年组" | "青年组";
type RawMatch = [string,string,string,string,string];
type DisplayMatch = {
  code:string;
  playerA:string;
  scoreA:string;
  playerB:string;
  scoreB:string;
  date:string;
  time:string;
  progress:string;
  round:string;
  order:number;
};

type StaticData = {
  f:{s:Record<string,RawMatch[]>;y:Record<string,RawMatch[]>};
  k:{s:RawMatch[];y:RawMatch[]};
};

const data = staticResults as unknown as StaticData;
const letters=["A","B","C","D","E","F","G","H"];
const keyOf=(group:Group)=>group==="少年组"?"s":"y" as const;
const dateLabel=(date:string)=>{const [,month,day]=date.split("-");return `${Number(month)}月${Number(day)}日`;};
const winner=(match:RawMatch)=>{
  const [,a,sa,b,sb]=match;
  if(sa==="X")return b;
  if(sb==="X")return a;
  return Number(sa)>Number(sb)?a:b;
};

function firstStageTiming(group:Group,letter:string,no:number){
  const late=letters.indexOf(letter)>=4;
  if(group==="少年组"){
    if(no<=4)return {date:"2026-7-31",time:late?"17:00":"12:30"};
    if(no<=6)return {date:"2026-8-1",time:"10:00"};
    if(no<=8)return {date:"2026-8-1",time:"15:00"};
    return {date:"2026-8-1",time:"19:30"};
  }
  if(no<=4)return {date:"2026-7-31",time:late?"14:30":"10:00"};
  if(no<=6)return {date:"2026-7-31",time:"19:30"};
  if(no<=8)return {date:"2026-8-1",time:"12:30"};
  return {date:"2026-8-1",time:"17:00"};
}

function firstStageRound(no:number){
  if(no<=4)return "第一轮";
  if(no<=6)return "败部第一轮";
  if(no<=8)return "胜部晋级轮";
  return "败部晋级轮";
}

function secondStageTiming(group:Group,no:number){
  if(group==="少年组"){
    if(no<=16)return {date:"2026-8-2",time:"10:00"};
    if(no<=24)return {date:"2026-8-2",time:"15:00"};
    if(no<=28)return {date:"2026-8-3",time:"10:00"};
    if(no<=30)return {date:"2026-8-3",time:"15:00"};
    if(no===31)return {date:"2026-8-4",time:"10:00"};
    return {date:"2026-8-4",time:"13:00"};
  }
  if(no<=16)return {date:"2026-8-2",time:"12:30"};
  if(no<=24)return {date:"2026-8-2",time:"17:00"};
  if(no<=28)return {date:"2026-8-3",time:"12:30"};
  if(no<=30)return {date:"2026-8-3",time:"17:00"};
  if(no===31)return {date:"2026-8-4",time:"10:00"};
  return {date:"2026-8-4",time:"15:00"};
}

function secondStageRound(no:number){
  if(no<=16)return "32进16";
  if(no<=24)return "16进8";
  if(no<=28)return "8进4";
  if(no<=30)return "半决赛";
  if(no===31)return "三四名决赛";
  return "决赛";
}

function allStaticMatches(group:Group):DisplayMatch[]{
  const key=keyOf(group);
  const first=letters.flatMap(letter=>(data.f[key][letter]||[]).map(raw=>{
    const no=Number(raw[0]);
    const timing=firstStageTiming(group,letter,no);
    return {code:`${letter}${no}`,playerA:raw[1],scoreA:raw[2],playerB:raw[3],scoreB:raw[4],...timing,progress:"正赛第一阶段",round:`${letter}组 · ${firstStageRound(no)}`,order:no};
  }));
  const second=(data.k[key]||[]).map(raw=>{
    const no=Number(raw[0]);
    const timing=secondStageTiming(group,no);
    return {code:`M${no}`,playerA:raw[1],scoreA:raw[2],playerB:raw[3],scoreB:raw[4],...timing,progress:"正赛第二阶段",round:secondStageRound(no),order:no};
  });
  return [...first,...second];
}

function readGroup(root:ParentNode=document):Group{
  const active=root.querySelector<HTMLElement>(".group-switch button.active span")?.textContent?.trim();
  return active==="青年组"?"青年组":"少年组";
}

function setText(el:Element|null,value:string){if(el&&el.textContent!==value)el.textContent=value;}

function patchTreeArticle(article:Element|undefined,raw:RawMatch|undefined,code:string,date:string,time:string){
  if(!article||!raw)return;
  const players=article.querySelectorAll(".stage-competitor");
  if(players[0]){setText(players[0].querySelector("span"),raw[1]);setText(players[0].querySelector("b"),raw[2]);}
  if(players[1]){setText(players[1].querySelector("span"),raw[3]);setText(players[1].querySelector("b"),raw[4]);}
  setText(article.querySelector(".stage-between time"),`${dateLabel(date)} ${time}`);
  setText(article.querySelector(".stage-between span"),`场次 ${code}`);
  setText(article.querySelector(".stage-game-no"),code);
}

function patchFirstStage(group:Group){
  const board=document.querySelector(".double-elim-phase-board");
  if(!board)return;
  const key=keyOf(group);
  const groups=Array.from(board.querySelectorAll<HTMLElement>(".double-elim-group"));
  groups.forEach((section,index)=>{
    const letter=letters[index];
    const matches=data.f[key][letter]||[];
    const articles=Array.from(section.querySelectorAll<HTMLElement>(".stage-tree-match"));
    const order=[0,1,2,3,6,7,4,5,8,9];
    articles.forEach((article,articleIndex)=>{
      const rawIndex=order[articleIndex];
      const raw=matches[rawIndex];
      if(!raw)return;
      const no=Number(raw[0]);
      const timing=firstStageTiming(group,letter,no);
      patchTreeArticle(article,raw,`${letter}${no}`,timing.date,timing.time);
    });
    const terminals=Array.from(section.querySelectorAll<HTMLElement>(".terminal-player strong"));
    [6,7,8,9].forEach((rawIndex,terminalIndex)=>{
      const raw=matches[rawIndex];
      if(raw)setText(terminals[terminalIndex],winner(raw));
    });
  });
}

function patchSecondStage(group:Group){
  const tree=document.querySelector(".stage-knockout-tree");
  if(!tree||tree.closest(".qualification-phase-board"))return;
  const key=keyOf(group);
  const matches=data.k[key]||[];
  const byNo=new Map(matches.map(raw=>[Number(raw[0]),raw]));
  const articles=Array.from(tree.querySelectorAll<HTMLElement>(".stage-tree-match"));
  const matchNos=[...Array.from({length:16},(_,i)=>i+1),...Array.from({length:8},(_,i)=>17+i),...Array.from({length:4},(_,i)=>25+i),29,30,32];
  articles.forEach((article,index)=>{
    const no=matchNos[index];
    const raw=byNo.get(no);
    if(!raw)return;
    const timing=secondStageTiming(group,no);
    patchTreeArticle(article,raw,`M${no}`,timing.date,timing.time);
  });
  const final=byNo.get(32);
  if(final)setText(tree.querySelector(".terminal-player strong"),winner(final));
}

function StaticMatchCards({matches}:{matches:DisplayMatch[]}){
  return <section className="versus-list static-versus-list">{matches.map(match=><article className="versus-card" key={`${match.code}-${match.playerA}-${match.playerB}`}>
    <header><b>{match.time}</b><span>{match.progress} · {match.round} · 第{match.order}场</span></header>
    <section>
      <div className="match-player"><i>{match.playerA.slice(0,1)}</i><strong>{match.playerA}</strong></div>
      <div className="match-center"><strong>{match.scoreA} : {match.scoreB}</strong><span className="ended">已结束</span><b>{match.code}</b></div>
      <div className="match-player"><i>{match.playerB.slice(0,1)}</i><strong>{match.playerB}</strong></div>
    </section>
  </article>)}</section>;
}

export default function LangfangStaticEnhancer(){
  const [mount,setMount]=useState<HTMLElement|null>(null);
  const [group,setGroup]=useState<Group>("少年组");
  const [day,setDay]=useState("");
  const [query,setQuery]=useState("");
  const allMatches=useMemo(()=>allStaticMatches(group),[group]);
  const visible=useMemo(()=>allMatches.filter(match=>match.date===day&&[match.playerA,match.playerB,match.code,match.progress,match.round].some(value=>value.includes(query.trim()))),[allMatches,day,query]);

  useEffect(()=>{
    let input:HTMLInputElement|null=null;
    const onInput=(event:Event)=>setQuery((event.target as HTMLInputElement).value);
    const sync=()=>{
      const matchPage=document.querySelector<HTMLElement>(".match-list-page");
      if(matchPage){
        const nextGroup=readGroup(matchPage);
        setGroup(current=>current===nextGroup?current:nextGroup);
        const active=matchPage.querySelector<HTMLElement>(".match-days button.active b")?.textContent?.trim()||"";
        if(active){const [m,d]=active.split("-");const nextDay=`2026-${Number(m)}-${Number(d)}`;setDay(current=>current===nextDay?current:nextDay);}
        const nextInput=matchPage.querySelector<HTMLInputElement>(".match-filter input");
        if(nextInput!==input){if(input)input.removeEventListener("input",onInput);input=nextInput;if(input){input.addEventListener("input",onInput);setQuery(input.value);}}
        const needsStatic=!!active&&(["07-31","08-01","08-02","08-03","08-04"].includes(active));
        let host=matchPage.querySelector<HTMLElement>("[data-langfang-static-matches]");
        if(needsStatic){
          const originalList=matchPage.querySelector<HTMLElement>(".versus-list:not(.static-versus-list)");
          const empty=matchPage.querySelector<HTMLElement>(".match-empty");
          if(originalList)originalList.style.display="none";
          if(empty)empty.style.display="none";
          if(!host){host=document.createElement("div");host.dataset.langfangStaticMatches="true";host.style.display="contents";const count=matchPage.querySelector(".match-count");count?.insertAdjacentElement("afterend",host);}
          setMount(current=>current===host?current:host);
          const countText=matchPage.querySelector<HTMLElement>(".match-count span");
          if(countText)setText(countText,`${nextGroup} · ${visible.length}场对阵`);
        }else{
          const originalList=matchPage.querySelector<HTMLElement>(".versus-list:not(.static-versus-list)");
          const empty=matchPage.querySelector<HTMLElement>(".match-empty");
          if(originalList)originalList.style.display="";
          if(empty)empty.style.display="";
          host?.remove();
          setMount(current=>current===null?current:null);
        }
      }else{
        if(input){input.removeEventListener("input",onInput);input=null;}
        setMount(current=>current===null?current:null);
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
    const timer=window.setInterval(sync,200);
    return ()=>{window.clearInterval(timer);if(input)input.removeEventListener("input",onInput);};
  },[visible.length]);

  if(!mount)return null;
  return createPortal(visible.length?<StaticMatchCards matches={visible}/>:<section className="match-empty"><i>○</i><h2>当日对阵待公布</h2><p>{group}该日期的球员、比分和球台信息将在组委会确认后更新。</p></section>,mount);
}
