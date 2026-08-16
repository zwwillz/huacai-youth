import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("database v2 loads event prizes match statistics season comparison and head to head", async () => {
  const [domain, loader] = await Promise.all([
    read("lib/snooker/domain.ts"),
    read("lib/snooker/database-public-v2.ts"),
  ]);
  assert.match(domain, /SnookerPrizeRow/);
  assert.match(domain, /SnookerMatchPlayerStatistics/);
  assert.match(domain, /SnookerSeasonStatistics/);
  assert.match(domain, /SnookerHeadToHead/);
  assert.match(loader, /snooker_event_prizes/);
  assert.match(loader, /snooker_match_statistics/);
  assert.match(loader, /snooker_player_season_stats/);
  assert.match(loader, /snooker_match_head_to_head/);
  assert.match(loader, /previous_champion_name_zh/);
  assert.match(loader, /expected_match_count/);
  assert.match(loader, /schedulePartial/);
});

test("event overview renders current champion previous champion and prize table only when data exists", async () => {
  const ui = await read("app/snooker/snooker-data-center-v2.tsx");
  assert.match(ui, /CHAMPION · 本届冠军/);
  assert.match(ui, /上届冠军/);
  assert.match(ui, /TOURNAMENT OVERVIEW/);
  assert.match(ui, /PRIZE MONEY/);
  assert.match(ui, /奖金分配/);
  assert.match(ui, /full\?\.prizes\?\.length \?/);
  assert.match(ui, /总奖金/);
  assert.match(ui, /money\(totalPrize\.amount\)/);
});

test("match detail switches stored match season and historical head to head data", async () => {
  const ui = await read("app/snooker/snooker-data-center-v2.tsx");
  assert.match(ui, />本场<\/span><small>MATCH<\/small>/);
  assert.match(ui, />赛季<\/span><small>SEASON<\/small>/);
  assert.match(ui, />交手<\/span><small>H2H<\/small>/);
  assert.match(ui, /本场比赛统计/);
  assert.match(ui, /赛季数据对比/);
  assert.match(ui, /历史对阵/);
  assert.match(ui, /总得分/);
  assert.match(ui, /平均出杆/);
  assert.match(ui, /进球成功率/);
  assert.match(ui, /\["50\+", "breaks50Plus"/);
  assert.match(ui, /最高单杆/);
  assert.match(ui, /历史局分/);
  assert.match(ui, /recentMeetings\.map/);
  assert.doesNotMatch(ui, /styles\.detailInfoCard/);
});

test("Wuhan partial schedule is database backed and public copy is source-neutral", async () => {
  const [ui, loader] = await Promise.all([
    read("app/snooker/snooker-data-center-v2.tsx"),
    read("lib/snooker/database-public-v2.ts"),
  ]);
  assert.match(ui, /部分赛程/);
  assert.match(ui, /官方当前已公布/);
  assert.match(ui, /后续签表将随官方发布自动补齐/);
  assert.doesNotMatch(ui, /WST 当前已公布/);
  assert.match(loader, /publishedMatchCount/);
  assert.match(loader, /publishedMatchCount < expected/);
});

test("root and dashboard use enriched database view while upstream monitor remains separate", async () => {
  const [page, route] = await Promise.all([
    read("app/snooker/page.tsx"),
    read("app/api/snooker/v1/dashboard/route.ts"),
  ]);
  assert.match(page, /loadSnookerDatabaseViewV2/);
  assert.match(page, /SnookerDataCenterV2/);
  assert.match(route, /loadSnookerDatabaseViewV2/);
  assert.match(route, /searchParams\.has\("monitor"\)/);
  assert.match(route, /pollingSeconds: liveMatches\.length \? 30 : 0/);
});
