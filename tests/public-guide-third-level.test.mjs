import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("all published participant guides use a third-level header and keep the purple guide hero", () => {
  const page = source("app/guide/[guideId]/page.tsx");
  const css = source("app/guide/guide.css");

  assert.match(page, /<header className="top public-guide-unified-top">/);
  assert.match(page, /className="public-guide-top-back"[^>]*>← 返回<\/Link>/);
  assert.match(page, /<h3>\{stationTitle\}<\/h3>/);
  assert.match(page, /public-guide-top-spacer/);
  assert.doesNotMatch(page, /className="brand"|className="admin"/);
  assert.doesNotMatch(page, /className="public-guide-return"/);
  assert.match(page, /<section className="public-guide-hero">/);
  assert.match(page, /<small>参赛友好提示<\/small>/);
  assert.match(page, /event=\$\{encodeURIComponent\(guide\.eventId\)\}&tab=overview/);
  assert.match(css, /\.public-guide-unified-top\{grid-template-columns:/);
  assert.match(css, /\.public-guide-top-back\{/);
});
