import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const root = readFileSync(new URL("../app/snooker/snooker-data-center-v2.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/snooker/page.tsx", import.meta.url), "utf8");
const directory = readFileSync(new URL("../app/snooker/players/player-directory.tsx", import.meta.url), "utf8");
const inline = readFileSync(new URL("../app/snooker/players/player-detail-inline.tsx", import.meta.url), "utf8");
const detail = readFileSync(new URL("../app/snooker/players/player-detail-content.tsx", import.meta.url), "utf8");
const api = readFileSync(new URL("../app/api/snooker/v1/player-detail/route.ts", import.meta.url), "utf8");
const fastLoader = readFileSync(new URL("../lib/snooker/player-detail-fast.ts", import.meta.url), "utf8");
const playerData = readFileSync(new URL("../lib/snooker/player-data.ts", import.meta.url), "utf8");

test("player detail stays inside the root SnookerDataCenterV2 flow", () => {
  assert.match(root, /\| \{ type: "player"; slug: string; returnView: MainView \}/);
  assert.match(root, /<PlayerDetailInline key=\{detail\.slug\} summaryPlayer=\{summaryPlayer\} slug=\{detail\.slug\} \/>/);
  assert.match(root, /history\.pushState\(/);
  assert.match(root, /searchParams\.set\("player", target\.slug\)/);
  assert.match(root, /window\.addEventListener\("popstate", onPopState\)/);
  assert.doesNotMatch(root, /\/snooker\/players\/\$\{/);
  assert.doesNotMatch(root, /SnookerRootController/);
  assert.doesNotMatch(root, /useRouter/);
});

test("canonical player deep links use root query params", () => {
  assert.match(page, /player\?: string/);
  assert.match(page, /initialPlayerSlug=\{requestedPlayer\}/);
  assert.match(page, /loadSnookerDatabaseViewV2\(\)/);
  assert.doesNotMatch(directory, /next\/link/);
  assert.doesNotMatch(directory, /\/snooker\/players\//);
  assert.match(directory, /onOpenPlayer/);
  assert.match(directory, /onPrefetchPlayer/);
});

test("player directory search and filter state are owned by the persistent root", () => {
  assert.match(root, /const \[playerQuery, setPlayerQuery\] = useState\(""\)/);
  assert.match(root, /const \[playerFilter, setPlayerFilter\] = useState<PlayerFilter>\("all"\)/);
  assert.match(root, /query=\{playerQuery\} filter=\{playerFilter\}/);
  assert.match(directory, /query: string/);
  assert.match(directory, /filter: PlayerFilter/);
  assert.doesNotMatch(directory, /directorySession/);
});

test("player detail is content-only and uses the focused cached API", () => {
  assert.match(inline, /loadPlayerDetail\(slug\)/);
  assert.match(inline, /partialDetail\(summary\)/);
  assert.doesNotMatch(inline, /setLoadFailed\(false\)/);
  assert.match(detail, /export function PlayerDetailContent/);
  assert.doesNotMatch(detail, /PlayerShell/);
  assert.match(api, /getSnookerPlayerDetailFast/);
  assert.match(api, /stale-while-revalidate=1800/);
});

test("player detail prefers translated Chinese profile and career text", () => {
  assert.match(fastLoader, /biography_html_zh/);
  assert.match(fastLoader, /description_zh/);
  assert.match(fastLoader, /last_tournament_win_zh/);
  assert.match(playerData, /nickname_zh,biography_html_en,biography_html_zh,quote_en,quote_zh/);
  assert.match(playerData, /description_en,description_zh/);
  assert.match(detail, /player\.biographyZh/);
  assert.match(detail, /player\.nicknameZh/);
  assert.match(detail, /career\?\.lastTournamentWinZh/);
  assert.match(detail, /item\.descriptionZh/);
  assert.doesNotMatch(detail, /中文简介将在资料翻译校验后替换/);
  assert.doesNotMatch(detail, /职业生涯中文化将在下一轮内容层完成/);
});

test("old independent player routes and shell stay removed", () => {
  const removed = [
    "../app/snooker/players/page.tsx",
    "../app/snooker/players/player-shell.tsx",
    "../app/snooker/players/[slug]/loading.tsx",
    "../app/snooker/players/[slug]/page.tsx",
    "../app/snooker/players/[slug]/player-detail.tsx",
  ];
  for (const relative of removed) assert.equal(existsSync(new URL(relative, import.meta.url)), false, `${relative} should stay removed`);
});
