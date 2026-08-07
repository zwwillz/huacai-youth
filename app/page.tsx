import EventApp from "./event-app";
import LangfangRankingStatic from "./langfang-ranking-static";
import LangfangDbEnhancer from "./langfang-db-enhancer";
import PublicContentEnhancer from "./public-content-enhancer";
import PublicCompetitionLiveV2 from "./public-competition-live-v2";
import PublicTabsUnifier from "./public-tabs-unifier";
import PlayerDbView from "./player-db-view";
import MePreview from "./me-preview";
import { getPublicSiteData } from "@/db/public";
import { getPublicContentState } from "@/db/public-content";
import { getPublicRankings } from "@/db/rankings";
import { getCompetitionMatches } from "@/db/competition-matches";
import { getPublicCompetitionEvents } from "@/db/public-competition-live";
import { getPublicPlayerDetail, getPublicPlayerSummaries } from "@/db/player-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function eventVisualCss(stations: Awaited<ReturnType<typeof getPublicSiteData>>["stations"]) {
  return stations.map((station) => {
    if (station.coverImage) {
      const image = JSON.stringify(station.coverImage);
      return `
.cover-${station.id}{background-image:linear-gradient(0deg,#271064ed 0%,#43149e6f 54%,transparent),url(${image})!important;background-size:cover!important;background-position:center!important}
.cover-${station.id}:before{display:none!important}
.station-${station.id} .hero-poster{background-image:linear-gradient(90deg,#341476 0%,#34147635 38%,transparent 62%),url(${image})!important;background-size:cover!important;background-position:center 10%!important}
.station-${station.id} .hero-poster:after{display:none!important}`;
    }

    if (station.id === "taiyuan" || station.id === "miyun") return "";
    return `
.cover-${station.id}{background-image:radial-gradient(circle at 76% 14%,#ff62b675,transparent 29%),linear-gradient(145deg,#2b126e,#6d36c9)!important}
.station-${station.id} .hero-poster{background-image:radial-gradient(circle at 50% 22%,#ff64a77d,transparent 27%),linear-gradient(145deg,#5d146d,#b22d87)!important;background-size:cover!important;background-position:center!important;position:relative!important}
.station-${station.id} .hero-poster:after{content:"";display:block!important;width:150px;height:150px;border:2px solid #ffffff21;border-radius:50%;box-shadow:0 0 0 28px #ffffff08,0 0 0 56px #ffffff05}
.station-${station.id} .hero-poster strong,.station-${station.id} .hero-poster span{display:block!important;position:absolute;z-index:2}
.station-${station.id} .hero-poster strong{top:43%;font-size:14px;color:#d9cef0}
.station-${station.id} .hero-poster span{top:49%;font-size:38px;font-weight:900}`;
  }).join("\n");
}

export default async function Home() {
  const data = await getPublicSiteData();
  const langfangEventId = data.stations.find((station) => station.id === "langfang")?.eventId;
  // 廊坊继续作为已经确认的前端UI基准；其它分站只要数据库有竞赛数据并由后台发布，统一走同一套动态竞赛UI。
  const dynamicCompetitionEventIds = data.stations.filter((station) => station.id !== "langfang").map((station) => station.eventId);
  const [contentStates, rankings, dynamicRankings, competitionMatches, liveCompetitions, players] = await Promise.all([
    getPublicContentState(data.stations.map((station) => ({ id: station.id, eventId: station.eventId, title: station.title }))),
    langfangEventId ? getPublicRankings(langfangEventId) : Promise.resolve([]),
    Promise.all(dynamicCompetitionEventIds.map((eventId) => getPublicRankings(eventId))).then((groups) => groups.flat()),
    langfangEventId ? getCompetitionMatches(langfangEventId) : Promise.resolve([]),
    dynamicCompetitionEventIds.length ? getPublicCompetitionEvents(dynamicCompetitionEventIds) : Promise.resolve([]),
    getPublicPlayerSummaries(),
  ]);

  const demoSummary = players.find((player) => competitionMatches.some((match) => match.playerAId === player.id || match.playerBId === player.id)) ?? players[0] ?? null;
  const demoPlayer = demoSummary ? await getPublicPlayerDetail(demoSummary.id) : null;
  const demoMatches = demoSummary
    ? competitionMatches.filter((match) => match.playerAId === demoSummary.id || match.playerBId === demoSummary.id)
    : [];
  const visualCss = eventVisualCss(data.stations);

  return <>
    <style dangerouslySetInnerHTML={{ __html: visualCss }} />
    <style>{`
      /* 数据库竞赛分站的顶部菜单严格使用廊坊站原生 tabs 视觉，不使用单独的五列网格样式。 */
      .tabs.public-five-tabs,.tabs.public-unified-tabs{
        display:flex!important;
        grid-template-columns:none!important;
        width:max-content!important;
        max-width:100%!important;
        gap:5px!important;
        padding:5px!important;
      }
      .tabs.public-five-tabs button,.tabs.public-unified-tabs button{
        min-width:0!important;
        padding:8px 14px!important;
        font-size:11px!important;
      }
      @media(max-width:900px){
        .tabs.public-five-tabs,.tabs.public-unified-tabs{display:flex!important;width:max-content!important}
        .tabs.public-five-tabs button,.tabs.public-unified-tabs button{padding:8px 14px!important;font-size:11px!important}
      }
    `}</style>
    <EventApp data={data} />
    <PublicContentEnhancer states={contentStates} />
    <PublicCompetitionLiveV2 stations={data.stations} events={liveCompetitions} contentStates={contentStates} rankings={dynamicRankings} />
    <PublicTabsUnifier />
    <LangfangRankingStatic rankings={rankings} />
    <LangfangDbEnhancer matches={competitionMatches} />
    <PlayerDbView players={players} />
    <MePreview player={demoPlayer} matches={demoMatches} />
  </>;
}
