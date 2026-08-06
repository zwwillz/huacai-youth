"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Group = "少年组" | "青年组";
type RankingRow = { place:number; tier:string; name:string; amount:string };

const prizeByGroup: Record<Group, Record<string, string>> = {
  少年组: { 冠军:"¥50,000", 亚军:"¥30,000", 季军:"¥15,000", 殿军:"¥10,000", "8强":"¥3,500", "16强":"¥2,000", "32强":"¥1,000", "64强":"¥600" },
  青年组: { 冠军:"¥60,000", 亚军:"¥30,000", 季军:"¥15,000", 殿军:"¥10,000", "8强":"¥3,500", "16强":"¥2,000", "32强":"¥1,000", "64强":"¥600" },
};

const names: Record<Group, string[]> = {
  少年组: [
    "韩雨酌","赵杰迪","胡珈鸣","陈楚乔",
    "赵俊豪","赵慕晨","任梓源","王佳硕",
    "邬珺一","高源岙","李明澳","沈睿熙","白展朋","田乾岳","徐睿泽","张莘莫",
    "张文博","李俊赫","周梓浩","张浩宇","刘乙墨","赵世豪","李竣","闫平安","王梓豪元","谭雨豪","窦笑凡","李岩城","戴凯超","樊喜强","赵子泰","杨欣福",
  ],
  青年组: [
    "闫冠杰","刘嘉鹏","冯世杰","祁宇帆",
    "钟柯皓","赖浩宇","孙嘉鑫","杨紫程",
    "杜涵宇","季圣杰","周坤","黎骏熙","鲁佳豪","梁善禹","贾皓天","蔡惠洋",
    "邴广恺","张深均","付一迦","曹嘉诚","罗凡轶","王鹤翔","许本懿","耿玉豪","杨侑泽","颜俊耀","罗冠芝","郭耀文","周涵祺","秦聖皓","李滨","王梓屹",
  ],
};

const tierForPlace = (place:number) => place===1?"冠军":place===2?"亚军":place===3?"季军":place===4?"殿军":place<=8?"8强":place<=16?"16强":place<=32?"32强":"64强";

const rowsFor = (group:Group): RankingRow[] => names[group].map((name,index)=>{
  const place=index+1;
  const tier=tierForPlace(place);
  return { place, tier, name, amount:prizeByGroup[group][tier] };
});

const medalBackground = (place:number) => {
  if(place===1)return "linear-gradient(145deg,#f5d36c,#c99316)";
  if(place===2)return "linear-gradient(145deg,#d9dde5,#8e96a4)";
  if(place===3)return "linear-gradient(145deg,#d99a68,#9a5a36)";
  if(place===4)return "linear-gradient(145deg,#7b52e8,#5122c0)";
  return undefined;
};

export default function LangfangRankingStatic(){
  const [target,setTarget]=useState<HTMLElement|null>(null);
  const [group,setGroup]=useState<Group>("少年组");

  useEffect(()=>{
    let originalCard:HTMLElement|null=null;
    let frame=0;

    const sync=()=>{
      const head=document.querySelector<HTMLElement>(".ranking-head");
      const card=document.querySelector<HTMLElement>(".card.ranking:not(.static-ranking)");

      if(!head||!card){
        if(originalCard)originalCard.style.display="";
        originalCard=null;
        setTarget(current=>current===null?current:null);
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
  },[]);

  if(!target)return null;
  const rows=rowsFor(group);

  return createPortal(
    <section className="card ranking static-ranking">
      <header>
        <div><small>{group}</small><h2>32强最终排名</h2></div>
        <b>已录入 {rows.length} 人</b>
      </header>
      <div className="prizes" style={{marginTop:0}}>
        {rows.map(row=>{
          const medal=medalBackground(row.place);
          return <div key={`${group}-${row.place}-${row.name}`} style={{gridTemplateColumns:"36px 62px minmax(0,1fr) auto",gap:"10px"}}>
            <span style={medal?{background:medal,color:"#fff",fontWeight:900}:{fontWeight:800}}>{row.place}</span>
            <strong style={{color:row.place<=4?"#3f207f":"#716b7e"}}>{row.tier}</strong>
            <strong style={{fontSize:"12px",color:"#171528"}}>{row.name}</strong>
            <b>{row.amount}</b>
          </div>;
        })}
      </div>
      <p style={{margin:"14px 0 0",color:"#8f8799",fontSize:"9px"}}>当前先录入32强最终名次；64强名单可在后续数据确认后继续补充。</p>
    </section>,
    target,
  );
}
