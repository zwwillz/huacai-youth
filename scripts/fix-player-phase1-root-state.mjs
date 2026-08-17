import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";

function replaceOrThrow(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`Missing patch anchor: ${label}`);
  return source.replace(before, after);
}

const path = "app/snooker/snooker-data-center-v2.tsx";
let source = readFileSync(path, "utf8");

source = replaceOrThrow(
  source,
  'import { PlayerDirectoryContent } from "./players/player-directory";\n',
  'import { PlayerDirectoryContent, type PlayerFilter } from "./players/player-directory";\n',
  "player-filter-import",
);

source = replaceOrThrow(
  source,
  '  const [eventListMode, setEventListMode] = useState<EventListMode>("recent");\n  const [matchDataTab, setMatchDataTab] = useState<MatchDataTab>("match");\n',
  '  const [eventListMode, setEventListMode] = useState<EventListMode>("recent");\n  const [playerQuery, setPlayerQuery] = useState("");\n  const [playerFilter, setPlayerFilter] = useState<PlayerFilter>("all");\n  const [matchDataTab, setMatchDataTab] = useState<MatchDataTab>("match");\n',
  "root-player-directory-state",
);

source = replaceOrThrow(
  source,
  '<PlayerDetailInline summaryPlayer={summaryPlayer} slug={detail.slug} />',
  '<PlayerDetailInline key={detail.slug} summaryPlayer={summaryPlayer} slug={detail.slug} />',
  "detail-key",
);

source = replaceOrThrow(
  source,
  '      {activeView === "players" ? <PlayerDirectoryContent players={directoryPlayers} onOpenPlayer={(player) => openPlayer(player.id)} onPrefetchPlayer={(player) => prefetchPlayerDetail(player.slug)} /> : null}\n',
  '      {activeView === "players" ? <PlayerDirectoryContent players={directoryPlayers} query={playerQuery} filter={playerFilter} onQueryChange={setPlayerQuery} onFilterChange={setPlayerFilter} onOpenPlayer={(player) => openPlayer(player.id)} onPrefetchPlayer={(player) => prefetchPlayerDetail(player.slug)} /> : null}\n',
  "directory-root-state-props",
);

writeFileSync(path, source);

for (const temporary of [".github/workflows/fix-player-phase1-root-state.yml", "scripts/fix-player-phase1-root-state.mjs"]) {
  if (existsSync(temporary)) rmSync(temporary);
}
