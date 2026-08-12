import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("published participant guides keep the original desktop layout and use the third-level header only on mobile", () => {
  const page = source("app/guide/[guideId]/page.tsx");
  const css = source("app/guide/guide.css");

  assert.match(page, /<header className="top public-guide-unified-top">/);
  assert.match(page, /className="brand"[^>]*aria-label="返回赛事概览"/);
  assert.match(page, /<strong>华彩赛事<\/strong>/);
  assert.match(page, /className="admin"[^>]*href="\/admin"/);
  assert.match(page, /className="public-guide-return"[^>]*>← 返回赛事概览<\/Link>/);
  assert.match(page, /className="public-guide-mobile-back"[^>]*>← 返回<\/Link>/);
  assert.match(page, /<h3>\{stationTitle\}<\/h3>/);
  assert.match(page, /public-guide-mobile-spacer/);
  assert.match(page, /<section className="public-guide-hero">/);
  assert.match(page, /<small>参赛友好提示<\/small>/);
  assert.match(page, /event=\$\{encodeURIComponent\(guide\.eventId\)\}&tab=overview/);

  assert.match(css, /\.public-guide-mobile-back,\.public-guide-mobile-spacer\{display:none\}/);
  assert.match(css, /\.public-guide-return\{display:inline-flex/);
  assert.match(css, /@media\(max-width:680px\)[^]*\.public-guide-page \.public-guide-unified-top \.brand,\.public-guide-page \.public-guide-unified-top \.admin\{display:none!important\}/);
  assert.match(css, /@media\(max-width:680px\)[^]*\.public-guide-mobile-back\{grid-column:1;[^}]*display:inline-flex/);
  assert.match(css, /@media\(max-width:680px\)[^]*\.public-guide-return\{display:none\}/);
});
