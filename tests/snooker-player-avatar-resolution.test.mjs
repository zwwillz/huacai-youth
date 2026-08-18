import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("player directory keeps 256 WebP while both player detail paths upgrade to 512 WebP", async () => {
  const fallbackSource = await readFile("lib/snooker/player-data.ts", "utf8");
  const fastSource = await readFile("lib/snooker/player-detail-fast.ts", "utf8");

  assert.match(fallbackSource, /function detailAvatarUrl\(value: string \| null\)/);
  assert.match(fallbackSource, /value\.replace\("\/wst\/256\/", "\/wst\/512\/"\)/);
  assert.match(fallbackSource, /avatarUrl: detailAvatarUrl\(basePlayer\.avatarUrl\)/);
  assert.match(fallbackSource, /avatarUrl: row\.avatar_url/);

  assert.match(fastSource, /function detailAvatarUrl\(value: string \| null\)/);
  assert.match(fastSource, /value\.replace\("\/wst\/256\/", "\/wst\/512\/"\)/);
  assert.match(fastSource, /avatarUrl: detailAvatarUrl\(p\.avatar_url\)/);
});

test("player directory excludes draw placeholders before search and filters", async () => {
  const source = await readFile("app/snooker/players/player-directory.tsx", "utf8");

  assert.match(source, /function isConcretePlayer\(player: SnookerPlayerListItem\)/);
  assert.match(source, /China Wildcard/);
  assert.match(source, /Winner of Match/);
  assert.match(source, /中国外卡/);
  assert.match(source, /第\\d\+场胜者/);
  assert.match(source, /players\.filter\(isConcretePlayer\)\.filter/);
});
