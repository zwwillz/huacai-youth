import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("player directory keeps 256 WebP while every player detail layer upgrades to 512 WebP", async () => {
  const fallbackSource = await readFile("lib/snooker/player-data.ts", "utf8");
  const fastSource = await readFile("lib/snooker/player-detail-fast.ts", "utf8");
  const clientSource = await readFile("app/snooker/players/player-detail-client.ts", "utf8");
  const inlineSource = await readFile("app/snooker/players/player-detail-inline.tsx", "utf8");

  assert.match(fallbackSource, /function detailAvatarUrl\(value: string \| null\)/);
  assert.match(fallbackSource, /value\.replace\("\/wst\/256\/", "\/wst\/512\/"\)/);
  assert.match(fallbackSource, /avatarUrl: detailAvatarUrl\(basePlayer\.avatarUrl\)/);
  assert.match(fallbackSource, /avatarUrl: row\.avatar_url/);

  assert.match(fastSource, /avatarUrl: detailAvatarUrl\(p\.avatar_url\)/);
  assert.match(clientSource, /normalizePlayerDetail\(payload\.player\)/);
  assert.match(clientSource, /preloadPlayerDetailAvatar/);
  assert.match(clientSource, /fetchPriority/);
  assert.match(inlineSource, /displayAvatarUrl/);
  assert.match(inlineSource, /preloadPlayerDetailAvatar\(candidate, \"high\"\)/);
  assert.match(inlineSource, /avatarUrl: player\.avatarUrl \|\| player\.avatar\?\.url \|\| null/);
});

test("player directory excludes draw placeholders before search and filters", async () => {
  const source = await readFile("app/snooker/players/player-directory.tsx", "utf8");

  assert.match(source, /function isConcretePlayer\(player: SnookerPlayerListItem\)/);
  assert.match(source, /China Wildcard/);
  assert.match(source, /Winner of Match/);
  assert.match(source, /中国外卡/);
  assert.match(source, /players\.filter\(isConcretePlayer\)\.filter/);
});
