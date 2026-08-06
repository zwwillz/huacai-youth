from pathlib import Path
import re

path = Path("app/event-app.tsx")
text = path.read_text()
original = text

if 'from "./public-types"' not in text:
    old_types = '''type Match = { id:string; group:string; date:string; time:string; round:string; progress:string; race:string; order:number; playerA:string; playerB:string; table:string; isTv:boolean; status:string };
type EventData = { matches: Match[]; players: string[] };
type MainView = "event" | "players" | "me";
type EventTab = "overview" | "rules" | "schedule" | "bracket" | "draw" | "ranking" | "guide";
type Group = "少年组" | "青年组";
type PhaseId = "qualifier-one" | "qualifier-two" | "main-one" | "main-two";
type GuideKind = "transport" | "clothing";
type PrizeMap = Record<Group, string[][]>;
'''
    new_types = '''import type { EventData, Group, Match, Phase, PhaseId, PrizeMap, Station } from "./public-types";

type MainView = "event" | "players" | "me";
type EventTab = "overview" | "rules" | "schedule" | "bracket" | "draw" | "ranking" | "guide";
type GuideKind = "transport" | "clothing";
'''
    assert old_types in text
    text = text.replace(old_types, new_types, 1)

    text, count = re.subn(r'const standardPrizes: PrizeMap = \{.*?\nconst shortDate', 'const shortDate', text, count=1, flags=re.S)
    assert count == 1

    text = text.replace(
        'function EventCenter({openEvent}:{openEvent:(id:string)=>void}) {\n  const [year,setYear]=useState(2026);\n  const years=[2025,2026,2027,2028];\n  const hasEvents=year===2026;',
        'function EventCenter({data,openEvent}:{data:EventData;openEvent:(id:string)=>void}) {\n  const [year,setYear]=useState(2026);\n  const years=[2025,2026,2027,2028];\n  const stationList=data.stations.filter(station=>station.year===year);\n  const hasEvents=stationList.length>0;',
        1,
    )

    text = text.replace(
        'function StationOverview({station,data,openRules,openSchedule,openGuide}:{station:Station;data:EventData;openRules:()=>void;openSchedule?:()=>void;openGuide:(kind:GuideKind)=>void}) {\n  const isLangfang=station.id==="langfang";',
        'function StationOverview({station,data,openRules,openSchedule,openGuide}:{station:Station;data:EventData;openRules:()=>void;openSchedule?:()=>void;openGuide:(kind:GuideKind)=>void}) {\n  const isLangfang=station.id==="langfang";\n  const stationYouthMatches=data.matches.filter(match=>match.eventId===station.eventId&&match.group==="少年组");\n  const stationYouthPlayers=isLangfang?data.players:[];',
        1,
    )
    text = text.replace('{data.players.length}</strong><span>少年组已公布出场选手', '{stationYouthPlayers.length}</strong><span>少年组已公布出场选手', 1)
    text = text.replace('{data.matches.length}</strong><span>少年组已公布首轮对阵', '{stationYouthMatches.length}</strong><span>少年组已公布首轮对阵', 1)

    text = text.replace(
        'function Schedule({group,setGroup,openBracket}:{group:Group;setGroup:(group:Group)=>void;openBracket:(phase:PhaseId)=>void}) {',
        'function Schedule({group,setGroup,openBracket,phases}:{group:Group;setGroup:(group:Group)=>void;openBracket:(phase:PhaseId)=>void;phases:Phase[]}) {',
        1,
    )

    text = text.replace(
        'function Bracket({data,group,setGroup,phase,setPhase,onBack}:{data:EventData;group:Group;setGroup:(group:Group)=>void;phase:PhaseId;setPhase:(phase:PhaseId)=>void;onBack:()=>void}){',
        'function Bracket({data,group,setGroup,phase,setPhase,onBack,phases}:{data:EventData;group:Group;setGroup:(group:Group)=>void;phase:PhaseId;setPhase:(phase:PhaseId)=>void;onBack:()=>void;phases:Phase[]}){',
        1,
    )

    old_qualification = '''function QualificationPhaseBoard({data,group,phase,query}:{data:EventData;group:Group;phase:PhaseId;query:string}){
  const hasActual=group==="少年组"&&phase==="qualifier-one";
  const firstLabel=group==="青年组"?"附加赛 / 512进256":phase==="qualifier-one"?"498进256":"474进256";
  const labels=[firstLabel,"256进128","128进64","64进32","32进16"];
  return <div className="qualification-phase-board">
    {Array.from({length:16},(_,region)=>{
      const matches=hasActual?data.matches.slice(region*16,region*16+16):undefined;'''
    new_qualification = '''function QualificationPhaseBoard({data,group,phase,query}:{data:EventData;group:Group;phase:PhaseId;query:string}){
  const phaseMatches=data.matches.filter(match=>match.group===group&&match.phaseId===phase);
  const hasActual=phaseMatches.length>0;
  const firstLabel=group==="青年组"?"附加赛 / 512进256":phase==="qualifier-one"?"498进256":"474进256";
  const labels=[firstLabel,"256进128","128进64","64进32","32进16"];
  return <div className="qualification-phase-board">
    {Array.from({length:16},(_,region)=>{
      const matches=hasActual?phaseMatches.slice(region*16,region*16+16):undefined;'''
    assert old_qualification in text
    text = text.replace(old_qualification, new_qualification, 1)

    text = text.replace(
        'function UnifiedBracket({data,group,setGroup,phase,onBack}:{data:EventData;group:Group;setGroup:(group:Group)=>void;phase:PhaseId;onBack:()=>void}){',
        'function UnifiedBracket({data,group,setGroup,phase,onBack,phases}:{data:EventData;group:Group;setGroup:(group:Group)=>void;phase:PhaseId;onBack:()=>void;phases:Phase[]}){',
        1,
    )
    text = text.replace(
        '  const isQualifier=phase.startsWith("qualifier");\n  const hasActual=group==="少年组"&&phase==="qualifier-one";',
        '  const isQualifier=phase.startsWith("qualifier");\n  const phaseMatches=data.matches.filter(match=>match.group===group&&match.phaseId===phase);\n  const hasActual=phaseMatches.length>0;',
        1,
    )
    text = text.replace('const index=data.matches.findIndex((match,i)=>', 'const index=phaseMatches.findIndex((match,i)=>', 1)
    text = text.replace('setLocated(data.matches[index].playerA.toLowerCase().includes(q)?data.matches[index].playerA:data.matches[index].playerB);', 'setLocated(phaseMatches[index].playerA.toLowerCase().includes(q)?phaseMatches[index].playerA:phaseMatches[index].playerB);', 1)

    text = text.replace(
        'const matches=data.matches.filter(match=>group==="少年组"&&match.date===day&&[match.playerA,match.playerB,match.table,match.progress].some(item=>item.includes(query.trim())));',
        'const matches=data.matches.filter(match=>match.group===group&&match.date===day&&[match.playerA,match.playerB,match.table,match.progress].some(item=>item.includes(query.trim())));',
        1,
    )

    text = text.replace(
        '  const station=selectedId?stations[selectedId as keyof typeof stations]:null; const isLangfang=selectedId==="langfang";',
        '  const station=selectedId?data.stations.find(item=>item.id===selectedId)??null:null; const isLangfang=selectedId==="langfang";',
        1,
    )
    text = text.replace('<EventCenter openEvent={openEvent}/>', '<EventCenter data={data} openEvent={openEvent}/>', 1)
    text = text.replace('<Schedule group={group} setGroup={setGroup} openBracket={openBracket}/>', '<Schedule group={group} setGroup={setGroup} openBracket={openBracket} phases={station.phases}/>', 1)
    text = text.replace('<UnifiedBracket data={data} group={group} setGroup={setGroup} phase={bracketPhase} onBack={()=>setTab("schedule")}/>', '<UnifiedBracket data={data} group={group} setGroup={setGroup} phase={bracketPhase} onBack={()=>setTab("schedule")} phases={station.phases}/>', 1)

if text != original:
    path.write_text(text)
