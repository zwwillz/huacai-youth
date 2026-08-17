import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");

test("V2 keeps player directory as a local main tab and routes only details to formal player pages", async () => {
  const [ui, directory, shell, page] = await Promise.all([
    read("app/snooker/snooker-data-center-v2.tsx"),
    read("app/snooker/players/player-directory.tsx"),
    read("app/snooker/players/player-shell.tsx"),
    read("app/snooker/page.tsx"),
  ]);

  assert.match(ui, /type MainView = "home" \| "matches" \| "players" \| "data"/);
  assert.match(ui, /activeView === "players" \? <PlayerDirectoryContent players=\{directoryPlayers\}/);
  assert.match(ui, /const href = target\?\.slug \? `\/snooker\/players\/\$\{target\.slug\}` : "\/snooker\?view=players"/);
  assert.match(ui, /router\.push\(href\)/);
  assert.doesNotMatch(ui, /router\.push\("\/snooker\/players"\)/);
  assert.doesNotMatch(ui, /if \(view === "players"\)/);
  assert.match(directory, /export function PlayerDirectoryContent/);
  assert.match(shell, /href: "\/snooker\?view=players"/);
  assert.match(page, /query\.view === "players"/);
  assert.doesNotMatch(ui, /type: "player"/);
});
