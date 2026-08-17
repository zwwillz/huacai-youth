import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ui = readFileSync(new URL("../app/snooker/snooker-data-center-v2.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/snooker/snooker-ui-polish.module.css", import.meta.url), "utf8");

test("confirmed match-detail polish stays restored through player phase1", () => {
  assert.match(ui, /const shortNameEn = player\.shortNameEn \|\| player\.nameEn\.split/);
  assert.match(ui, /<strong>\{player\.shortNameZh \|\| player\.nameZh\}<\/strong>/);
  assert.match(ui, /className=\{styles\.frameRow\} style=\{\{ minHeight: 50 \}\}/);
  assert.match(ui, /url\.searchParams\.set\("player", target\.slug\)/);
  assert.doesNotMatch(ui, /\/snooker\/players\/\$\{/);

  assert.match(css, /\.matchupPortrait img\{[^}]*transform:scale\(1\.08\)[^}]*transform-origin:center bottom/);
  assert.match(css, /\.matchupCard \.dataHint\{display:none\}/);
});