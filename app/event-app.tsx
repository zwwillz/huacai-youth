"use client";
/* eslint-disable @next/next/no-img-element */

import { CSSProperties, PointerEvent, useMemo, useRef, useState } from "react";

type Match = { id:string; group:string; date:string; time:string; round:string; progress:string; race:string; order:number; playerA:string; playerB:string; table:string; isTv:boolean; status:string };
type EventData = { matches: Match[]; players: string[] };
type MainView = "event" | "players" | "me";
type EventTab = "overview" | "rules" | "schedule" | "bracket" | "draw" | "ranking" | "guide";
type Group = "少年组" | "青年组";
type PhaseId = "qualifier-one" | "qualifier-two" | "main-one" | "main-two";
type GuideKind = "transport" | "clothing";
type PrizeMap = Record<Group, string[][]>;

const standardPrizes: PrizeMap = {
  少年组: [["冠军","¥50,000"],["亚军","¥30,000"],["季军","¥15,000"],["殿军","¥10,000"],["8强","¥3,500/人"],["16强","¥2,000/人"],["32强","¥1,000/人"],["64强","¥600/人"]],
  青年组: [["冠军","¥60,000"],["亚军","¥30,000"],["季军","¥15,000"],["殿军","¥10,000"],["8强","¥3,500/人"],["16强","¥2,000/人"],["32强","¥1,000/人"],["64强","¥600/人"]],
};
const miyunPrizes: PrizeMap = { 少年组: [["冠军","¥60,000"],...standardPrizes.少年组.slice(1)], 青年组: [["冠军","¥50,000"],...standardPrizes.青年组.slice(1)] };

const stations = {
  langfang: {
    id:"langfang", stop:"第三站", city:"河北廊坊站", shortCity:"廊坊", status:"决赛日", active:true,
    title:"2026“铧一·星牌·南匠·Case One杯”中国华彩十六球青少年系列赛",
    sponsor:"铧一 · 星牌 · 南匠 · Case One 杯", date:"2026.07.25—08.04", duration:"11天",
    venue:"河北省廊坊市安次区 · 铧一台球学院", venueDetail:"河北省廊坊市安次区高新技术产业园安华路10号",
    rulesPdf:"/regulations/langfang.pdf", refereesPdf:"/referees/langfang.pdf",
    qualDate:"2026年7月25日—30日", mainDate:"2026年7月31日—8月4日", totalPrize:"¥350,400", mainSize:"每组64人",
    intro:"河北廊坊站设置少年组（U16）和青年组（U20），由两场资格赛、正赛分组双败阶段及32强单败阶段组成。上站太原站各组前16名直接进入正赛，其余48个名额由两场资格赛产生。",
    organizers:[["主办单位","中国台球协会"],["支持单位","河北省台球协会、廊坊市体育局、廊坊市安次区教体局、廊坊市安次区文旅局"],["承办单位","河北铧一体育文化集团有限公司、北京市密云区台球运动协会"],["协办单位","太原市台球协会、中铧体育发展（河北）有限公司、廊坊星探传媒有限公司"]],
    age:{少年组:"2010年7月26日（含）以后出生",青年组:"2006年7月26日（含）以后出生"}, minimumAge:"最低6周岁；未满14周岁须由成年人陪同，14至18周岁单独参赛须提供家长责任书。",
    format:[
      ["资格赛","两场单败；每场各晋级24人","9局5胜","13局7胜"],
      ["正赛第一阶段","64人分8组双败；每组4人晋级","13局7胜","17局9胜"],
      ["正赛第二阶段","32强单败淘汰至冠军","17局9胜","21局11胜"],
    ],
    draw:["资格赛不设种子，全部混抽入位。","正赛第一阶段：上站直接晋级的16名选手按蛇形排位进入种子位，其余选手混抽。","正赛第二阶段：胜部晋级16人进入种子位，败部晋级选手混抽。","预赛采用电脑系统抽签；正赛阶段由裁判员统一代抽并全程直播。"],
    signup:"报名截止：7月23日12:00；报到：7月23日至24日10:00—18:00；单站参赛费100元，食宿及交通自理。", prizes:standardPrizes,
  },
  taiyuan: {
    id:"taiyuan", stop:"第二站", city:"山西太原站", shortCity:"太原", status:"已结束", active:false,
    title:"2026“LKD·南匠·NB台球俱乐部杯”中国华彩十六球青少年系列赛",
    sponsor:"LKD · 南匠 · NB台球俱乐部杯", date:"2026.06.11—06.20", duration:"10天",
    venue:"山西太原 · NB台球俱乐部 / 滨河体育中心", venueDetail:"资格赛：小店区NB台球俱乐部许东店；正赛：万柏林区滨河体育中心A馆",
    rulesPdf:"/regulations/taiyuan.pdf", refereesPdf:"/referees/taiyuan.pdf",
    qualDate:"2026年6月11日—15日", mainDate:"2026年6月16日—20日", totalPrize:"¥350,400", mainSize:"每组64人",
    intro:"山西太原站是2026赛季第二站。少年组和青年组各设两场资格赛，每场晋级24人；密云站各组前16名直接进入正赛，最终组成每组64人的正赛阵容。",
    organizers:[["主办单位","中国台球协会"],["支持单位","太原市体育局"],["承办单位","太原市台球协会、北京市密云区台球运动协会"],["协办单位","山西省台球协会、太原市滨河体育中心"]],
    age:{少年组:"2010年6月11日（含）以后出生",青年组:"2006年6月11日（含）以后出生"}, minimumAge:"最低6周岁；未满14周岁须由成年人陪同，14至18周岁单独参赛须提供家长责任书。",
    format:[
      ["资格赛","两场单败；每场各晋级24人","9局5胜","13局7胜"],
      ["正赛第一阶段","64人分8组双败；每组4人晋级","13局7胜","17局9胜"],
      ["正赛第二阶段","32强单败淘汰至冠军","17局9胜","21局11胜"],
    ],
    draw:["资格赛不设种子，全部混抽入位。","正赛第一阶段：密云站各组前16名进入种子位，其余选手混抽。","正赛第二阶段：胜部晋级16人进入种子位，败部晋级选手混抽。","各阶段由裁判员统一代抽，抽签过程全程直播。"],
    signup:"报名截止：6月9日14:00；预赛抽签：6月10日18:00；正赛抽签：6月15日19:30；单站参赛费100元，食宿自理。", prizes:standardPrizes,
  },
  miyun: {
    id:"miyun", stop:"第一站", city:"北京密云站", shortCity:"密云", status:"已结束", active:false,
    title:"2026“南匠由甲”中国华彩十六球青少年系列赛",
    sponsor:"南匠由甲", date:"2026.02.22—03.02", duration:"9天",
    venue:"北京市密云区 · 万象汇星牌台球俱乐部", venueDetail:"北京市密云区万象汇星牌台球俱乐部",
    rulesPdf:"/regulations/miyun.pdf", refereesPdf:"/referees/miyun.pdf",
    qualDate:"2026年2月22日起", mainDate:"2026年3月2日前完成", totalPrize:"¥350,400", mainSize:"正赛共128人",
    intro:"北京密云站是2026赛季首站。少年组与青年组各设置两场预选赛，每场各晋级32人；正赛共128人，第一阶段采用8人组双败淘汰，第二阶段采用单败淘汰直至产生冠亚季军。",
    organizers:[["主办单位","中国台球协会、北京市密云区体育局"],["支持单位","北京市体育竞赛管理和国际交流中心"],["承办单位","北京市密云区台球运动协会"],["协办单位","北京舣伽兰舍体育文化传播有限公司"]],
    age:{少年组:"2010年3月2日（含）以后出生",青年组:"2006年3月2日（含）以后出生"}, minimumAge:"未成年参赛选手须由监护人、领队或教练陪同，并于赛前签署责任承诺书、完成体检及意外保险。",
    format:[
      ["预选赛","两场单败；每场各晋级32人","9局5胜","9局5胜"],
      ["正赛第一阶段","128人分16个8人组双败；每组4人晋级","9局5胜","9局5胜"],
      ["正赛第二阶段","单败；每场两盘，平局点球决胜","每盘9局5胜","每盘9局5胜"],
    ],
    draw:["预选赛不设种子，所有选手混抽入位。","正赛第一阶段不设种子，所有选手混抽入位。","正赛第二阶段：胜部晋级选手随机进入种子位，败部晋级选手混抽。","现场抽签同步线上直播；未到场选手由裁判组代抽。"],
    signup:"报名截止：2月19日14:00；抽签：2月21日18:00；单站参赛费100元，食宿自理。", prizes:miyunPrizes,
  },
} as const;
type Station = (typeof stations)[keyof typeof stations];

const stationList: Station[] = [stations.langfang, stations.taiyuan, stations.miyun];
const phases:{id:PhaseId;number:string;title:string;date:string;status:"待开始"|"进行中"|"已结束"}[] = [
  {id:"qualifier-one",number:"01",title:"资格赛第一场",date:"7月25日—27日",status:"已结束"},
  {id:"qualifier-two",number:"02",title:"资格赛第二场",date:"7月28日—30日",status:"已结束"},
  {id:"main-one",number:"03",title:"正赛第一阶段",date:"7月31日—8月2日",status:"已结束"},
  {id:"main-two",number:"04",title:"正赛第二阶段",date:"8月3日—4日",status:"进行中"},
];

const shortDate = (value:string) => { const [,m,d]=value.split("-"); return `${Number(m)}月${Number(d)}日`; };

function GroupSwitch({group,setGroup}:{group:Group;setGroup:(group:Group)=>void}) {
  return <div className="group-switch" aria-label="选择比赛组别"><button className={group==="少年组"?"active":""} onClick={()=>setGroup("少年组")}><b>U16</b><span>少年组</span></button><button className={group==="青年组"?"active":""} onClick={()=>setGroup("青年组")}><b>U20</b><span>青年组</span></button></div>;
}

function EventCenter({openEvent}:{openEvent:(id:string)=>void}) {
  const [year,setYear]=useState(2026);
  const years=[2025,2026,2027,2028];
  const hasEvents=year===2026;
  return <div className="event-center stack"><section className="center-hero"><div><h1>官方赛事</h1><p>中国华彩十六球青少年系列赛</p></div><span><strong>{hasEvents?stationList.length:0}</strong>{year}赛季分站</span></section><nav className="year-switch" aria-label="选择赛事年份">{years.map(item=><button className={year===item?"active":""} onClick={()=>setYear(item)} key={item}><b>{item}</b><span>赛季</span></button>)}</nav><section className="event-list-head"><div><small>{year}年</small><h2>赛事列表</h2></div><span>按时间倒序</span></section>{hasEvents?<section className="event-list">{stationList.map((station,index)=><button className={`event-row ${station.active?"featured":""}`} onClick={()=>openEvent(station.id)} key={station.id}><div className={`event-cover cover-${station.id}`}><span>{station.stop}</span><strong>{station.city}</strong></div><div className="event-info"><div><span>{station.stop}</span><b className={station.active?"current":"ended"}>{station.status}</b></div><h3>{station.title}</h3><p><i>◆</i>{station.venue}</p><small>{station.date}</small></div><b className="event-arrow">{index===0?"进入赛事":"查看详情"}<i>›</i></b></button>)}</section>:<section className="year-empty"><span>赛</span><h2>{year}年赛事待公布</h2><p>该年度的分站信息将在组委会确认后更新。</p></section>}</div>;
}

function StationHero({station,openSchedule,openRules}:{station:Station;openSchedule?:()=>void;openRules:()=>void}) {
  return <section className={`hero station-hero station-${station.id}`}><div className="hero-copy"><span className="live"><i /> {station.stop} · {station.status}</span><p>2026 中国华彩十六球青少年系列赛</p><h1>{station.city}</h1><h2>{station.sponsor}</h2><div className="hero-meta"><span>{station.date}</span><span>{station.venue}</span></div><div className="hero-buttons">{openSchedule&&<button onClick={openSchedule}>查看赛程</button>}<button className={openSchedule?"ghost":""} onClick={openRules}>竞赛规程</button></div></div><div className="hero-poster"><strong>{station.stop}</strong><span>{station.shortCity}</span></div></section>;
}

function StationOverview({station,data,openRules,openSchedule,openGuide}:{station:Station;data:EventData;openRules:()=>void;openSchedule?:()=>void;openGuide:(kind:GuideKind)=>void}) {
  const isLangfang=station.id==="langfang";
  return <div className="stack"><StationHero station={station} openRules={openRules} openSchedule={openSchedule}/><section className="metrics"><article><strong>{station.totalPrize}</strong><span>本站总奖金</span></article>{isLangfang?<><article><strong>{data.players.length}</strong><span>少年组已公布出场选手</span></article><article><strong>{data.matches.length}</strong><span>少年组已公布首轮对阵</span></article></>:<><article><strong>2</strong><span>少年组与青年组</span></article><article><strong>{station.mainSize}</strong><span>正赛规模</span></article></>}<article><strong>{station.duration}</strong><span>本站比赛周期</span></article></section><section className="card introduction"><div><small>赛事简介</small><h2>{station.stop} · {station.city}</h2></div><div><p>{station.intro}</p><div className="inline-actions"><button onClick={openRules}>查看完整竞赛规程</button>{openSchedule&&<button onClick={openSchedule}>查看分阶段赛程</button>}</div></div></section><section className="rules"><article className="card"><small>少年组 U16</small><h2>{station.age.少年组}</h2><p>{station.format[0][2]}；本站少年组冠军奖金{station.prizes.少年组[0][1]}。</p><dl><div><dt>组别</dt><dd>少年组</dd></div><div><dt>正赛规模</dt><dd>64人</dd></div></dl></article><article className="card"><small>青年组 U20</small><h2>{station.age.青年组}</h2><p>{station.format[0][3]}；本站青年组冠军奖金{station.prizes.青年组[0][1]}。</p><dl><div><dt>组别</dt><dd>青年组</dd></div><div><dt>正赛规模</dt><dd>64人</dd></div></dl></article></section><section className="card organizers"><div><small>官方信息</small><h2>赛事组织</h2></div><dl>{station.organizers.map(([name,value])=><div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}<div><dt>比赛地点</dt><dd>{station.venueDetail}</dd></div></dl></section><section className="card participant-tips"><header><div><small>参赛提示</small><h2>参赛友好提示</h2></div><b>信息将持续更新</b></header><div className="tip-links"><button onClick={()=>openGuide("transport")}><span>行</span><div><strong>交通住宿攻略</strong><small>路线、场馆周边及住宿信息</small></div><b>查看 ›</b></button><button onClick={()=>openGuide("clothing")}><span>装</span><div><strong>服装要求</strong><small>查看参赛着装相关提示</small></div><b>查看 ›</b></button></div></section>{isLangfang&&<section className="card sponsor-section"><header><div><small>赛事支持</small><h2>合作伙伴</h2></div></header><img src="/langfang-sponsors.jpg" alt="河北廊坊站合作伙伴标识" width="1242" height="367"/></section>}</div>;
}

function CompetitionRules({station}:{station:Station}) {
  return <div className="regulation stack"><section className="regulation-head"><h1>{station.city}竞赛规程</h1><p>{station.title}</p><span>以下为竞赛规程重点摘要，具体执行以官方原文及组委会最新通知为准</span><div className="pdf-actions"><a className="pdf-button" href={station.rulesPdf} target="_blank" rel="noreferrer">查看完整竞赛规程 <b>原文 ↗</b></a><a className="pdf-button referee-button" href={station.refereesPdf} target="_blank" rel="noreferrer">查看裁判员名单 <b>原文 ↗</b></a></div></section><section className="rule-nav">{["基本信息","参赛资格","竞赛办法","种子与抽签","报名与费用","奖金设置"].map((item,index)=><a href={`#rule-${station.id}-${index+1}`} key={item}><b>{String(index+1).padStart(2,"0")}</b>{item}</a>)}</section><section id={`rule-${station.id}-1`} className="rule-section card"><header><span>01</span><div><small>赛事基本信息</small><h2>时间、地点与组织机构</h2></div></header><dl className="facts"><div><dt>比赛时间</dt><dd>资格赛：{station.qualDate}<br/>正赛：{station.mainDate}</dd></div><div><dt>比赛地点</dt><dd>{station.venueDetail}</dd></div>{station.organizers.map(([name,value])=><div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl></section><section id={`rule-${station.id}-2`} className="rule-section card"><header><span>02</span><div><small>参赛资格</small><h2>少年组与青年组</h2></div></header><div className="eligibility"><article><b>U16</b><h3>少年组</h3><p>{station.age.少年组}</p></article><article><b>U20</b><h3>青年组</h3><p>{station.age.青年组}</p></article></div><p className="rule-note">{station.minimumAge}</p></section><section id={`rule-${station.id}-3`} className="rule-section card"><header><span>03</span><div><small>竞赛办法</small><h2>资格赛、正赛与局数</h2></div></header><div className="format-table"><div><b>阶段</b><b>赛制</b><b>少年组</b><b>青年组</b></div>{station.format.map(row=><div key={row[0]}><span>{row[0]}</span><span>{row[1]}</span><span>{row[2]}</span><span>{row[3]}</span></div>)}</div></section><section id={`rule-${station.id}-4`} className="rule-section card"><header><span>04</span><div><small>种子与抽签</small><h2>抽签与入位规则</h2></div></header><ol>{station.draw.map((item,index)=><li key={index}>{item}</li>)}</ol></section><section id={`rule-${station.id}-5`} className="rule-section card"><header><span>05</span><div><small>报名与费用</small><h2>报名须知</h2></div></header><div className="fee"><strong>¥100</strong><span>单站参赛费</span></div><p className="rule-note">{station.signup}</p></section><section id={`rule-${station.id}-6`} className="rule-section card"><header><span>06</span><div><small>奖金设置</small><h2>本站总奖金 {station.totalPrize}</h2></div></header><div className="dual-prize">{(["少年组","青年组"] as Group[]).map(group=><article key={group}><h3>{group}</h3>{station.prizes[group].map(([rank,amount])=><div key={rank}><span>{rank}</span><b>{amount}</b></div>)}</article>)}</div><p className="rule-note">以上均为税前奖金；奖金领取、积分和颁奖要求以正式规程为准。</p></section></div>;
}

function Schedule({group,setGroup,openBracket}:{group:Group;setGroup:(group:Group)=>void;openBracket:(phase:PhaseId)=>void}) {
  const detail=(phase:PhaseId)=>{
    const youth=group==="少年组";
    if(phase==="qualifier-one")return {progress:youth?"498进16 · 晋级24人":"附加赛 / 512进16 · 晋级24人",rounds:"5个晋级轮次",race:youth?"9局5胜":"13局7胜",note:youth?"242场首轮对阵，另有14个轮空签位":"含附加赛，完整签表待录入"};
    if(phase==="qualifier-two")return {progress:youth?"474进16 · 晋级24人":"附加赛 / 512进16 · 晋级24人",rounds:"5个晋级轮次",race:youth?"9局5胜":"13局7胜",note:youth?"218场首轮对阵，另有38个轮空签位":"含附加赛，完整签表待录入"};
    if(phase==="main-one")return {progress:"64进32 · 8组双败",rounds:"每组8人，晋级4人",race:youth?"13局7胜":"17局9胜",note:"胜部2人、败部2人，共32人晋级"};
    return {progress:"32进1 · 单败淘汰",rounds:"32强至冠军",race:youth?"17局9胜":"21局11胜",note:"半决赛、季军赛和决赛于8月4日完成"};
  };
  return <div className="schedule-page stack"><section className="schedule-head with-group compact-head"><div><small className="event-name-kicker">2026中国华彩十六球青少年系列赛廊坊站</small><h1>赛程</h1><p>按比赛阶段查看完整赛程表</p></div><GroupSwitch group={group} setGroup={setGroup}/></section><section className="phase-schedule compact-phases">{phases.map(phase=>{const item=detail(phase.id);return <article className="phase-card compact-phase" key={phase.id}><div className="phase-status-line"><b className={`phase-status status-${phase.status}`}>{phase.status}</b><time>{phase.date}</time></div><h2>{phase.title}</h2><h3>{item.progress}</h3><div className="phase-meta"><span>{item.rounds}</span><span>{item.race}</span></div>{phase.id.startsWith("qualifier")&&<div className="qualify-rule"><strong>晋级24人</strong><span>32进16胜者16人直接晋级</span><i>＋</i><span>该轮负者按全部实际参赛局胜率取前8名</span></div>}<footer><small>{item.note}</small><button onClick={()=>openBracket(phase.id)}>查看赛程表 <i>›</i></button></footer></article>})}</section></div>;
}

function usePanZoom(){ const [zoom,setZoom]=useState(1),[offset,setOffset]=useState({x:0,y:0}); const drag=useRef<{x:number;y:number;ox:number;oy:number}|null>(null); const down=(e:PointerEvent<HTMLDivElement>)=>{drag.current={x:e.clientX,y:e.clientY,ox:offset.x,oy:offset.y};e.currentTarget.setPointerCapture(e.pointerId)}; const move=(e:PointerEvent<HTMLDivElement>)=>{if(drag.current)setOffset({x:drag.current.ox+e.clientX-drag.current.x,y:drag.current.oy+e.clientY-drag.current.y})}; const up=()=>{drag.current=null}; const reset=()=>{setZoom(1);setOffset({x:0,y:0})}; return {zoom,setZoom,offset,down,move,up,reset}; }

function PlayerLine({slot,name,highlight=false}:{slot?:string;name:string;highlight?:boolean}){return <div className={`competitor ${highlight?"search-hit":""}`}>{slot&&<em>{slot}</em>}<span>{name}</span><b>—</b></div>}

function TreeMatch({round,index,match,showSlots,query,prefix,emptyName="待定"}:{round:number;index:number;match?:Match;showSlots:boolean;query:string;prefix:string;emptyName?:string}){
  const game=`${prefix}${round+1}-${index+1}`,value=query.trim().toLowerCase();
  const hit=!!value&&[match?.playerA||"",match?.playerB||"",match?.table||"",game].some(item=>item.toLowerCase().includes(value));
  const fallback=round===0?emptyName:"晋级者待定";
  return <article className={`tree-match ${hit?"match-hit":""}`}><PlayerLine slot={showSlots?`${index+1}-1`:undefined} name={match?.playerA||fallback} highlight={hit}/><div className="between"><time>{match?`${shortDate(match.date)} ${match.time}`:"时间待定"}</time><span className={match?.isTv?"tv":""}>{match?.table||"球台待定"}</span></div><PlayerLine slot={showSlots?`${index+1}-2`:undefined} name={match?.playerB||fallback} highlight={hit}/><b className="tree-game-no">{game}</b></article>;
}

function KnockoutTree({firstRoundCount,labels,matches,query="",showSlots=false,prefix="G",emptyName="待定"}:{firstRoundCount:number;labels:string[];matches?:Match[];query?:string;showSlots?:boolean;prefix?:string;emptyName?:string}){
  const nodeWidth=190,columnGap=64,matchHeight=78,rowGap=100,topPad=44;
  const counts=labels.map((_,round)=>Math.ceil(firstRoundCount/2**round));
  const center=(round:number,index:number)=>topPad+((2**round-1)/2)*rowGap+index*2**round*rowGap;
  const width=labels.length*nodeWidth+(labels.length-1)*columnGap;
  const height=topPad*2+(firstRoundCount-1)*rowGap+matchHeight;
  return <div className="knockout-tree" style={{width}}><header className="knockout-head" style={{gridTemplateColumns:`repeat(${labels.length}, ${nodeWidth}px)`,columnGap}}>{labels.map(label=><span key={label}>{label}</span>)}</header><section className="knockout-stage" style={{width,height}}>{counts.map((count,round)=>Array.from({length:count},(_,index)=>{const left=round*(nodeWidth+columnGap),top=center(round,index)-matchHeight/2;return <div className="tree-match-wrap" style={{left,top,width:nodeWidth,height:matchHeight}} key={`${round}-${index}`}><TreeMatch round={round} index={index} match={round===0?matches?.[index]:undefined} showSlots={showSlots&&round===0} query={query} prefix={prefix} emptyName={emptyName}/></div>}))}{counts.slice(0,-1).map((count,round)=>Array.from({length:Math.floor(count/2)},(_,index)=>{const y1=center(round,index*2),y2=center(round,index*2+1),mid=(y1+y2)/2,left=round*(nodeWidth+columnGap)+nodeWidth,half=columnGap/2;return <span className="tree-paths" key={`path-${round}-${index}`}><i className="path horizontal" style={{left,top:y1,width:half}}/><i className="path horizontal" style={{left,top:y2,width:half}}/><i className="path vertical" style={{left:left+half,top:y1,height:y2-y1}}/><i className="path horizontal" style={{left:left+half,top:mid,width:half}}/></span>}))}</section></div>;
}

function DoubleElimBoard({groupNo,query}:{groupNo:number;query:string}){return <div className="double-board corrected"><h2>第{groupNo}组 · 双败8进4</h2><section className="double-lane corrected-lane"><header><div><b>胜部</b><span>胜部产生2个晋级名额</span></div><aside><strong>2人</strong>晋级32强</aside></header><KnockoutTree firstRoundCount={4} labels={["胜部第一轮","胜部晋级轮"]} query={query} showSlots prefix="W"/></section><div className="double-route-note">胜部未晋级选手进入败部路线</div><section className="double-lane corrected-lane loser"><header><div><b>败部</b><span>败部产生2个晋级名额</span></div><aside><strong>2人</strong>晋级32强</aside></header><KnockoutTree firstRoundCount={4} labels={["败部第一轮","败部晋级轮"]} query={query} prefix="L"/></section></div>}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- retained only while the new unified draw is being validated against the prior implementation
function Bracket({data,group,setGroup,phase,setPhase,onBack}:{data:EventData;group:Group;setGroup:(group:Group)=>void;phase:PhaseId;setPhase:(phase:PhaseId)=>void;onBack:()=>void}){
  const [section,setSection]=useState(0),[query,setQuery]=useState(""),[fullscreen,setFullscreen]=useState(false); const pan=usePanZoom();
  const isQualifier=phase.startsWith("qualifier"),sectionCount=isQualifier?16:phase==="main-one"?8:1,selected=Math.min(section,sectionCount-1);
  const setCurrentPhase=(value:PhaseId)=>{setPhase(value);setSection(0);setQuery("");pan.reset()};
  const hasActual=group==="少年组"&&phase==="qualifier-one";
  const firstLabel=group==="青年组"?"附加赛 / 512进256":phase==="qualifier-one"?"498进256":"474进256";
  const qualificationLabels=[firstLabel,"256进128","128进64","64进32","32进16"];
  const regionMatches=hasActual?data.matches.slice(selected*16,selected*16+16):undefined;
  const changeQuery=(value:string)=>{setQuery(value);if(hasActual&&value.trim()){const q=value.trim().toLowerCase(),index=data.matches.findIndex((match,i)=>[match.playerA,match.playerB,match.table,`G${i+1}`].some(item=>item.toLowerCase().includes(q)));if(index>=0)setSection(Math.floor(index/16))}pan.reset()};
  const board=isQualifier?<KnockoutTree firstRoundCount={16} labels={qualificationLabels} matches={regionMatches} query={query} showSlots prefix={`Q${selected+1}-`} emptyName={hasActual?"轮空 / 待补":"待定"}/>:phase==="main-one"?<DoubleElimBoard groupNo={selected+1} query={query}/>:<KnockoutTree firstRoundCount={16} labels={["32进16","16进8","8进4","半决赛","决赛"]} query={query} prefix="M"/>;
  const title=isQualifier?`${phases.find(item=>item.id===phase)?.title} · 第${selected+1}区`:phase==="main-one"?`正赛第一阶段 · 第${selected+1}组`:"正赛第二阶段 · 32强至决赛";
  return <div className="bracket-page stack"><button className="draw-back" onClick={onBack}>‹ 返回赛程阶段</button><section className="bracket-title with-group compact-head"><div><small className="event-name-kicker">2026中国华彩十六球青少年系列赛廊坊站</small><h1>详细赛程表</h1><p>签表已按真实晋级关系重新连接</p></div><GroupSwitch group={group} setGroup={(value)=>{setGroup(value);setSection(0);setQuery("");pan.reset()}}/></section><nav className="phase-menu compact-menu">{phases.map(item=><button className={phase===item.id?"active":""} onClick={()=>setCurrentPhase(item.id)} key={item.id}><b>{item.number}</b><span>{item.title}</span></button>)}</nav>{sectionCount>1&&<nav className="substage-menu region-menu">{Array.from({length:sectionCount},(_,index)=><button className={selected===index?"active":""} onClick={()=>{setSection(index);setQuery("");pan.reset()}} key={index}>{isQualifier?`第${index+1}区`:`第${index+1}组`}</button>)}</nav>}<section className={`draw-shell ${fullscreen?"draw-fullscreen":""}`}><div className="draw-toolbar"><div><small>{group}</small><h2>{title}</h2><p>{isQualifier?`${qualificationLabels.join(" → ")}；每区产生1名直接晋级选手`:phase==="main-one"?"8人双败，每组晋级4人":"32强单败至冠军"}</p></div><label><span>⌕</span><input value={query} onChange={e=>changeQuery(e.target.value)} placeholder="搜索选手、球台或场次"/></label><div className="board-controls"><button onClick={()=>pan.setZoom(v=>Math.max(.45,v-.1))} aria-label="缩小">−</button><b>{Math.round(pan.zoom*100)}%</b><button onClick={()=>pan.setZoom(v=>Math.min(1.5,v+.1))} aria-label="放大">＋</button><button onClick={pan.reset}>复位</button><button className="fullscreen-btn" onClick={()=>{setFullscreen(v=>!v);pan.reset()}}>{fullscreen?"关闭全屏":"全屏查看"}</button></div></div>{isQualifier&&<div className="draw-data-note"><strong>晋级说明：</strong>16个区冠军直接晋级；32进16的负者按本站全部实际参赛局胜率排序，前8名追加晋级，共24人。</div>}<section className="bracket-viewport upgraded" onPointerDown={pan.down} onPointerMove={pan.move} onPointerUp={pan.up} onPointerCancel={pan.up}><div className="bracket-canvas upgraded-canvas corrected-canvas" style={{transform:`translate(${pan.offset.x}px,${pan.offset.y}px) scale(${pan.zoom})`}}>{board}</div></section><p className="drag-tip">可拖动查看完整签表，也可缩放、搜索或全屏显示。</p></section></div>;
}

/*
 * Unified phase draw.  Each phase is deliberately one continuous board: regions
 * and groups are headings inside that board, never navigation buttons.
 */
const STAGE_MATCH_HEIGHT=68;
const STAGE_ROW_GAP=86;
const STAGE_TOP_PAD=42;
const QUALIFIER_ZONE_STRIDE=1570;

function useBracketPanZoom(){
  const [zoom,setZoom]=useState(1);
  const [offset,setOffset]=useState({x:0,y:0});
  const drag=useRef<{x:number;y:number;ox:number;oy:number}|null>(null);
  const down=(e:PointerEvent<HTMLDivElement>)=>{
    drag.current={x:e.clientX,y:e.clientY,ox:offset.x,oy:offset.y};
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move=(e:PointerEvent<HTMLDivElement>)=>{
    if(drag.current)setOffset({x:drag.current.ox+e.clientX-drag.current.x,y:drag.current.oy+e.clientY-drag.current.y});
  };
  const up=()=>{drag.current=null};
  const reset=()=>{setZoom(1);setOffset({x:0,y:0})};
  const focus=(x:number,y:number)=>{
    const nextZoom=1.08;
    setZoom(nextZoom);
    setOffset({x:Math.max(18,140-x*nextZoom),y:Math.min(24,290-y*nextZoom)});
  };
  return {zoom,setZoom,offset,down,move,up,reset,focus};
}

function CompactPlayerLine({slot,name,highlight=false}:{slot?:string;name:string;highlight?:boolean}){
  return <div className={`stage-competitor ${slot?"has-slot":"no-slot"} ${highlight?"search-hit":""}`}>
    {slot&&<em>{slot}</em>}<span title={name}>{name}</span><b>—</b>
  </div>;
}

function CompactTreeMatch({round,index,match,showSlots,query,prefix,emptyName="待定",width}:{round:number;index:number;match?:Match;showSlots:boolean;query:string;prefix:string;emptyName?:string;width:number}){
  const game=`${prefix}${round+1}-${index+1}`;
  const value=query.trim().toLowerCase();
  const hit=!!value&&[match?.playerA||"",match?.playerB||"",match?.table||"",game].some(item=>item.toLowerCase().includes(value));
  const fallback=round===0?emptyName:"晋级者待定";
  return <article className={`stage-tree-match ${hit?"match-hit":""}`} style={{width}} data-game={game}>
    <CompactPlayerLine slot={showSlots?`${index+1}-1`:undefined} name={match?.playerA||fallback} highlight={hit}/>
    <div className="stage-between"><time>{match?`${shortDate(match.date)} ${match.time}`:"时间待定"}</time><span className={match?.isTv?"tv":""}>{match?.table||"球台待定"}</span></div>
    <CompactPlayerLine slot={showSlots?`${index+1}-2`:undefined} name={match?.playerB||fallback} highlight={hit}/>
    <b className="stage-game-no">{game}</b>
  </article>;
}

function TerminalPlayer({label,name="晋级者待定",accent="green"}:{label:string;name?:string;accent?:"green"|"pink"}){
  return <article className={`terminal-player terminal-${accent}`}><small>{label}</small><strong>{name}</strong></article>;
}

function StageKnockoutTree({firstRoundCount,labels,matches,query="",showSlots=false,prefix="G",emptyName="待定",terminalLabel="晋级"}:{firstRoundCount:number;labels:string[];matches?:Match[];query?:string;showSlots?:boolean;prefix?:string;emptyName?:string;terminalLabel?:string}){
  const columnGap=48;
  const widths=labels.map((_,round)=>round===0?(showSlots?154:128):116);
  const lefts=widths.map((_,round)=>widths.slice(0,round).reduce((sum,width)=>sum+width,0)+round*columnGap);
  const counts=labels.map((_,round)=>Math.ceil(firstRoundCount/2**round));
  const center=(round:number,index:number)=>STAGE_TOP_PAD+((2**round-1)/2)*STAGE_ROW_GAP+index*2**round*STAGE_ROW_GAP;
  const terminalWidth=108;
  const terminalLeft=lefts.at(-1)!+widths.at(-1)!+columnGap;
  const totalWidth=terminalLeft+terminalWidth;
  const height=STAGE_TOP_PAD*2+(firstRoundCount-1)*STAGE_ROW_GAP+STAGE_MATCH_HEIGHT;
  const finalCenter=center(labels.length-1,0);
  return <div className="stage-knockout-tree" style={{width:totalWidth}}>
    <header className="stage-knockout-head" style={{width:totalWidth}}>
      {labels.map((label,round)=><span key={`${label}-${round}`} style={{left:lefts[round],width:widths[round]}}>{label}</span>)}
      <span className="terminal-heading" style={{left:terminalLeft,width:terminalWidth}}>{terminalLabel}</span>
    </header>
    <section className="stage-knockout-stage" style={{width:totalWidth,height}}>
      {counts.map((count,round)=>Array.from({length:count},(_,index)=>{
        const top=center(round,index)-STAGE_MATCH_HEIGHT/2;
        return <div className="stage-tree-match-wrap" style={{left:lefts[round],top,width:widths[round],height:STAGE_MATCH_HEIGHT}} key={`${round}-${index}`}>
          <CompactTreeMatch round={round} index={index} match={round===0?matches?.[index]:undefined} showSlots={showSlots&&round===0} query={query} prefix={prefix} emptyName={emptyName} width={widths[round]}/>
        </div>;
      }))}
      {counts.slice(0,-1).map((count,round)=>Array.from({length:Math.floor(count/2)},(_,index)=>{
        const y1=center(round,index*2),y2=center(round,index*2+1),mid=(y1+y2)/2;
        const left=lefts[round]+widths[round],nextLeft=lefts[round+1],half=(nextLeft-left)/2;
        return <span className="stage-tree-paths" key={`path-${round}-${index}`}>
          <i className="stage-path horizontal" style={{left,top:y1,width:half}}/><i className="stage-path horizontal" style={{left,top:y2,width:half}}/>
          <i className="stage-path vertical" style={{left:left+half,top:y1,height:y2-y1}}/><i className="stage-path horizontal" style={{left:left+half,top:mid,width:half}}/>
        </span>;
      }))}
      <span className="stage-tree-paths"><i className="stage-path horizontal terminal-path" style={{left:lefts.at(-1)!+widths.at(-1)!,top:finalCenter,width:columnGap}}/></span>
      <div className="terminal-player-wrap" style={{left:terminalLeft,top:finalCenter-24,width:terminalWidth}}><TerminalPlayer label={terminalLabel} accent={terminalLabel==="冠军"?"pink":"green"}/></div>
    </section>
  </div>;
}

function QualificationPhaseBoard({data,group,phase,query}:{data:EventData;group:Group;phase:PhaseId;query:string}){
  const hasActual=group==="少年组"&&phase==="qualifier-one";
  const firstLabel=group==="青年组"?"附加赛 / 512进256":phase==="qualifier-one"?"498进256":"474进256";
  const labels=[firstLabel,"256进128","128进64","64进32","32进16"];
  return <div className="qualification-phase-board">
    {Array.from({length:16},(_,region)=>{
      const matches=hasActual?data.matches.slice(region*16,region*16+16):undefined;
      return <section className="qualifier-zone" key={region} data-region={region+1}>
        <h3><b>第{region+1}区</b><span>单败 · 产生1名直接晋级选手</span></h3>
        <StageKnockoutTree firstRoundCount={16} labels={labels} matches={matches} query={query} showSlots prefix={`Q${region+1}-`} emptyName={hasActual?"轮空 / 待补":"待定"}/>
      </section>;
    })}
  </div>;
}

function RoutePath({className="",style}:{className?:string;style:CSSProperties}){
  return <i className={`stage-path ${className}`} style={style}/>;
}

function DoubleElimGroup({groupNo,query}:{groupNo:number;query:string}){
  const centerLeft=500,centerWidth=154,loserOneLeft=324,loserTwoLeft=152,loserTerminalLeft=0,winnerLeft=704,winnerTerminalLeft=868;
  const routeWidth=116,terminalWidth=104;
  const centerY=[125,295,465,635],routeY=[210,550];
  const pairLines=(direction:"left"|"right",pair:number)=>{
    const y1=centerY[pair*2],y2=centerY[pair*2+1],mid=(y1+y2)/2;
    if(direction==="right"){
      const start=centerLeft+centerWidth,end=winnerLeft,turn=(start+end)/2;
      return <span className="double-path-set" key={`wr-${pair}`}><RoutePath className="horizontal" style={{left:start,top:y1,width:turn-start}}/><RoutePath className="horizontal" style={{left:start,top:y2,width:turn-start}}/><RoutePath className="vertical" style={{left:turn,top:y1,height:y2-y1}}/><RoutePath className="horizontal" style={{left:turn,top:mid,width:end-turn}}/></span>;
    }
    const start=centerLeft,end=loserOneLeft+routeWidth,turn=(start+end)/2;
    return <span className="double-path-set" key={`lr-${pair}`}><RoutePath className="horizontal" style={{left:turn,top:y1,width:start-turn}}/><RoutePath className="horizontal" style={{left:turn,top:y2,width:start-turn}}/><RoutePath className="vertical" style={{left:turn,top:y1,height:y2-y1}}/><RoutePath className="horizontal" style={{left:end,top:mid,width:turn-end}}/></span>;
  };
  return <section className="double-elim-group">
    <h3><b>第{groupNo}组</b><span>双败8进4 · 胜部2人、败部2人晋级</span></h3>
    <div className="double-elim-stage">
      <div className="double-column-title" style={{left:loserTerminalLeft,width:terminalWidth}}>败部晋级</div>
      <div className="double-column-title" style={{left:loserTwoLeft,width:routeWidth}}>败部第二轮</div>
      <div className="double-column-title" style={{left:loserOneLeft,width:routeWidth}}>败部第一轮</div>
      <div className="double-column-title center-title" style={{left:centerLeft,width:centerWidth}}>首轮对阵 / 胜部第一轮</div>
      <div className="double-column-title" style={{left:winnerLeft,width:routeWidth}}>胜部第二轮</div>
      <div className="double-column-title" style={{left:winnerTerminalLeft,width:terminalWidth}}>胜部晋级</div>
      {centerY.map((y,index)=><div className="stage-tree-match-wrap" style={{left:centerLeft,top:y-STAGE_MATCH_HEIGHT/2,width:centerWidth,height:STAGE_MATCH_HEIGHT}} key={`c-${index}`}><CompactTreeMatch round={0} index={index} showSlots query={query} prefix={`D${groupNo}-`} width={centerWidth}/></div>)}
      {routeY.map((y,index)=><div className="stage-tree-match-wrap" style={{left:winnerLeft,top:y-STAGE_MATCH_HEIGHT/2,width:routeWidth,height:STAGE_MATCH_HEIGHT}} key={`w-${index}`}><CompactTreeMatch round={1} index={index} showSlots={false} query={query} prefix={`W${groupNo}-`} width={routeWidth}/></div>)}
      {routeY.map((y,index)=><div className="stage-tree-match-wrap" style={{left:loserOneLeft,top:y-STAGE_MATCH_HEIGHT/2,width:routeWidth,height:STAGE_MATCH_HEIGHT}} key={`l1-${index}`}><CompactTreeMatch round={0} index={index} showSlots={false} query={query} prefix={`L${groupNo}A-`} width={routeWidth}/></div>)}
      {routeY.map((y,index)=><div className="stage-tree-match-wrap" style={{left:loserTwoLeft,top:y-STAGE_MATCH_HEIGHT/2,width:routeWidth,height:STAGE_MATCH_HEIGHT}} key={`l2-${index}`}><CompactTreeMatch round={1} index={index} showSlots={false} query={query} prefix={`L${groupNo}B-`} width={routeWidth}/></div>)}
      {routeY.map((y,index)=><div className="terminal-player-wrap" style={{left:winnerTerminalLeft,top:y-24,width:terminalWidth}} key={`wt-${index}`}><TerminalPlayer label={`晋级${index+1}`}/></div>)}
      {routeY.map((y,index)=><div className="terminal-player-wrap" style={{left:loserTerminalLeft,top:y-24,width:terminalWidth}} key={`lt-${index}`}><TerminalPlayer label={`晋级${index+3}`}/></div>)}
      <span className="double-lines">{[0,1].map(pair=>pairLines("right",pair))}{[0,1].map(pair=>pairLines("left",pair))}
        {routeY.map((y,index)=><span key={`straight-${index}`}><RoutePath className="horizontal" style={{left:loserTwoLeft+routeWidth,top:y,width:loserOneLeft-(loserTwoLeft+routeWidth)}}/><RoutePath className="horizontal" style={{left:loserTerminalLeft+terminalWidth,top:y,width:loserTwoLeft-(loserTerminalLeft+terminalWidth)}}/><RoutePath className="horizontal" style={{left:winnerLeft+routeWidth,top:y,width:winnerTerminalLeft-(winnerLeft+routeWidth)}}/></span>)}
        <RoutePath className="vertical dashed" style={{left:winnerLeft-10,top:58,height:routeY[0]-58}}/><RoutePath className="horizontal dashed" style={{left:loserTwoLeft+routeWidth,top:58,width:winnerLeft-10-(loserTwoLeft+routeWidth)}}/><RoutePath className="vertical dashed" style={{left:loserTwoLeft+routeWidth,top:58,height:routeY[0]-58}}/>
        <RoutePath className="vertical dashed" style={{left:winnerLeft-10,top:routeY[1],height:690-routeY[1]}}/><RoutePath className="horizontal dashed" style={{left:loserTwoLeft+routeWidth,top:690,width:winnerLeft-10-(loserTwoLeft+routeWidth)}}/><RoutePath className="vertical dashed" style={{left:loserTwoLeft+routeWidth,top:routeY[1],height:690-routeY[1]}}/>
      </span>
      <span className="double-feed-note feed-top">胜部负者转入败部</span><span className="double-feed-note feed-bottom">胜部负者转入败部</span>
    </div>
  </section>;
}

function DoubleElimPhaseBoard({query}:{query:string}){
  return <div className="double-elim-phase-board">{Array.from({length:8},(_,index)=><DoubleElimGroup groupNo={index+1} query={query} key={index}/>)}</div>;
}

function UnifiedBracket({data,group,setGroup,phase,onBack}:{data:EventData;group:Group;setGroup:(group:Group)=>void;phase:PhaseId;onBack:()=>void}){
  const [query,setQuery]=useState("");
  const [fullscreen,setFullscreen]=useState(false);
  const [located,setLocated]=useState("");
  const pan=useBracketPanZoom();
  const isQualifier=phase.startsWith("qualifier");
  const hasActual=group==="少年组"&&phase==="qualifier-one";
  const changeQuery=(value:string)=>{
    setQuery(value);setLocated("");
    const q=value.trim().toLowerCase();
    if(!hasActual||!q){pan.reset();return}
    const index=data.matches.findIndex((match,i)=>[match.playerA,match.playerB,match.table,`Q${Math.floor(i/16)+1}-1-${i%16+1}`].some(item=>item.toLowerCase().includes(q)));
    if(index>=0){
      const region=Math.floor(index/16),local=index%16;
      const targetY=region*QUALIFIER_ZONE_STRIDE+104+STAGE_TOP_PAD+local*STAGE_ROW_GAP;
      pan.focus(82,targetY);setLocated(data.matches[index].playerA.toLowerCase().includes(q)?data.matches[index].playerA:data.matches[index].playerB);
    }
  };
  const phaseName=phases.find(item=>item.id===phase)?.title;
  const board=isQualifier?<QualificationPhaseBoard data={data} group={group} phase={phase} query={query}/>:phase==="main-one"?<DoubleElimPhaseBoard query={query}/>:<StageKnockoutTree firstRoundCount={16} labels={["32进16","16进8","8进4","半决赛","决赛"]} query={query} prefix="M" terminalLabel="冠军"/>;
  return <div className="bracket-page stack">
    <button className="draw-back" onClick={onBack}>‹ 返回赛程阶段</button>
    <section className="bracket-title with-group compact-head"><div><small className="event-name-kicker">2026中国华彩十六球青少年系列赛廊坊站</small><h1>{phaseName}</h1><p>本阶段全部签位集中在一张赛程表</p></div><GroupSwitch group={group} setGroup={(value)=>{setGroup(value);setQuery("");setLocated("");pan.reset()}}/></section>
    <section className={`draw-shell unified-draw-shell ${fullscreen?"draw-fullscreen":""}`}>
      <div className="draw-toolbar"><div><small>{group} · 详细赛程表</small><h2>{phaseName}</h2><p>{isQualifier?"16个区连续排列；每区签表末端均标出直接晋级选手":phase==="main-one"?"中间首轮对阵，右侧胜部、左侧败部":"32强单败至冠军，末端显示冠军节点"}</p></div><label><span>⌕</span><input value={query} onChange={e=>changeQuery(e.target.value)} placeholder="搜索球员、球台或场次"/></label><div className="board-controls"><button onClick={()=>pan.setZoom(v=>Math.max(.45,v-.1))} aria-label="缩小">−</button><b>{Math.round(pan.zoom*100)}%</b><button onClick={()=>pan.setZoom(v=>Math.min(1.5,v+.1))} aria-label="放大">＋</button><button onClick={pan.reset}>复位</button><button className="fullscreen-btn" onClick={()=>{setFullscreen(v=>!v);pan.reset()}}>{fullscreen?"关闭全屏":"全屏查看"}</button></div></div>
      {located&&<div className="search-location" role="status">已定位并高亮：<strong>{located}</strong></div>}
      {isQualifier&&<div className="draw-data-note"><strong>晋级说明：</strong>各区32进16胜者共16人直接晋级；该轮负者按本站全部实际参赛局胜率排序，前8名追加晋级，共24人。</div>}
      <section className="bracket-viewport upgraded unified-viewport" onPointerDown={pan.down} onPointerMove={pan.move} onPointerUp={pan.up} onPointerCancel={pan.up}><div className="bracket-canvas corrected-canvas unified-canvas" style={{transform:`translate(${pan.offset.x}px,${pan.offset.y}px) scale(${pan.zoom})`}}>{board}</div></section>
      <p className="drag-tip">拖动查看整张签表；搜索命中后会自动定位并高亮。</p>
    </section>
  </div>;
}

const matchDays=[
  ["2026-7-25","周六","07-25"],["2026-7-26","周日","07-26"],["2026-7-27","周一","07-27"],["2026-7-28","周二","07-28"],["2026-7-29","周三","07-29"],["2026-7-30","周四","07-30"],["2026-7-31","周五","07-31"],["2026-8-1","周六","08-01"],["2026-8-2","周日","08-02"],["2026-8-3","周一","08-03"],["2026-8-4","周二","08-04"],
] as const;

function MatchList({data,group,setGroup}:{data:EventData;group:Group;setGroup:(group:Group)=>void}){
  const [day,setDay]=useState("2026-7-25"),[query,setQuery]=useState("");
  const matches=data.matches.filter(match=>group==="少年组"&&match.date===day&&[match.playerA,match.playerB,match.table,match.progress].some(item=>item.includes(query.trim())));
  return <div className="match-list-page stack">
    <section className="match-list-head with-group compact-head"><div><small className="event-name-kicker">2026中国华彩十六球青少年系列赛廊坊站</small><h1>对阵</h1><p>按日期查看当天对阵名单</p></div><GroupSwitch group={group} setGroup={setGroup}/></section>
    <section className="match-filter">
      <nav className="match-days">{matchDays.map(([value,week,date])=><button className={day===value?"active":""} onClick={()=>setDay(value)} key={value}><small>{week}</small><b>{date}</b></button>)}</nav>
      <label><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜索球员或球台"/></label>
    </section>
    <div className="match-count"><strong>{matchDays.find(item=>item[0]===day)?.[2]}</strong><span>{group} · {matches.length}场对阵</span></div>
    {matches.length?<section className="versus-list">{matches.map(match=><article className="versus-card" key={match.id}>
      <header><b>{match.time}</b><span>{match.progress} · {match.round} · 第{match.order}场</span></header>
      <section>
        <div className="match-player"><i>{match.playerA.slice(0,1)}</i><strong>{match.playerA}</strong></div>
        <div className="match-center"><strong>— : —</strong><span className="ended">已结束</span><b className={match.isTv?"tv":""}>{match.table}</b></div>
        <div className="match-player"><i>{match.playerB.slice(0,1)}</i><strong>{match.playerB}</strong></div>
      </section>
    </article>)}</section>:<section className="match-empty"><i>○</i><h2>当日对阵待公布</h2><p>{group}该日期的球员、比分和球台信息将在组委会确认后更新。</p></section>}
  </div>;
}

function Ranking({group,setGroup,prizes}:{group:Group;setGroup:(group:Group)=>void;prizes:PrizeMap}){return <div className="stack"><section className="ranking-head"><div><small className="event-name-kicker">2026中国华彩十六球青少年系列赛廊坊站</small><h1>比赛排名</h1><p>组别切换会同步应用于赛程、对阵和排名。</p></div><GroupSwitch group={group} setGroup={setGroup}/></section><section className="card ranking"><header><div><small>{group}</small><h2>奖金与最终名次</h2></div></header><div className="ranking-wait"><i/><div><strong>比赛结果待录入</strong><p>最终排名将在比赛结果确认后自动生成。</p></div></div><div className="prizes">{prizes[group].map(([rank,amount],index)=><div key={rank}><span>{index+1}</span><strong>{rank}</strong><b>{amount}</b></div>)}</div></section></div>}

function Players({data}:{data:EventData}){const [query,setQuery]=useState(""),[selected,setSelected]=useState("");const list=useMemo(()=>data.players.filter(name=>name.includes(query.trim())).slice(0,90),[data.players,query]);const related=selected?data.matches.filter(match=>match.playerA===selected||match.playerB===selected):[];return <div className="stack"><section className="player-hero"><h1>球员数据</h1><p>当前已录入河北廊坊站少年组资格赛第一场。</p><label><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="输入少年组选手姓名"/></label></section><section className="card"><header><div><small>河北廊坊站 · 少年组</small><h2>{query?`“${query}”的结果`:"已公布出场选手"}</h2></div><b>{data.players.length} 人</b></header><div className="players-grid">{list.map(name=>{const count=data.matches.filter(match=>match.playerA===name||match.playerB===name).length;return <button onClick={()=>setSelected(name)} key={name}><span>{name[0]}</span><div><strong>{name}</strong><small>{count} 场已公布赛程</small></div><b>›</b></button>})}</div></section>{selected&&<div className="overlay" onClick={()=>setSelected("")}><aside onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setSelected("")}>×</button><div className="avatar">{selected[0]}</div><span className="tag">少年组</span><h2>{selected}</h2><p>2026华彩十六球青少年系列赛 · 河北廊坊站</p><div className="player-stats"><div><strong>{related.length}</strong><span>已公布场次</span></div><div><strong>{related.filter(match=>match.isTv).length}</strong><span>转播台场次</span></div></div><h3>比赛安排</h3>{related.map(match=><article className="player-match" key={match.id}><div><strong>{shortDate(match.date)} {match.time}</strong><span>{match.progress} · {match.race}</span></div><b>{match.table}</b></article>)}</aside></div>}</div>}
function Me(){return <div className="stack"><section className="profile"><div>选</div><span><h1>个人中心</h1><p>登录后查看报名、赛程、成绩与积分。</p></span></section><section className="quick">{[["报名","我的报名","审核及缴费状态"],["赛程","我的比赛","检录、时间和球台"],["成绩","参赛记录","排名与赛事积分"],["家长","选手管理","绑定青少年选手"]].map(item=><article key={item[0]}><span>{item[0]}</span><strong>{item[1]}</strong><small>{item[2]}</small></article>)}</section><section className="card signin"><div><small>后续功能</small><h2>账户功能下一阶段接入</h2><p>当前阶段先完善公开赛事、竞赛规程、赛程和对阵图；报名、裁判及组委会操作将在下一阶段接入。</p></div><button>体验登录流程</button></section></div>}

function ParticipantGuide({kind,onBack}:{kind:GuideKind;onBack:()=>void}){
  const isClothing=kind==="clothing";
  return <div className="guide-page stack"><button className="draw-back" onClick={onBack}>‹ 返回赛事概览</button><section className="guide-hero"><span>{isClothing?"装":"行"}</span><div><small>参赛友好提示</small><h1>{isClothing?"服装要求":"交通住宿攻略"}</h1><p>2026中国华彩十六球青少年系列赛廊坊站</p></div></section><section className="card guide-placeholder"><span>待</span><h2>待组委会更新</h2><p>{isClothing?"参赛服装、鞋履及现场着装要求将在组委会确认后更新。":"场馆交通路线、停车信息及周边住宿建议将在组委会确认后更新。"}</p></section></div>;
}

export default function EventApp({data}:{data:EventData}){
  const [view,setView]=useState<MainView>("event"),[selectedId,setSelectedId]=useState<string|null>(null),[tab,setTab]=useState<EventTab>("overview"),[group,setGroup]=useState<Group>("少年组"),[bracketPhase,setBracketPhase]=useState<PhaseId>("qualifier-one"),[guideKind,setGuideKind]=useState<GuideKind>("clothing");
  const station=selectedId?stations[selectedId as keyof typeof stations]:null; const isLangfang=selectedId==="langfang";
  const openEvent=(id:string)=>{setSelectedId(id);setTab("overview");window.scrollTo({top:0,behavior:"smooth"})}; const back=()=>{setSelectedId(null);setTab("overview");window.scrollTo({top:0,behavior:"smooth"})}; const enter=(next:MainView)=>{setView(next);if(next==="event")setSelectedId(null)};
  const openBracket=(phase:PhaseId)=>{setBracketPhase(phase);setTab("draw");window.scrollTo({top:0,behavior:"smooth"})};
  const title=view==="players"?"球员数据":view==="me"?"个人中心":station?.city||"赛事中心";
  const openGuide=(kind:GuideKind)=>{setGuideKind(kind);setTab("guide");window.scrollTo({top:0,behavior:"smooth"})};
  return <main><header className="top"><button className="brand" onClick={()=>{setView("event");back()}}><span>华</span><strong>华彩赛事</strong></button><h3>{title}</h3><a className="admin" href="/admin">组委会入口</a></header><div className="layout"><aside className="side">{[["event","赛","赛事","官方赛事与赛程"],["players","员","球员","球员档案与数据"],["me","我","我的","报名、比赛与积分"]].map(item=><button className={view===item[0]?"active":""} onClick={()=>enter(item[0] as MainView)} key={item[0]}><span>{item[1]}</span><div><strong>{item[2]}</strong><small>{item[3]}</small></div></button>)}</aside><div className="content">{view==="event"&&!station&&<EventCenter openEvent={openEvent}/>} {view==="event"&&station&&<><button className="back" onClick={back}>‹ 返回赛事中心</button><nav className={`tabs ${!isLangfang?"short-tabs":""}`}>{([["overview","概览"],["rules","竞赛规程"],...(isLangfang?[["schedule","赛程"],["bracket","对阵"],["ranking","排名"]]:[])] as [EventTab,string][]).map(item=><button className={tab===item[0]||(tab==="draw"&&item[0]==="schedule")||(tab==="guide"&&item[0]==="overview")?"active":""} onClick={()=>setTab(item[0])} key={item[0]}>{item[1]}</button>)}</nav>{tab==="overview"&&<StationOverview station={station} data={data} openRules={()=>setTab("rules")} openSchedule={isLangfang?()=>setTab("schedule"):undefined} openGuide={openGuide}/>} {tab==="guide"&&<ParticipantGuide kind={guideKind} onBack={()=>setTab("overview")}/>} {tab==="rules"&&<CompetitionRules station={station}/>} {isLangfang&&tab==="schedule"&&<Schedule group={group} setGroup={setGroup} openBracket={openBracket}/>} {isLangfang&&tab==="bracket"&&<MatchList data={data} group={group} setGroup={setGroup}/>} {isLangfang&&tab==="draw"&&<UnifiedBracket data={data} group={group} setGroup={setGroup} phase={bracketPhase} onBack={()=>setTab("schedule")}/>} {isLangfang&&tab==="ranking"&&<Ranking group={group} setGroup={setGroup} prizes={station.prizes}/>}</>} {view==="players"&&<Players data={data}/>} {view==="me"&&<Me/>}</div></div><nav className="bottom">{[["event","赛","赛事"],["players","员","球员"],["me","我","我的"]].map(item=><button className={view===item[0]?"active":""} onClick={()=>enter(item[0] as MainView)} key={item[0]}><span>{item[1]}</span><strong>{item[2]}</strong></button>)}</nav></main>;
}
