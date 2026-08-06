import EventApp from "./event-app";
import LangfangRankingStatic from "./langfang-ranking-static";
import { getPublicSiteData } from "@/db/public";
import { getPublicRankings } from "@/db/rankings";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  const data = await getPublicSiteData();
  const langfangEventId = data.stations.find((station) => station.id === "langfang")?.eventId;
  const rankings = langfangEventId ? await getPublicRankings(langfangEventId) : [];
  return <><EventApp data={data} /><LangfangRankingStatic rankings={rankings} /></>;
}
