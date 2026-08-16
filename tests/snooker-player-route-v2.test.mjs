import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");

test("V2 routes every player entry point to the formal Supabase player module", async () => {
  const ui = await read("app/snooker/snooker-data-center-v2.tsx");

  assert.match(ui, /import \{ useRouter \} from "next\/navigation"/);
  assert.match(ui, /const router = useRouter\(\)/);
  assert.match(ui, /const href = target\?\.slug \? `\/snooker\/players\/\$\{target\.slug\}` : "\/snooker\/players"/);
  assert.match(ui, /router\.push\(href\)/);
  assert.match(ui, /if \(view === "players"\) \{[\s\S]*?router\.prefetch\("\/snooker\/players"\);[\s\S]*?router\.push\("\/snooker\/players"\);[\s\S]*?return;/);
  assert.doesNotMatch(ui, /type: "player"/);
  assert.doesNotMatch(ui, /activeView === "players"/);
});
