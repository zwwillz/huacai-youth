import EventApp from "./event-app";
import LangfangRankingStatic from "./langfang-ranking-static";
import { getPublicSiteData } from "@/db/public";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  const data = await getPublicSiteData();
  return <><EventApp data={data} /><LangfangRankingStatic /></>;
}
