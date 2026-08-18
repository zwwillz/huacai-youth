import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("player directory keeps 256 WebP while player detail upgrades to 512 WebP", async () => {
  const source = await readFile("lib/snooker/player-data.ts", "utf8");

  assert.match(source, /function detailAvatarUrl\(value: string \| null\)/);
  assert.match(source, /value\.replace\("\/wst\/256\/", "\/wst\/512\/"\)/);
  assert.match(source, /avatarUrl: detailAvatarUrl\(basePlayer\.avatarUrl\)/);
  assert.match(source, /avatarUrl: row\.avatar_url/);
});
