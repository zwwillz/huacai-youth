import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("player directory preloads nearby 512 portraits and detail data without slow-network overfetch", async () => {
  const directory = await readFile("app/snooker/players/player-directory.tsx", "utf8");
  const client = await readFile("app/snooker/players/player-detail-client.ts", "utf8");
  const inline = await readFile("app/snooker/players/player-detail-inline.tsx", "utf8");

  assert.match(directory, /IntersectionObserver/);
  assert.match(directory, /rootMargin: "420px 0px"/);
  assert.match(directory, /prefetchPlayerExperience\(player\.slug, player\.avatarUrl, priority\)/);
  assert.match(directory, /onPointerEnter=\{\(\) => warmHighPriority\(player\)\}/);
  assert.match(client, /connection\?\.saveData/);
  assert.match(client, /effectiveType === "slow-2g"/);
  assert.match(client, /effectiveType === "2g"/);
  assert.match(client, /Promise\.resolve\(\)/);
  assert.match(inline, /cached\?\.avatarUrl \?\? summary\?\.avatarUrl/);
  assert.match(inline, /preloadPlayerDetailAvatar\(candidate, "high"\)/);
  assert.match(inline, /setDisplayAvatarUrl\(candidate\)/);
});

test("player identity labels are positive persistent statuses rather than inferred non-tour text", async () => {
  const directory = await readFile("app/snooker/players/player-directory.tsx", "utf8");
  const domain = await readFile("lib/snooker/domain.ts", "utf8");
  const database = await readFile("lib/snooker/database-public.ts", "utf8");

  assert.match(domain, /"tour" \| "former_pro" \| "amateur" \| "unknown"/);
  assert.match(directory, /"巡回球员"/);
  assert.match(directory, /"前职业"/);
  assert.match(directory, /"业余球员"/);
  assert.doesNotMatch(directory, /非现役巡回赛/);
  assert.match(database, /player_status/);
  assert.match(database, /normalizePlayerStatus/);
});

test("event taxonomy separates event nature from qualification stage", async () => {
  const domain = await readFile("lib/snooker/domain.ts", "utf8");
  const taxonomy = await readFile("lib/snooker/taxonomy.ts", "utf8");
  const database = await readFile("lib/snooker/database-public.ts", "utf8");
  const app = await readFile("app/snooker/snooker-data-center-v2.tsx", "utf8");

  assert.match(domain, /"ranking" \| "invitational" \| "exhibition" \| "pro_qualifier"/);
  assert.match(domain, /"main" \| "qualifier" \| "finals"/);
  assert.match(taxonomy, /return "邀请赛"/);
  assert.match(taxonomy, /return "表演赛"/);
  assert.match(taxonomy, /return "选拔赛"/);
  assert.match(taxonomy, /return "资格赛"/);
  assert.match(taxonomy, /"排名赛 · 资格赛"/);
  assert.match(database, /event_type,event_stage,ranking_status/);
  assert.match(app, /item\.eventStage !== "qualifier"/);
  assert.match(app, /item\.eventType !== "pro_qualifier"/);
  assert.match(app, /eventDetailTypeLabel\(calendarEvent\)/);
});
