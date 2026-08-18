import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const hub = readFileSync(new URL("../lib/snooker/honours-hub.ts", import.meta.url), "utf8");
const api = readFileSync(new URL("../app/api/snooker/v1/honours/route.ts", import.meta.url), "utf8");
const data = readFileSync(new URL("../app/snooker/data/data-ranking-content.tsx", import.meta.url), "utf8");
const honours = readFileSync(new URL("../app/snooker/data/data-honours-content.tsx", import.meta.url), "utf8");
const root = readFileSync(new URL("../app/snooker/snooker-data-center-v2.tsx", import.meta.url), "utf8");

test("phase 1c exposes the planned career honours metrics", () => {
  for (const key of ["ranking_titles", "triple_crown_titles", "world_championship_titles", "uk_championship_titles", "masters_titles", "ranking_finals", "career_147s"]) {
    assert.match(hub, new RegExp(`"${key}"`));
  }
  assert.match(hub, /snooker_player_career_stats/);
  assert.match(hub, /hide_stats: "eq\.false"/);
  assert.match(hub, /previousValue !== null && item\.value === previousValue \? previousRank : index \+ 1/);
});

test("honours hub is future-proof for former players and stays a focused read model", () => {
  assert.match(hub, /snooker_players/);
  assert.doesNotMatch(hub, /is_current_tour: "eq\.true"/);
  assert.doesNotMatch(hub, /snooker_frames/);
  assert.doesNotMatch(hub, /snooker_match_statistics/);
  assert.doesNotMatch(hub, /snooker_match_head_to_head/);
  assert.doesNotMatch(hub, /snooker_player_profile_details/);
});

test("honours data is loaded on the Data Hub only and uses independent caching", () => {
  assert.match(data, /fetch\("\/api\/snooker\/v1\/honours"/);
  assert.match(data, /let honoursCache: SnookerHonoursHub \| null = null/);
  assert.match(data, /let honoursInflight: Promise<SnookerHonoursHub \| null> \| null = null/);
  assert.match(api, /s-maxage=1800/);
  assert.match(api, /stale-while-revalidate=21600/);
  assert.doesNotMatch(root, /honours-hub/);
  assert.doesNotMatch(root, /HonoursDetail/);
});

test("data home shows four planned honours leaders and a single-level full leaderboard", () => {
  assert.match(honours, /\["ranking_titles", "triple_crown_titles", "world_championship_titles", "career_147s"\]/);
  assert.match(honours, /<h2>荣誉榜<\/h2>/);
  assert.match(honours, /查看完整荣誉榜/);
  assert.match(honours, /荣誉榜指标/);
  assert.doesNotMatch(honours, /搜索/);
  assert.doesNotMatch(honours, /荣誉分类/);
});

test("honours detail supports URL and back navigation plus player drill-down", () => {
  assert.match(data, /url\.searchParams\.set\("section", "honours"\)/);
  assert.match(data, /url\.searchParams\.set\("honour", key\)/);
  assert.match(data, /window\.addEventListener\("popstate", syncHonoursFromUrl\)/);
  assert.match(honours, /onOpenPlayer\(row\.playerSlug\)/);
  assert.match(honours, /HonoursDetailOverlay/);
  assert.doesNotMatch(root, /SnookerRootController/);
});

test("honours UI states the current database scope instead of claiming a complete historical archive", () => {
  assert.match(honours, /本站已入库职业生涯统计/);
  assert.match(honours, /hub\.sourceName/);
  assert.match(hub, /WST 职业生涯统计/);
});
