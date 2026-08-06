import EventApp from "./event-app";
import LangfangRankingStatic from "./langfang-ranking-static";
import LangfangDbEnhancer from "./langfang-db-enhancer";
import { getPublicSiteData } from "@/db/public";
import { getPublicRankings } from "@/db/rankings";
import { getCompetitionMatches } from "@/db/competition-matches";

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
.station-${station.id} .hero-poster{background-image:radial-gradient(circle at 50% 22%,#ff65b35c,transparent 27%),linear-gradient(145deg,#331376,#6842d1)!important;background-size:cover!important;background-position:center!important}
.station-${station.id} .hero-poster:after{content:"";display:block!important;width:150px;height:150px;border:2px solid #ffffff21;border-radius:50%;box-shadow:0 0 0 28px #ffffff08,0 0 0 56px #ffffff05;position:absolute;left:50%;top:50%;transform:translate(-50%,-50%)}`;
  }).join("\n");
}

export default async function Home() {
  const data = await getPublicSiteData();
  const langfangEventId = data.stations.find((station) => station.id === "langfang")?.eventId;
  const rankings = langfangEventId ? await getPublicRankings(langfangEventId) : [];
  const competitionMatches = langfangEventId ? await getCompetitionMatches(langfangEventId) : [];
  const visualCss = eventVisualCss(data.stations);

  return <>
    <style dangerouslySetInnerHTML={{ __html: visualCss }} />
    <EventApp data={data} />
    <LangfangRankingStatic rankings={rankings} />
    <LangfangDbEnhancer matches={competitionMatches} />
  </>;
}
