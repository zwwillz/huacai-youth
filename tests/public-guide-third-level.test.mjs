import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("normal participant guide navigation stays in the event shell and the legacy route keeps its original layout", () => {
  const app = source("app/event-app.tsx");
  const page = source("app/guide/[guideId]/page.tsx");
  const css = source("app/guide/guide.css");

  assert.match(app, /guides\.map\(\(guide\) => <button onClick=\{\(\) => openGuide\(guide\.id\)\}/);
  assert.doesNotMatch(app, /href=\{`\/guide\//);
  assert.match(app, /tab === "guide" && <ParticipantGuide/);

  assert.match(page, /<header className="top public-guide-unified-top">/);
  assert.match(page, /className="brand"[^>]*aria-label="返回赛事概览"/);
  assert.match(page, /<strong>华彩赛事<\/strong>/);
  assert.match(page, /className="admin"[^>]*href="\/admin"/);
  assert.match(page, /className="public-guide-return"[^>]*>← 返回赛事概览<\/Link>/);
  assert.doesNotMatch(page, /public-guide-mobile-back|public-guide-mobile-spacer|public-guide-top-back|public-guide-top-spacer/);
  assert.match(page, /<section className="public-guide-hero">/);
  assert.match(page, /<small>参赛友好提示<\/small>/);

  assert.doesNotMatch(css, /public-guide-mobile-back|public-guide-mobile-spacer/);
  assert.match(css, /@media\(max-width:680px\)\{\.public-guide-shell/);
});