import appearance from "./data/appearance.json";
import EventApp from "./event-app";
import LangfangRankingStatic from "./langfang-ranking-static";

export default function Home() {
  const matches = appearance.matches.filter((match) => match.group === "少年组");
  const players = Array.from(new Set(matches.flatMap((match) => [match.playerA, match.playerB]).filter(Boolean))).sort((a, b) => a.localeCompare(b, "zh-CN"));
  return <><EventApp data={{ matches, players }} /><LangfangRankingStatic /></>;
}
