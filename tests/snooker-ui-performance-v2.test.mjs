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

test("match detail presents Match Season and H2H inside one roomy matchup card", async () => {
  const [ui, css, dbV2] = await Promise.all([
    read("app/snooker/snooker-data-center-v2.tsx"),
    read("app/snooker/snooker-ui-polish.module.css"),
    read("lib/snooker/database-public-v2.ts"),
  ]);

  assert.match(ui, /type MatchDataTab = "match" \| "season" \| "h2h"/);
  assert.match(ui, /MATCHUP DATA/);
  assert.match(ui, /<h2>对阵数据<\/h2>/);
  assert.match(ui, /<MatchupPlayer player=\{p1\}/);
  assert.match(ui, /<MatchupPlayer player=\{p2\}/);
  assert.match(ui, />本场<\/span><small>MATCH<\/small>/);
  assert.match(ui, />赛季<\/span><small>SEASON<\/small>/);
  assert.match(ui, />交手<\/span><small>H2H<\/small>/);
  assert.match(ui, /赛季数据对比/);
  assert.match(css, /\.matchupCard\{/);
  assert.match(css, /\.matchupPortrait img\{[^}]*object-fit:contain/);
  assert.match(css, /\.matchupCard \.compareGrid>div\{[^}]*min-height:48px/);
  assert.doesNotMatch(ui, /styles\.detailInfoCard/);
  assert.match(dbV2, /snooker_player_season_stats\?select=/);
  assert.match(dbV2, /season_start_year=eq\.2026/);
});

test("official world ranking is explicit, top three on home, euro-prefixed and avatar-only clickable", async () => {
  const [ui, css, dbV2, playerData] = await Promise.all([
    read("app/snooker/snooker-data-center-v2.tsx"),
    read("app/snooker/snooker-ui-polish.module.css"),
    read("lib/snooker/database-public-v2.ts"),
    read("lib/snooker/player-data.ts"),
  ]);

  assert.match(ui, /eyebrow="Official World Ranking" title="世界排名" action="TOP 3"/);
  assert.match(ui, /rankingRows\.slice\(0, 3\)/);
  assert.match(ui, /return `€\$\{value\.toLocaleString/);
  assert.match(ui, /className=\{polish\.rankingStaticRow\}/);
  assert.match(ui, /className=\{polish\.rankingAvatarButton\} onClick=\{\(\) => openPlayer/);
  assert.match(css, /\.rankingStaticRow\{/);
  assert.match(dbV2, /list_key=eq\.world_official/);
  assert.match(dbV2, /rankings: rankings\.length \? rankings/);
  assert.match(playerData, /list_key: "eq\.world_official"/);
  assert.match(ui, /eyebrow="Official World Ranking" title="中国球员"/);
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

test("bottom navigation keeps all four main tabs local and root data is short cached", async () => {
  const [ui, shell, db, page] = await Promise.all([
    read("app/snooker/snooker-data-center-v2.tsx"),
    read("app/snooker/players/player-shell.tsx"),
    read("lib/snooker/database-public.ts"),
    read("app/snooker/page.tsx"),
  ]);

  assert.match(ui, /type MainView = "home" \| "matches" \| "players" \| "data"/);
  assert.match(ui, /activeView === "players" \? <PlayerDirectoryContent/);
  assert.match(ui, /const changeView = \(view: NavId\) => \{[\s\S]*?setActiveView\(view\)/);
  assert.doesNotMatch(ui, /router\.push\("\/snooker\/players"\)/);
  assert.match(shell, /href: "\/snooker\?view=players"/);
  assert.match(db, /next: \{ revalidate \}/);
  assert.match(page, /export const revalidate = 30/);
  assert.doesNotMatch(page, /force-dynamic/);
  assert.doesNotMatch(ui, /behavior: "smooth"/);
});
