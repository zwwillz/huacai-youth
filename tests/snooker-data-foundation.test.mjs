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
  assert.match(eventSource, /sourceEventId: "2755"/);
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
  assert.match(playersSource, /Noppon_Saengkham_2025/);
});

test("snooker UI renders complete event from initial snapshot", async () => {
  const [pageSource, uiSource] = await Promise.all([
    read("app/snooker/page.tsx"),
    read("app/snooker/snooker-data-center.tsx"),
  ]);
  assert.match(pageSource, /initialSnapshot=\{snapshot\}/);
  assert.match(uiSource, /中国公开赛完整数据已接入/);
  assert.match(uiSource, /title="完整主赛"/);
  assert.match(uiSource, /event\.rounds\.map/);
  assert.match(uiSource, /本站 34/);
});

test("snooker live overlay validates source completeness before replacing snapshot", async () => {
  const [overlaySource, dashboardSource] = await Promise.all([
    read("lib/snooker/live-overlay.ts"),
    read("app/api/snooker/v1/dashboard/route.ts"),
  ]);
  assert.match(overlaySource, /parsed\.rounds\.length >= 6/);
  assert.match(overlaySource, /parsed\.matches\.length >= 30/);
  assert.match(overlaySource, /snapshot: dashboardSnapshot/);
  assert.match(dashboardSource, /verified-snapshot \+ live-overlay/);
});

test("snooker independent database schema stays separate from Huacai tables", async () => {
  const schema = await read("lib/snooker/schema.sql");
  for (const table of ["snooker_players", "snooker_events", "snooker_rounds", "snooker_matches", "snooker_frames", "snooker_ranking_snapshots", "snooker_source_entity_map", "snooker_sync_runs"]) {
    assert.match(schema, new RegExp(`create table if not exists ${table}`));
  }
  assert.doesNotMatch(schema, /event_registrations|admin_users|event_groups/);
});
