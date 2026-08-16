import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("snooker snapshot contains complete 2026 China Open main stage", async () => {
  const [eventSource, foundationSource] = await Promise.all([
    read("lib/snooker/data/china-open-2026.ts"),
    read("lib/snooker/foundation.ts"),
  ]);
  assert.equal((eventSource.match(/match\(\{/g) ?? []).length, 33);
  for (const round of ["final", "semifinals", "quarterfinals", "round-2", "round-1", "wild-card"]) assert.match(eventSource, new RegExp(`key: "${round}"`));
  assert.match(eventSource, /sessionTimesZh/);
  assert.match(eventSource, /frame\(7, 70, 68, 53, 57\)/);
  assert.match(eventSource, /sourceEventId: "2755"/);
  assert.match(foundationSource, /chinaOpenFinal\.score1 = 10/);
  assert.match(foundationSource, /chinaOpenFinal\.score2 = 6/);
  assert.match(foundationSource, /chinaOpenFinal\.status = "completed"/);
  assert.match(foundationSource, /frameNo: 16, score1: 79, score2: 27, break1: 57/);
});

test("snooker player master covers every China Open participant", async () => {
  const [eventSource, playersSource] = await Promise.all([
    read("lib/snooker/data/china-open-2026.ts"),
    read("lib/snooker/data/players.ts"),
  ]);
  const referenced = new Set([...eventSource.matchAll(/p[12]:\s*"([^"]+)"/g)].map((match) => match[1]));
  const available = new Set([...playersSource.matchAll(/slug:\s*"([^"]+)"/g)].map((match) => match[1]));
  assert.equal(referenced.size, 34);
  assert.deepEqual([...referenced].filter((slug) => !available.has(slug)), []);
});

test("snooker public UI serves lightweight letter avatars", async () => {
  const uiSource = await read("app/snooker/snooker-data-center.tsx");
  assert.match(uiSource, /initials\(player\.nameEn\)/);
  assert.doesNotMatch(uiSource, /backgroundImage:/);
});

test("snooker frontend is database-first and only live matches poll every 30 seconds", async () => {
  const [pageSource, dashboardSource, dbSource, uiSource, priorityCss] = await Promise.all([
    read("app/snooker/page.tsx"),
    read("app/api/snooker/v1/dashboard/route.ts"),
    read("lib/snooker/database-public.ts"),
    read("app/snooker/snooker-data-center.tsx"),
    read("app/snooker/snooker-priority.module.css"),
  ]);
  assert.match(pageSource, /loadSnookerDatabaseView/);
  assert.match(pageSource, /initialDatabaseEvents=\{database\.eventDetails\}/);
  assert.doesNotMatch(pageSource, /getCachedDashboardWithLiveOverlay/);
  assert.match(pageSource, /dynamic = "force-dynamic"/);
  assert.match(dbSource, /rtlvncsmbueatdzqvhbn\.supabase\.co/);
  assert.match(dbSource, /snooker_events\?select=/);
  assert.match(dbSource, /snooker_matches\?select=/);
  assert.match(dbSource, /snooker_frames\?select=/);
  assert.match(dbSource, /data_ready/);
  assert.match(dashboardSource, /loadSnookerDatabaseView/);
  assert.match(dashboardSource, /searchParams\.has\("monitor"\)/);
  assert.match(dashboardSource, /getCachedDashboardWithLiveOverlay/);
  assert.match(dashboardSource, /databaseEvents: database\.eventDetails/);
  assert.match(uiSource, /if \(!hasLiveMatch\) return/);
  assert.match(uiSource, /setInterval\(\(\) => void refresh\(\), 30_000\)/);
  assert.doesNotMatch(uiSource, /15_000/);
  assert.match(uiSource, /30秒自动同步/);
  assert.match(uiSource, /visibilitychange/);
  assert.match(uiSource, /label: "赛事"/);
  assert.match(uiSource, /近期赛事/);
  assert.match(uiSource, /赛季赛历/);
  assert.match(uiSource, /比赛详情/);
  assert.match(uiSource, /单杆<br \/>\(50\+\)/);
  assert.match(uiSource, /<b>局<\/b>/);
  assert.match(priorityCss, /matchVersusRow/);
  assert.match(priorityCss, /grid-template-columns:minmax\(0,1fr\) auto minmax\(0,1fr\)/);
});

test("snooker event lifecycle keeps a finished event featured for one day then advances", async () => {
  const uiSource = await read("app/snooker/snooker-data-center.tsx");
  assert.match(uiSource, /addDateDays\(item\.endDate, 1\) === today/);
  assert.match(uiSource, /activeEventCard \?\? graceEventCard \?\? firstUpcomingMain/);
  assert.match(uiSource, /featuredLabel = activeEventCard/);
  assert.match(uiSource, /"刚刚结束"/);
  assert.match(uiSource, /nextEventCard = featuredEventCard/);
});

test("recent events include season history and one upcoming event instead of only two cards", async () => {
  const uiSource = await read("app/snooker/snooker-data-center.tsx");
  assert.match(uiSource, /const recentEvents = useMemo/);
  assert.match(uiSource, /item\.endDate < today \|\| isActiveOn\(item, today\) \|\| item\.id === firstUpcomingAny\?\.id/);
  assert.doesNotMatch(uiSource, /recentSecondaryEvents/);
  assert.match(uiSource, /近期赛事显示本赛季所有已经结束的赛事/);
  assert.match(uiSource, /recentEvents\.map/);
});

test("database-backed completed events can open their own schedules and matches", async () => {
  const [uiSource, dbSource] = await Promise.all([
    read("app/snooker/snooker-data-center.tsx"),
    read("lib/snooker/database-public.ts"),
  ]);
  assert.match(uiSource, /eventDetailsBySlug/);
  assert.match(uiSource, /eventDetailsBySlug\.get\(calendarEvent\.slug\)/);
  assert.match(uiSource, /detailEvent\.rounds\.map/);
  assert.match(uiSource, /openMatch\(match\.id, detailEvent\.slug\)/);
  assert.match(uiSource, /WST 当前未返回该场历史逐局数据，已保存官方总比分/);
  assert.match(dbSource, /eventDetails/);
  assert.match(dbSource, /buildEventDetails/);
});

test("home result card marks the winner and persists until the next event begins", async () => {
  const uiSource = await read("app/snooker/snooker-data-center.tsx");
  assert.match(uiSource, /scoreEvent = activeDetail \?\?/);
  assert.match(uiSource, /!activeEventCard \? latestCompletedDetail/);
  assert.match(uiSource, /scoreMatch\.winnerId === scoreMatch\.player1Id \? <em>胜<\/em>/);
  assert.match(uiSource, /scoreMatch\.winnerId === scoreMatch\.player2Id \? <em>胜<\/em>/);
  assert.match(uiSource, /官方结果已入库/);
});

test("player main view stays a directory and detail opens on click", async () => {
  const uiSource = await read("app/snooker/snooker-data-center.tsx");
  assert.match(uiSource, /球员页只保留目录与搜索/);
  assert.match(uiSource, /搜索中文名 \/ 英文名/);
  assert.match(uiSource, /openPlayer\(player\.id\)/);
  assert.match(uiSource, /球员详情/);
  assert.doesNotMatch(uiSource, /useState\("p-zhao-xintong"\)/);
});

test("snooker realtime upstream monitor only requests Match Centre for active matches", async () => {
  const [overlaySource, wstSource, dashboardSource, cacheSource] = await Promise.all([
    read("lib/snooker/live-overlay.ts"),
    read("lib/snooker/wst-source.ts"),
    read("app/api/snooker/v1/dashboard/route.ts"),
    read("lib/snooker/live-dashboard-cache.ts"),
  ]);
  assert.match(wstSource, /tournaments\.snooker\.web\.gc\.wstservices\.co\.uk\/v2/);
  assert.match(wstSource, /snooker\.graph\.gc\.wstservices\.co\.uk\/graphql/);
  assert.match(wstSource, /matchStatus\(matchId: \$matchId\)/);
  assert.match(overlaySource, /fetchWstTournament/);
  assert.match(overlaySource, /fetchWstMatchStatus/);
  assert.match(overlaySource, /const activeLinks = \[\.\.\.result\.linked\.values\(\)\]\.filter/);
  assert.match(overlaySource, /Promise\.allSettled/);
  assert.match(overlaySource, /pollingSeconds: 30/);
  assert.match(overlaySource, /Completed matches are never fetched from Match Centre/);
  assert.match(cacheSource, /DEFAULT_TTL_MS = 30_000/);
  assert.match(cacheSource, /IDLE_TTL_MS = 30 \* 60_000/);
  assert.match(dashboardSource, /searchParams\.has\("monitor"\)/);
});

test("snooker dedicated database migration includes localization breaks overrides and adaptive policies", async () => {
  const [schema, foundationMigration, policyMigration] = await Promise.all([
    read("lib/snooker/schema.sql"),
    read("lib/snooker/migrations/20260816_extend_snooker_data_foundation.sql"),
    read("lib/snooker/migrations/20260816_adaptive_sync_policy.sql"),
  ]);
  for (const table of ["snooker_players", "snooker_events", "snooker_rounds", "snooker_matches", "snooker_frames", "snooker_ranking_snapshots", "snooker_source_entity_map", "snooker_sync_runs"]) assert.match(schema, new RegExp(`create table if not exists ${table}`));
  for (const table of ["snooker_player_names", "snooker_breaks", "snooker_manual_overrides"]) assert.match(foundationMigration, new RegExp(`create table if not exists public\\.${table}`));
  assert.match(policyMigration, /create table if not exists public\.snooker_sync_policies/);
  assert.match(policyMigration, /'live_match_status',true,30/);
  assert.match(policyMigration, /'rankings',true,86400/);
  assert.match(policyMigration, /'site_monitor',true,120/);
  assert.match(policyMigration, /realtime_finalized_at/);
  assert.doesNotMatch(schema, /event_registrations|admin_users|event_groups/);
});
