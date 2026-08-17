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

test("match detail presents roomy Match Season and H2H rows inside one matchup card", async () => {
  const [ui, css, insights, dbV2] = await Promise.all([
    read("app/snooker/snooker-data-center-v2.tsx"),
    read("app/snooker/snooker-ui-polish.module.css"),
    read("app/snooker/snooker-insights.module.css"),
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
  assert.match(ui, /style=\{\{ display: "contents" \}\}/);
  assert.match(css, /\.matchupCard\{[^}]*display:flex;flex-direction:column/);
  assert.match(css, /\.matchupCard \.dataTabs\{[^}]*order:1/);
  assert.match(css, /\.matchupPlayers\{[^}]*order:2[^}]*margin:10px 0 0/);
  assert.match(css, /\.matchupPortrait\{[^}]*width:76px;height:94px/);
  assert.match(css, /\.panelMeta\{display:none\}/);
  assert.match(css, /\.matchupCard \.compareGrid>div\{padding:0;border:0\}/);
  assert.match(css, /\.matchupCard \.compareGrid>div>div\{[^}]*min-height:58px[^}]*padding:15px 2px[^}]*border-bottom:1px solid #d8dfdb/);
  assert.match(css, /\.matchupCard \.compareGrid>div:last-child>div\{border-bottom:0\}/);
  assert.match(css, /\.matchupCard \.compareGrid>div>div\{min-height:56px;padding:14px 2px;font-size:12px\}/);
  assert.match(css, /\.matchupCard \.compareLeft\{[^}]*padding-left:2px/);
  assert.match(css, /\.matchupCard \.compareRight\{[^}]*padding-right:2px/);
  assert.match(insights, /\.h2hSummary\{[^}]*min-height:62px[^}]*border-bottom:1px solid #dfe5e2/);
  assert.match(insights, /\.h2hSide\{[^}]*padding:0 2px/);
  assert.match(insights, /\.h2hMiddle strong\{display:none\}/);
  assert.match(insights, /content:"历史对阵"/);
  assert.match(ui, /localizedTournamentLabel\(item\.tournament, snapshot\.calendar\)/);
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

test("recent events keep original type/status positions and semantic colors", async () => {
  const [ui, css] = await Promise.all([
    read("app/snooker/snooker-data-center-v2.tsx"),
    read("app/snooker/snooker-ui-polish.module.css"),
  ]);

  assert.match(ui, /item\.id === featuredEventCard\?\.id/);
  assert.doesNotMatch(ui, /item\.id !== featuredEventCard\?\.id/);
  assert.match(ui, /eventStatusText.*eventStatusClass\(item\.status\).*eventStatusLabel\(item\)/s);
  assert.match(ui, /<StatusPill status="type" label=\{item\.typeZh\} \/>/);
  assert.match(ui, /eyebrow="RECENT TOURNAMENTS" title="近期赛事"/);
  assert.match(ui, /actionClassName=\{`\$\{polish\.eventStatusText\} \$\{eventStatusClass\(nextEventCard\.status\)\}`\}/);
  assert.match(css, /\.eventStatusLive>span\{background:#eaf3ff!important;color:#2465a8!important\}/);
  assert.match(css, /\.eventStatusUpcoming>span\{background:#fff0e6!important;color:#bd5615!important\}/);
  assert.match(css, /\.eventStatusText\.eventStatusUpcoming\{color:#bd5615!important\}/);
  assert.match(css, /\.eventStatusCompleted>span\{background:#f0f2f1!important;color:#737b77!important\}/);
});

test("player directory has one canonical UI and detail navigation is prefetched", async () => {
  const [ui, directory, directoryPage, detail, detailPage, loader, loading, playerCss] = await Promise.all([
    read("app/snooker/snooker-data-center-v2.tsx"),
    read("app/snooker/players/player-directory.tsx"),
    read("app/snooker/players/page.tsx"),
    read("app/snooker/players/[slug]/player-detail.tsx"),
    read("app/snooker/players/[slug]/page.tsx"),
    read("lib/snooker/player-detail-fast.ts"),
    read("app/snooker/players/[slug]/loading.tsx"),
    read("app/snooker/players/player.module.css"),
  ]);

  assert.match(ui, /activeView === "players" \? <PlayerDirectoryContent players=\{directoryPlayers\}/);
  assert.match(directoryPage, /redirect\("\/snooker\?view=players"\)/);
  assert.match(directory, /<Link className=\{styles\.playerRow\} href=\{`\/snooker\/players\/\$\{player\.slug\}`\} prefetch/);
  assert.match(detail, /href="\/snooker\?view=players" prefetch/);
  assert.match(detailPage, /getSnookerPlayerDetailFast/);
  assert.match(loader, /rpc\/snooker_player_detail_public/);
  assert.match(loader, /next: \{ revalidate: 300 \}/);
  assert.match(loading, /正在加载球员资料/);
  assert.match(playerCss, /\.directoryToolbar \.searchBox input\{/);
  assert.match(playerCss, /\.directoryToolbar \.filters button\{/);
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
