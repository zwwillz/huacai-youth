import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");

const dashboardRoute = read("app/api/snooker/v1/dashboard/route.ts");
const eventDetailRoute = read("app/api/snooker/v1/event-detail/route.ts");
const page = read("app/snooker/page.tsx");
const client = read("app/snooker/snooker-data-center-v2.tsx");
const fallback = read("app/snooker/snooker-data-unavailable.tsx");
const dashboardLoader = read("lib/snooker/dashboard-public.ts");
const eventLoader = read("lib/snooker/event-public.ts");

test("production dashboard never returns the old static business snapshot on database failure", () => {
  assert.match(dashboardRoute, /status:\s*503/);
  assert.match(dashboardRoute, /dataState:\s*"unavailable"/);
  assert.doesNotMatch(dashboardRoute, /verified-snapshot-fallback/);
  assert.doesNotMatch(page, /loadSnookerDatabaseViewV2/);
  assert.doesNotMatch(dashboardLoader, /dashboardSnapshot/);
});

test("cold fallback is a system status page without stale snooker business data", () => {
  assert.match(fallback, /数据服务暂时不可用/);
  assert.match(fallback, /页面不会使用过期赛事、排名或球员快照/);
  assert.doesNotMatch(fallback, /武汉公开赛|中国公开赛|世界排名第|Judd Trump|Ronnie/);
});

test("client keeps last-known-good data and rejects older dashboard payloads", () => {
  assert.match(client, /scope=core/);
  assert.match(client, /versionTime\(incomingVersion\) < versionTime\(dataVersion\.current\)/);
  assert.match(client, /继续显示上一版成功数据/);
  assert.doesNotMatch(client, /setSnapshot\(dashboardSnapshot\)/);
});

test("homepage core excludes season-wide rich match hydration", () => {
  const coreStart = dashboardLoader.indexOf("async function loadFreshCoreBuild");
  const workspaceStart = dashboardLoader.indexOf("export async function loadSnookerDashboardWorkspace");
  assert.ok(coreStart >= 0 && workspaceStart > coreStart);
  const coreSection = dashboardLoader.slice(coreStart, workspaceStart);
  assert.doesNotMatch(coreSection, /snooker_frames\?select/);
  assert.doesNotMatch(coreSection, /snooker_match_statistics\?select/);
  assert.doesNotMatch(coreSection, /snooker_match_head_to_head\?select/);
  assert.match(coreSection, /snooker_player_season_stats/);
  assert.match(coreSection, /snooker_latest_rankings/);
});

test("event rich data is loaded on demand with bounded batching", () => {
  assert.match(eventDetailRoute, /loadSnookerEventPublic/);
  assert.match(client, /\/api\/snooker\/v1\/event-detail\?slug=/);
  assert.match(client, /void loadEventDetail\(slug\)/);
  assert.match(client, /正在加载逐局比分与对阵数据/);
  assert.match(client, /eventDetailRequestIds/);
  assert.match(client, /const requestId = Symbol\(slug\)/);
  assert.match(eventLoader, /const BATCH_SIZE = 64/);
  assert.match(eventLoader, /const CONCURRENCY = 3/);
  assert.match(eventLoader, /limit=\$\{PAGE_SIZE\}&offset=\$\{offset\}/);
});

test("core refresh preserves already-loaded rich event fields", () => {
  assert.match(client, /function enrichCoreEvent/);
  assert.match(client, /richMatch\.frames/);
  assert.match(client, /richMatch\.statistics/);
  assert.match(client, /richMatch\.headToHead/);
  assert.match(client, /mergeCoreEvents\(current, data\.databaseEvents/);
});

test("player summaries and player detail share the database avatar field", () => {
  assert.match(dashboardLoader, /avatar_url/);
  assert.match(dashboardLoader, /avatarUrl:\s*row\.avatar_url/);
  assert.doesNotMatch(dashboardLoader, /avatar:\s*undefined/);
});
