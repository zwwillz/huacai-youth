"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { PublicRanking } from "@/db/rankings";

type Group = "少年组" | "青年组";

const medalBackground = (place:number) => {
  if(place===1)return "linear-gradient(145deg,#f5d36c,#c99316)";
  if(place===2)return "linear-gradient(145deg,#d9dde5,#8e96a4)";
  if(place===3)return "linear-gradient(145deg,#d99a68,#9a5a36)";
  if(place===4)return "linear-gradient(145deg,#7b52e8,#5122c0)";
  return undefined;
};

function isLangfangContext(){
  const title=document.querySelector<HTMLElement>(".top h3")?.textContent?.trim()??"";
  return title.includes("廊坊");
}

export default function LangfangRankingStatic({rankings}:{rankings:PublicRanking[]}){
  const [target,setTarget]=useState<HTMLElement|null>(null);
  const [group,setGroup]=useState<Group>("少年组");

  useEffect(()=>{
    if(!rankings.length)return;

    let originalCard:HTMLElement|null=null;
    let frame=0;

    const reset=()=>{
      if(originalCard)originalCard.style.display="";
      originalCard=null;
      setTarget(current=>current===null?current:null);
    };

    const sync=()=>{
      // 这个组件只负责廊坊站静态排名。其它分站必须完全由各自数据库数据驱动，
      // 不能再用廊坊排名去覆盖动态页面。
      if(!isLangfangContext()){
        reset();
        return;
      }

      const head=document.querySelector<HTMLElement>(".ranking-head");
      const card=document.querySelector<HTMLElement>(".card.ranking:not(.static-ranking)");

      if(!head||!card){
        reset();
        return;
      }

      if(originalCard!==card){
        if(originalCard)originalCard.style.display="";
        originalCard=card;
      }
      card.style.display="none";

      const currentGroup=card.querySelector("header small")?.textContent?.trim();
      if(currentGroup==="少年组"||currentGroup==="青年组")setGroup(current=>current===currentGroup?current:currentGroup);

      const parent=card.parentElement;
      if(parent)setTarget(current=>current===parent?current:parent);
    };

    frame=requestAnimationFrame(sync);
    const observer=new MutationObserver(sync);
    observer.observe(document.body,{subtree:true,childList:true,characterData:true});

    return ()=>{
      cancelAnimationFrame(frame);
      observer.disconnect();
      if(originalCard)originalCard.style.display="";
    };
  },[rankings.length]);

  if(!rankings.length||!target)return null;
  const rows=rankings.filter(row=>row.group===group).sort((a,b)=>a.displayOrder-b.displayOrder);
  if(!rows.length)return null;
  const title=rows.length>32?"64强最终排名":"32强最终排名";
  const tierNote=rows.find(row=>row.displayOrder>32)?.note;

  return createPortal(
    <section className="card ranking static-ranking">
      <header>
        <div><small>{group}</small><h2>{title}</h2></div>
        <b>已录入 {rows.length} 人</b>
      </header>
      <div className="prizes" style={{marginTop:0}}>
        {rows.map(row=>{
          const medal=medalBackground(row.displayOrder);
          return <div key={row.id} style={{gridTemplateColumns:"36px 62px minmax(0,1fr) auto",gap:"10px"}}>
            <span style={medal?{background:medal,color:"#fff",fontWeight:900}:{fontWeight:800}}>{row.displayOrder}</span>
            <strong style={{color:row.displayOrder<=4?"#3f207f":"#716b7e"}}>{row.placementLabel}</strong>
            <strong style={{fontSize:"12px",color:"#171528"}}>{row.playerName}</strong>
            <b>{row.prizeDisplay}</b>
          </div>;
        })}
      </div>
      {tierNote?<p style={{margin:"14px 0 0",color:"#8f8799",fontSize:"9px"}}>{tierNote}</p>:null}
    </section>,
    target,
  );
}
