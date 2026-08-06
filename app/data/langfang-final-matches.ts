import raw from "./langfang-static-results.json";

type Group = "少年组" | "青年组";
type RawMatch = [string,string,string,string,string];
type Key = "s" | "y";
type StaticData = { f:Record<Key,Record<string,RawMatch[]>>; k:Record<Key,RawMatch[]> };

type FinalMatch = {
  id:string; group:Group; date:string; time:string; round:string; progress:string; race:string; order:number;
  playerA:string; playerB:string; scoreA:string; scoreB:string; table:string; isTv:boolean; status:string;
};

const data=raw as unknown as StaticData;
const pools=["A","B","C","D","E","F","G","H"];

function firstRound(no:number){return no<=4?"第一轮":no<=6?"败部第一轮":no<=8?"胜部晋级轮":"败部晋级轮";}
function secondRound(no:number){return no<=16?"32进16":no<=24?"16进8":no<=28?"8进4":no<=30?"半决赛":no===31?"三四名决赛":"决赛";}

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

function firstMatches(group:Group,key:Key,pool:string){
  const rows=[...(data.f[key][pool]||[])];
  if(group==="少年组"&&pool==="F"){
    const i=rows.findIndex(item=>item[0]==="4");
    if(i>=0)rows[i]=["4","谈炜琦","2","王梓豪元","7"];
  }
  return rows;
}

function build(group:Group,key:Key):FinalMatch[]{
  const first=pools.flatMap(pool=>firstMatches(group,key,pool).map(item=>{
    const no=Number(item[0]); const [date,time]=firstTiming(group,pool,no);
    return {id:`lf-${key}-m1-${pool}${no}`,group,date,time,round:`${pool}组 · ${firstRound(no)}`,progress:"正赛第一阶段",race:group==="少年组"?"13局7胜":"17局9胜",order:no,playerA:item[1],playerB:item[3],scoreA:item[2],scoreB:item[4],table:`${pool}${no}`,isTv:false,status:"ended"};
  }));
  const second=(data.k[key]||[]).map(item=>{
    const no=Number(item[0]); const [date,time]=secondTiming(group,no);
    return {id:`lf-${key}-m2-${no}`,group,date,time,round:secondRound(no),progress:"正赛第二阶段",race:group==="少年组"?"17局9胜":"21局11胜",order:no,playerA:item[1],playerB:item[3],scoreA:item[2],scoreB:item[4],table:String(no),isTv:false,status:"ended"};
  });
  return [...first,...second];
}

export const langfangFinalMatches:FinalMatch[]=[...build("少年组","s"),...build("青年组","y")];
