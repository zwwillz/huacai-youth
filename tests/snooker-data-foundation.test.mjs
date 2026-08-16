import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("snooker snapshot contains complete 2026 China Open main stage", async () => {
  const eventSource = await read("lib/snooker/data/china-open-2026.ts");
  assert.equal((eventSource.match(/match\(\{/g) ?? []).length, 33);
  for (const round of ["final", "semifinals", "quarterfinals", "round-2", "round-1", "wild-card"]) {
    assert.match(eventSource, new RegExp(`key: "${round}"`));
  }
  assert.match(eventSource, /score1: 4, score2: 4/);
  assert.match(eventSource, /sessionTimesZh/);
  assert.match(eventSource, /frame\(7, 70, 68, 53, 57\)/);
  assert.match(eventSource, /sourceEventId: "2755"/);
});

test("2026-27 snooker calendar includes completed current and upcoming event types", async () => {
  const calendarSource = await read("lib/snooker/data/calendar.ts");
  assert.match(calendarSource, /2026斯诺克上海大师赛/);
  assert.match(calendarSource, /2026斯诺克中国公开赛/);
  assert.match(calendarSource, /2026斯诺克武汉公开赛/);
  assert.match(calendarSource, /typeZh: "非排名赛"/);
  assert.match(calendarSource, /typeZh: "排名赛"/);
  assert.match(calendarSource, /typeZh: "资格赛"/);
  assert.match(calendarSource, /current: true/);
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
  assert.match(playersSource, /Zhao_Xintong_at_the_World_Snooker_Green_Carpet_Ceremony_2026/);
  assert.match(playersSource, /Mark_Selby\.JPG/);
});

test("snooker public snapshot keeps avatar metadata but serves lightweight letter avatars", async () => {
  const [foundationSource, uiSource] = await Promise.all([
    read("lib/snooker/foundation.ts"),
    read("app/snooker/snooker-data-center.tsx"),
  ]);
  assert.match(foundationSource, /publicSnookerPlayers = snookerPlayers\.map\(\(player\) => \(\{ \.\.\.player, avatar: undefined \}\)\)/);
  assert.match(foundationSource, /players: publicSnookerPlayers/);
  assert.match(uiSource, /initials\(player\.nameEn\)/);
});

test("snooker mobile IA is event list to event detail to match centre", async () => {
  const [pageSource, cacheSource, uiSource, priorityCss] = await Promise.all([
    read("app/snooker/page.tsx"),
    read("lib/snooker/live-dashboard-cache.ts"),
    read("app/snooker/snooker-data-center.tsx"),
    read("app/snooker/snooker-priority.module.css"),
  ]);
  assert.match(pageSource, /getCachedDashboardWithLiveOverlay/);
  assert.match(cacheSource, /getDashboardWithLiveOverlay/);
  assert.match(cacheSource, /inflight/);
  assert.match(cacheSource, /DEFAULT_TTL_MS = 10_000/);
  assert.match(cacheSource, /IDLE_TTL_MS = 30_000/);
  assert.match(cacheSource, /hasActiveMatch/);
  assert.match(pageSource, /initialSourceHealth=\{sourceHealth\}/);
  assert.match(pageSource, /dynamic = "force-dynamic"/);
  assert.match(uiSource, /label: "赛事"/);
  assert.match(uiSource, /近期赛事/);
  assert.match(uiSource, /赛季赛历/);
  assert.match(uiSource, /查看赛事/);
  assert.doesNotMatch(uiSource, /进入赛事中心/);
  assert.match(uiSource, /calendarEvent\.nameZh/);
  assert.match(uiSource, /赛事介绍/);
  assert.match(uiSource, />赛程</);
  assert.match(uiSource, /赛事数据/);
  assert.match(uiSource, /比赛详情/);
  assert.match(uiSource, /查看完整比分与逐局数据/);
  assert.match(uiSource, /单杆<br \/>\(50\+\)/);
  assert.match(uiSource, /<b>局<\/b>/);
  assert.match(uiSource, /15_000/);
  assert.match(uiSource, /visibilitychange/);
  assert.match(uiSource, /最近更新/);
  assert.match(uiSource, /matchRealtimeSignature/);
  assert.match(uiSource, /matchSignatureMap/);
  assert.match(uiSource, /matchUpdatedAt/);
  assert.match(uiSource, /changedMatchIds/);
  assert.match(uiSource, /const matchUpdateTime = new Date\(matchUpdatedAt\[match\.id\]/);
  assert.match(uiSource, /const isRealtimeMatch = match\.status === "live" \|\| match\.status === "session-break"/);
  assert.match(uiSource, /match\.frames\?\.length \? match\.frames\.map/);
  assert.match(uiSource, /isRealtimeMatch \? <small>/);
  assert.match(uiSource, /isRealtimeMatch \? \(/);
  assert.match(uiSource, /中国球员/);
  assert.match(priorityCss, /matchVersusRow/);
  assert.match(priorityCss, /grid-template-columns:minmax\(0,1fr\) auto minmax\(0,1fr\)/);
});

test("player main view stays a directory and detail opens on click", async () => {
  const uiSource = await read("app/snooker/snooker-data-center.tsx");
  assert.match(uiSource, /球员页只保留目录与搜索/);
  assert.match(uiSource, /搜索中文名 \/ 英文名/);
  assert.match(uiSource, /openPlayer\(player\.id\)/);
  assert.match(uiSource, /球员详情/);
  assert.doesNotMatch(uiSource, /useState\("p-zhao-xintong"\)/);
});

test("snooker realtime overlay uses WST official REST and GraphQL data", async () => {
  const [overlaySource, wstSource, dashboardSource, cacheSource] = await Promise.all([
    read("lib/snooker/live-overlay.ts"),
    read("lib/snooker/wst-source.ts"),
    read("app/api/snooker/v1/dashboard/route.ts"),
    read("lib/snooker/live-dashboard-cache.ts"),
  ]);
  assert.match(wstSource, /tournaments\.snooker\.web\.gc\.wstservices\.co\.uk\/v2/);
  assert.match(wstSource, /matches\.snooker\.web\.gc\.wstservices\.co\.uk\/v2/);
  assert.match(wstSource, /snooker\.graph\.gc\.wstservices\.co\.uk\/graphql/);
  assert.match(wstSource, /matchStatus\(matchId: \$matchId\)/);
  assert.match(wstSource, /homePlayerFiftyPlusBreaks/);
  assert.match(wstSource, /matchHistory/);
  assert.match(wstSource, /normalizeMatchRow/);
  assert.match(wstSource, /cache: "no-store"/);
  assert.match(overlaySource, /fetchWstTournament/);
  assert.match(overlaySource, /fetchWstMatchStatus/);
  assert.match(overlaySource, /result\.matched >= 30/);
  assert.match(overlaySource, /const activeLinks = \[\.\.\.result\.linked\.values\(\)\]\.filter/);
  assert.match(overlaySource, /Promise\.allSettled/);
  assert.match(overlaySource, /activeLinks\.map/);
  assert.match(overlaySource, /overlayGraphStatus/);
  assert.match(overlaySource, /const rows = status\.matchHistory\?\.frames \?\? \[\]/);
  assert.match(overlaySource, /if \(frames\.length\) match\.frames = frames/);
  assert.match(overlaySource, /source: "WST"/);
  assert.match(overlaySource, /structuredClone\(dashboardSnapshot\)/);
  assert.doesNotMatch(overlaySource, /snooker\.org/);
  assert.match(cacheSource, /getDashboardWithLiveOverlay/);
  assert.match(dashboardSource, /getCachedDashboardWithLiveOverlay/);
  assert.match(dashboardSource, /dynamic = "force-dynamic"/);
  assert.match(dashboardSource, /revalidate = 0/);
  assert.match(dashboardSource, /Cache-Control/);
});

test("snooker independent database schema stays separate from Huacai tables", async () => {
  const schema = await read("lib/snooker/schema.sql");
  for (const table of ["snooker_players", "snooker_events", "snooker_rounds", "snooker_matches", "snooker_frames", "snooker_ranking_snapshots", "snooker_source_entity_map", "snooker_sync_runs"]) {
    assert.match(schema, new RegExp(`create table if not exists ${table}`));
  }
  assert.doesNotMatch(schema, /event_registrations|admin_users|event_groups/);
});
