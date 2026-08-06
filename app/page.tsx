import EventApp from "./event-app";
import LangfangRankingStatic from "./langfang-ranking-static";
import LangfangDbEnhancer from "./langfang-db-enhancer";
import { getPublicSiteData } from "@/db/public";
import { getPublicRankings } from "@/db/rankings";
import { getCompetitionMatches } from "@/db/competition-matches";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  const data = await getPublicSiteData();
  const langfangEventId = data.stations.find((station) => station.id === "langfang")?.eventId;
  const rankings = langfangEventId ? await getPublicRankings(langfangEventId) : [];
  const competitionMatches = langfangEventId ? await getCompetitionMatches(langfangEventId) : [];

  return <>
    <EventApp data={data} />
    <LangfangRankingStatic rankings={rankings} />
    <LangfangDbEnhancer matches={competitionMatches} />
  </>;
}
