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

test("snooker mobile IA is calendar to event centre to match centre", async () => {
  const [pageSource, uiSource] = await Promise.all([
    read("app/snooker/page.tsx"),
    read("app/snooker/snooker-data-center.tsx"),
  ]);
  assert.match(pageSource, /initialSnapshot=\{snapshot\}/);
  assert.match(uiSource, /比赛 · 赛历/);
  assert.match(uiSource, /赛事介绍/);
  assert.match(uiSource, />赛程</);
  assert.match(uiSource, /赛事数据/);
  assert.match(uiSource, /比赛详情/);
  assert.match(uiSource, /查看完整比分与逐局数据/);
  assert.match(uiSource, /单杆<br \/>\(50\+\)/);
  assert.match(uiSource, /15_000/);
  assert.match(uiSource, /visibilitychange/);
  assert.match(uiSource, /中国球员/);
});

test("player main view stays a directory and detail opens on click", async () => {
  const uiSource = await read("app/snooker/snooker-data-center.tsx");
  assert.match(uiSource, /球员页只保留目录与搜索/);
  assert.match(uiSource, /搜索中文名 \/ 英文名/);
  assert.match(uiSource, /openPlayer\(player\.id\)/);
  assert.match(uiSource, /球员详情/);
  assert.doesNotMatch(uiSource, /useState\("p-zhao-xintong"\)/);
});

test("snooker live overlay bypasses cache and protects the verified snapshot", async () => {
  const [overlaySource, dashboardSource] = await Promise.all([
    read("lib/snooker/live-overlay.ts"),
    read("app/api/snooker/v1/dashboard/route.ts"),
  ]);
  assert.match(overlaySource, /template=21/);
  assert.match(overlaySource, /cache: "no-store"/);
  assert.match(overlaySource, /parsed\.rounds\.length >= 6/);
  assert.match(overlaySource, /parsed\.matches\.length >= 30/);
  assert.match(overlaySource, /structuredClone\(dashboardSnapshot\)/);
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
