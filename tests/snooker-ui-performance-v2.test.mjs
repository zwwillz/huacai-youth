import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");

test("V2 uses database WebP avatars and short names on compact match cards", async () => {
  const [ui, db, domain] = await Promise.all([
    read("app/snooker/snooker-data-center-v2.tsx"),
    read("lib/snooker/database-public.ts"),
    read("lib/snooker/domain.ts"),
  ]);

  assert.match(domain, /shortNameEn\?: string/);
  assert.match(domain, /avatarUrl\?: string/);
  assert.match(domain, /seasonStatistics\?: SnookerSeasonStatistics/);
  assert.match(db, /short_name_en,short_name_zh/);
  assert.match(db, /avatar_url/);
  assert.match(ui, /player\.avatarUrl \|\| player\.avatar\?\.url/);
  assert.match(ui, /<PlayerAvatar player=\{p1\} size="sm"/);
  assert.match(ui, /p1\.shortNameZh/);
  assert.match(ui, /p2\.shortNameZh/);
  assert.doesNotMatch(ui, /查看完整比分 ›/);
  assert.doesNotMatch(ui, /className=\{styles\.tapHint\}/);
});

test("home result winner is a small badge and compact names do not add English subtitles", async () => {
  const [ui, css] = await Promise.all([
    read("app/snooker/snooker-data-center-v2.tsx"),
    read("app/snooker/snooker-ui-polish.module.css"),
  ]);

  assert.match(ui, /className=\{polish\.winBadge\}>胜<\/em>/);
  assert.match(ui, /className=\{polish\.homePlayerName\}/);
  assert.match(css, /\.winBadge\{[^}]*border-radius:50%/);
  assert.match(css, /\.homePlayerName\{[^}]*font-size:11px!important/);
  const homeScore = ui.match(/<div className=\{styles\.homeScore\}>[\s\S]*?<button className=\{styles\.fullButton\}/)?.[0] ?? "";
  assert.ok(homeScore.length > 0);
  assert.doesNotMatch(homeScore, /\.nameEn/);
});

test("match detail switches Match Season and H2H and removes the old metadata card", async () => {
  const [ui, dbV2] = await Promise.all([
    read("app/snooker/snooker-data-center-v2.tsx"),
    read("lib/snooker/database-public-v2.ts"),
  ]);

  assert.match(ui, /type MatchDataTab = "match" \| "season" \| "h2h"/);
  assert.match(ui, />本场<\/span><small>MATCH<\/small>/);
  assert.match(ui, />赛季<\/span><small>SEASON<\/small>/);
  assert.match(ui, />交手<\/span><small>H2H<\/small>/);
  assert.match(ui, /title="赛季数据对比"/);
  assert.doesNotMatch(ui, /styles\.detailInfoCard/);
  assert.match(dbV2, /snooker_player_season_stats\?select=/);
  assert.match(dbV2, /season_start_year=eq\.2026/);
});

test("event overview typography and public source wording are consistent", async () => {
  const ui = await read("app/snooker/snooker-data-center-v2.tsx");

  assert.match(ui, /eyebrow="TOURNAMENT OVERVIEW" title="赛事概览"/);
  assert.match(ui, /eyebrow="PRIZE MONEY" title="奖金分配"/);
  assert.match(ui, /className=\{polish\.championCard\}/);
  assert.match(ui, /官方当前已公布/);
  assert.match(ui, /官方比赛中心/);
  assert.doesNotMatch(ui, /WST 当前/);
  assert.doesNotMatch(ui, /WST Match Centre/);
});

test("bottom navigation avoids smooth-scroll delay and prefetches routed player pages", async () => {
  const [ui, shell, db] = await Promise.all([
    read("app/snooker/snooker-data-center-v2.tsx"),
    read("app/snooker/players/player-shell.tsx"),
    read("lib/snooker/database-public.ts"),
  ]);

  assert.match(ui, /window\.scrollTo\(\{ top: 0, behavior: "auto" \}\)/);
  assert.match(ui, /router\.prefetch\("\/snooker\/players"\)/);
  assert.match(shell, /router\.prefetch\(item\.href\)/);
  assert.match(shell, /onPointerDown=\{\(\) => router\.prefetch\(item\.href\)\}/);
  assert.match(db, /next: \{ revalidate \}/);
  assert.doesNotMatch(ui, /behavior: "smooth"/);
});
