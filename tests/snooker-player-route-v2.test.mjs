import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");

test("V2 keeps player directory and detail inside the root SnookerDataCenterV2 flow", async () => {
  const [ui, directory, detail, page] = await Promise.all([
    read("app/snooker/snooker-data-center-v2.tsx"),
    read("app/snooker/players/player-directory.tsx"),
    read("app/snooker/players/player-detail-content.tsx"),
    read("app/snooker/page.tsx"),
  ]);

  assert.match(ui, /type MainView = "home" \| "matches" \| "players" \| "data"/);
  assert.match(ui, /activeView === "players" \? <PlayerDirectoryContent players=\{directoryPlayers\}/);
  assert.match(ui, /\| \{ type: "player"; slug: string; returnView: MainView \}/);
  assert.match(ui, /searchParams\.set\("view", "players"\)/);
  assert.match(ui, /searchParams\.set\("player", target\.slug\)/);
  assert.match(ui, /history\.pushState/);
  assert.doesNotMatch(ui, /\/snooker\/players\//);
  assert.doesNotMatch(ui, /SnookerRootController/);
  assert.match(directory, /export function PlayerDirectoryContent/);
  assert.doesNotMatch(directory, /next\/link/);
  assert.match(detail, /export function PlayerDetailContent/);
  assert.doesNotMatch(detail, /PlayerShell/);
  assert.match(page, /query\.view === "players"/);
  assert.match(page, /player\?: string/);
});