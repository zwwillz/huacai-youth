import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = readFileSync(new URL("../app/snooker/snooker-data-center-v2.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/snooker/page.tsx", import.meta.url), "utf8");
const hub = readFileSync(new URL("../lib/snooker/ranking-hub.ts", import.meta.url), "utf8");
const data = readFileSync(new URL("../app/snooker/data/data-ranking-content.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/snooker/data/data.module.css", import.meta.url), "utf8");

test("data phase 1a loads the four current ranking lists as one root data module", () => {
  assert.match(hub, /world_official/);
  assert.match(hub, /one_year/);
  assert.match(hub, /provisional_seeding/);
  assert.match(hub, /provisional_eos/);
  assert.match(hub, /snooker_latest_rankings/);
  assert.match(hub, /next: \{ revalidate \}/);
  assert.match(page, /loadSnookerRankingHub\(\)/);
  assert.match(root, /initialRankingHub: SnookerRankingHub/);
});

test("ranking rows stay available when optional mapping or metadata reads fail", () => {
  assert.match(hub, /Promise\.allSettled/);
  assert.match(hub, /if \(rankingResult\.status !== "fulfilled"\) throw rankingResult\.reason/);
  assert.match(hub, /playerResult\.status === "fulfilled" \? playerResult\.value : \[\]/);
  assert.match(hub, /metaResult\.status === "fulfilled" \? metaResult\.value : \[\]/);
  assert.match(hub, /sourcePlayerName: row\.source_player_name \?\? ""/);
});

test("data view keeps the existing root shell and opens rankings as a root detail state", () => {
  assert.match(root, /\{ type: "ranking"; section: SnookerRankingSection; key: SnookerCurrentRankingKey \}/);
  assert.match(root, /<DataHubContent hub=\{initialRankingHub\}/);
  assert.match(root, /<RankingDetailContent/);
  assert.match(root, /url\.searchParams\.set\("section", "rankings"\)/);
  assert.match(root, /url\.searchParams\.set\("list", key\)/);
  assert.match(page, /query\.section === "rankings"/);
  assert.doesNotMatch(root, /SnookerRootController/);
});

test("ranking hub keeps explanations behind an inline information modal", () => {
  assert.match(data, /className=\{styles\.infoButton\}/);
  assert.match(data, /RankingInfoModal/);
  assert.match(data, /role="dialog"/);
  assert.match(data, /Escape/);
  assert.match(data, /排名说明/);
  assert.doesNotMatch(data, /className=\{styles\.rankingSummary\}/);
  assert.doesNotMatch(data, /官方数据/);
  assert.doesNotMatch(data, /className=\{styles\.sourceMeta\}/);
});

test("ranking detail uses a compact two-level navigation and direct list", () => {
  assert.match(data, /className=\{styles\.detailNavStack\}/);
  assert.match(data, /资格竞争/);
  assert.match(data, /历史排名/);
  assert.match(data, /<RankingListTabs hub=\{hub\} selectedKey=\{selectedKey\} onSelectKey=\{onSelectKey\} compact \/>/);
  assert.match(data, /className=\{styles\.rankingFooterMeta\}/);
  assert.match(data, /来源：/);
  assert.match(data, /更新：/);
  assert.doesNotMatch(data, /搜索中文名 \/ 英文名 \/ 国家/);
  assert.doesNotMatch(data, /detailSummaryCard/);
  assert.match(css, /\.fullRankingList button\{width:100%;min-height:56px/);
  assert.match(css, /\.topRankingList button\{width:100%;min-height:58px/);
});

test("ranking detail preserves player drill-down and future data hub framework", () => {
  assert.match(data, /onOpenPlayer/);
  assert.match(data, /本赛季领跑者/);
  assert.match(data, /技术榜/);
  assert.match(data, /荣誉榜/);
});

test("data phase 1a does not move match or player deep data into the ranking loader", () => {
  assert.doesNotMatch(hub, /snooker_frames/);
  assert.doesNotMatch(hub, /snooker_match_statistics/);
  assert.doesNotMatch(hub, /snooker_match_head_to_head/);
  assert.doesNotMatch(hub, /snooker_player_profile_details/);
});
