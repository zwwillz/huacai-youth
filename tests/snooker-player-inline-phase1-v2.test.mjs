import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const root = readFileSync(new URL("../app/snooker/snooker-data-center-v2.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/snooker/page.tsx", import.meta.url), "utf8");
const directory = readFileSync(new URL("../app/snooker/players/player-directory.tsx", import.meta.url), "utf8");
const inline = readFileSync(new URL("../app/snooker/players/player-detail-inline.tsx", import.meta.url), "utf8");
const detail = readFileSync(new URL("../app/snooker/players/player-detail-content.tsx", import.meta.url), "utf8");
const api = readFileSync(new URL("../app/api/snooker/v1/player-detail/route.ts", import.meta.url), "utf8");

test("player detail stays inside the root SnookerDataCenterV2 flow", () => {
  assert.match(root, /\| \{ type: "player"; slug: string; returnView: MainView \}/);
  assert.match(root, /<PlayerDetailInline summaryPlayer=\{summaryPlayer\} slug=\{detail\.slug\} \/>/);
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

test("player detail is content-only and uses the focused cached API", () => {
  assert.match(inline, /loadPlayerDetail\(slug\)/);
  assert.match(inline, /partialDetail\(summary\)/);
  assert.match(detail, /export function PlayerDetailContent/);
  assert.doesNotMatch(detail, /PlayerShell/);
  assert.match(api, /getSnookerPlayerDetailFast/);
  assert.match(api, /stale-while-revalidate=1800/);
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
