import appearance from "./data/appearance.json";
import EventApp from "./event-app";
import LangfangRankingStatic from "./langfang-ranking-static";
import { langfangFinalMatches } from "./data/langfang-final-matches";

export default function Home() {
  const originalMatches = appearance.matches.filter((match) => match.group === "少年组");
  const matches = [...originalMatches, ...langfangFinalMatches];
  const players = Array.from(new Set(matches.filter((match) => match.group === "少年组").flatMap((match) => [match.playerA, match.playerB]).filter(Boolean))).sort((a, b) => a.localeCompare(b, "zh-CN"));
  return <><EventApp data={{ matches, players }} /><LangfangRankingStatic /></>;
}
