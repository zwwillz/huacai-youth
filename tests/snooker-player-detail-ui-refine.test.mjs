import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("player detail career and Triple Crown cards use compact bilingual mobile layout", async () => {
  const source = await readFile("app/snooker/players/player-detail-content.tsx", "utf8");
  const css = await readFile("app/snooker/players/player-detail-refresh.module.css", "utf8");

  assert.match(source, /RANKING TITLES/);
  assert.match(source, /CAREER 147s/);
  assert.match(source, /count\(career\?\.rankingTitles\)/);
  assert.match(css, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)!important/);

  assert.match(source, /world-championship\.webp/);
  assert.match(source, /uk-championship\.webp/);
  assert.match(source, /masters\.webp/);
  assert.match(source, /zh: "世锦赛"/);
  assert.match(source, /zh: "英锦赛"/);
  assert.match(source, /zh: "大师赛"/);
  assert.match(source, /en: "THE MASTERS"/);
  assert.match(source, /<img className=\{detailUi\.tripleLogo\}[\s\S]*?<small>\{item\.en\}<\/small>[\s\S]*?<strong>\{item\.value\}<\/strong>[\s\S]*?<span>\{item\.zh\}<\/span>/);
});

test("detail card English and Chinese labels keep the soft lightweight treatment", async () => {
  const css = await readFile("app/snooker/players/player-detail-refresh.module.css", "utf8");

  assert.match(css, /color:#929895;/);
  assert.match(css, /font-weight:400;/);
  assert.match(css, /\.careerGridFour article span\{[\s\S]*?font-size:9\.5px;[\s\S]*?font-weight:400;/);
  assert.match(css, /\.tripleGridRefined article>span:last-child\{[\s\S]*?font-weight:400;/);
  assert.match(css, /\.metricCardGrid article span\{[\s\S]*?font-weight:400;/);
});

test("player hero is reduced by about five percent across responsive breakpoints", async () => {
  const source = await readFile("app/snooker/players/player-detail-content.tsx", "utf8");
  const css = await readFile("app/snooker/players/player-detail-refresh.module.css", "utf8");

  assert.match(source, /detailUi\.heroCompact/);
  assert.match(source, /detailUi\.heroCopyCompact/);
  assert.match(css, /\.heroCompact\{\s*min-height:289px!important;/);
  assert.match(css, /@media \(min-width:560px\)[\s\S]*?\.heroCompact\{min-height:315px!important\}/);
  assert.match(css, /@media \(max-width:430px\)[\s\S]*?\.heroCompact\{min-height:272px!important\}/);
});

test("season detail remains two columns on mainstream mobile widths", async () => {
  const source = await readFile("app/snooker/players/player-detail-content.tsx", "utf8");
  const css = await readFile("app/snooker/players/player-detail-refresh.module.css", "utf8");

  assert.match(source, /detailUi\.statListTwoColumn/);
  assert.match(css, /\.statListTwoColumn\{/);
  assert.match(css, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
});

test("season trend supports four switchable existing-data metrics with win rate default", async () => {
  const source = await readFile("app/snooker/players/player-detail-content.tsx", "utf8");

  assert.match(source, /useState<TrendMetricKey>\("winRate"\)/);
  assert.match(source, /key: "winRate"/);
  assert.match(source, /key: "shotTime"/);
  assert.match(source, /key: "averageBreak"/);
  assert.match(source, /key: "centuries"/);
  assert.match(source, /season\.averageShotTime/);
  assert.match(source, /season\.averageBreak/);
  assert.match(source, /season\.breaks100Plus/);
  assert.match(source, /setTrendMetric\(metric\.key\)/);
});
