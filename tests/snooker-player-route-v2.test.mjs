import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");

test("V2 routes all player entry points to the formal Supabase player module", async () => {
  const ui = await read("app/snooker/snooker-data-center-v2.tsx");

  assert.match(ui, /import \{ useRouter \} from "next\/navigation"/);
  assert.match(ui, /const router = useRouter\(\)/);
  assert.match(ui, /router\.push\(target\?\.slug \? `\/snooker\/players\/\$\{target\.slug\}` : "\/snooker\/players"\)/);
  assert.match(ui, /if \(view === "players"\) \{[\s\S]*?router\.push\("\/snooker\/players"\);[\s\S]*?return;/);
  assert.doesNotMatch(ui, /const openPlayer = \(playerId: string\) => \{ setDetail\(\{ type: "player", playerId \}\)/);
});
