import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");

test("V2 keeps player directory and detail inside the root player tab", async () => {
  const [ui, directory, shell, page, controller, legacyDirectory, legacyDetail] = await Promise.all([
    read("app/snooker/snooker-data-center-v2.tsx"),
    read("app/snooker/players/player-directory.tsx"),
    read("app/snooker/players/player-shell.tsx"),
    read("app/snooker/page.tsx"),
    read("app/snooker/snooker-root-controller.tsx"),
    read("app/snooker/players/page.tsx"),
    read("app/snooker/players/[slug]/page.tsx"),
  ]);

  assert.match(ui, /type MainView = "home" \| "matches" \| "players" \| "data"/);
  assert.match(ui, /activeView === "players" \? <PlayerDirectoryContent players=\{directoryPlayers\}/);
  assert.match(directory, /\/snooker\?view=players&player=/);
  assert.match(directory, /snooker:open-player/);
  assert.match(shell, /href: "\/snooker\?view=players"/);
  assert.match(page, /query\.player\?\.trim\(\)/);
  assert.match(page, /initialPlayerSlug=\{requestedPlayer\}/);
  assert.match(controller, /rootHref\("players", slug\)/);
  assert.match(controller, /window\.history\.pushState/);
  assert.match(legacyDirectory, /redirect\("\/snooker\?view=players"\)/);
  assert.match(legacyDetail, /redirect\(`\/snooker\?view=players&player=/);
});
