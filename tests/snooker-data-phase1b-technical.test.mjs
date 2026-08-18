import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const hub = readFileSync(new URL("../lib/snooker/technical-hub.ts", import.meta.url), "utf8");
const api = readFileSync(new URL("../app/api/snooker/v1/technical/route.ts", import.meta.url), "utf8");
const data = readFileSync(new URL("../app/snooker/data/data-ranking-content.tsx", import.meta.url), "utf8");
const technical = readFileSync(new URL("../app/snooker/data/data-technical-content.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/snooker/data/data.module.css", import.meta.url), "utf8");
const root = readFileSync(new URL("../app/snooker/snooker-data-center-v2.tsx", import.meta.url), "utf8");

test("phase 1b exposes the planned current-season technical metrics", () => {
  for (const key of ["centuries", "fifties", "win_rate", "shot_time", "highest_break", "maximums", "average_break", "matches_won", "points_scored"]) {
    assert.match(hub, new RegExp(`"${key}"`));
  }
  assert.match(hub, /key: "win_rate"[^\n]+minMatches: 5/);
  assert.match(hub, /key: "shot_time"[^\n]+minMatches: 5/);
  assert.match(hub, /key: "average_break"[^\n]+minMatches: 5/);
  assert.match(hub, /is_current_tour: "eq\.true"/);
  assert.match(hub, /previousValue !== null && item\.value === previousValue \? previousRank : index \+ 1/);
});

test("technical hub stays a focused read model and does not add match-detail reads", () => {
  assert.match(hub, /snooker_player_season_stats/);
  assert.match(hub, /snooker_players/);
  assert.doesNotMatch(hub, /snooker_frames/);
  assert.doesNotMatch(hub, /snooker_match_statistics/);
  assert.doesNotMatch(hub, /snooker_match_head_to_head/);
  assert.doesNotMatch(hub, /snooker_player_profile_details/);
});

test("technical data is loaded only when the Data Hub is mounted and is cached", () => {
  assert.match(data, /fetch\("\/api\/snooker\/v1\/technical"/);
  assert.match(data, /let technicalCache: SnookerTechnicalHub \| null = null/);
  assert.match(data, /let technicalInflight: Promise<SnookerTechnicalHub \| null> \| null = null/);
  assert.match(api, /s-maxage=300/);
  assert.match(api, /stale-while-revalidate=1800/);
  assert.doesNotMatch(root, /technical-hub/);
  assert.doesNotMatch(root, /TechnicalDetail/);
});

test("data home shows four season leaders and technical detail stays single-level", () => {
  assert.match(technical, /\["centuries", "win_rate", "shot_time", "maximums"\]/);
  assert.match(technical, /本赛季领跑者/);
  assert.match(technical, /查看完整技术榜/);
  assert.match(technical, /technicalMetricNav/);
  assert.doesNotMatch(technical, /搜索/);
  assert.doesNotMatch(technical, /技术分类/);
});

test("technical detail supports URL/back navigation and player drill-down without a new root controller", () => {
  assert.match(data, /url\.searchParams\.set\("section", "technical"\)/);
  assert.match(data, /url\.searchParams\.set\("metric", key\)/);
  assert.match(data, /window\.addEventListener\("popstate", syncTechnicalFromUrl\)/);
  assert.match(technical, /onOpenPlayer\(row\.playerSlug\)/);
  assert.match(technical, /TechnicalDetailOverlay/);
  assert.match(css, /\.technicalOverlay\{position:fixed;inset:0;z-index:120/);
  assert.doesNotMatch(root, /SnookerRootController/);
});

test("technical list exposes its statistical eligibility rules at the bottom", () => {
  assert.match(technical, /口径：至少完成 \{selected\.minMatches\} 场比赛/);
  assert.match(technical, /仅统计当前职业巡回赛球员/);
  assert.match(technical, /hub\.sourceName/);
  assert.match(hub, /WST 官方赛季统计/);
});
