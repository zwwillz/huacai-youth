import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("public event shell keeps the compact mobile navigation contract", () => {
  const app = source("app/event-app.tsx");
  const css = source("app/public-ux-polish.css");
  assert.doesNotMatch(app, /返回赛事中心/);
  assert.match(app, /admin-short[^>]*[^]*>管</);
  assert.match(css, /grid-template-columns:repeat\(5,minmax\(0,1fr\)\)!important/);
  assert.match(css, /min-height:42px!important/);
  assert.doesNotMatch(css, /safe-area-inset|viewport-fit|Home Indicator/i);
});

test("overview and regulation content do not expose misleading or empty content", () => {
  const app = source("app/event-app.tsx");
  const content = source("db/public-content.ts");
  assert.doesNotMatch(app, /station\.format\[0\]/);
  assert.doesNotMatch(app, /pdf-pending/);
  assert.match(app, /冠军奖金 \{station\.prizes\.少年组/);
  assert.match(app, /ruleStandard && <div className="rule-standard"/);
  assert.match(content, /ruleStandard: modules\.includes\("regulation"\)/);
});

test("schedule and match navigation preserve compact context", () => {
  const schedule = source("app/public-master-schedule.tsx");
  const enhancer = source("app/public-ux-enhancer.tsx");
  assert.doesNotMatch(schedule, /<strong>晋级说明<\/strong>/);
  assert.match(schedule, /public-master-detail-content \.draw-back\{display:none!important\}/);
  assert.match(schedule, /赛程说明：/);
  assert.match(enhancer, /params\.set\("date", value\)/);
  assert.match(enhancer, /nav\.scrollTo\(\{ left, behavior: "smooth" \}\)/);
  assert.match(enhancer, /index <= 0 \? 0 : index >= buttons\.length - 1 \? maxLeft/);
});

test("published guides return to their own event overview", () => {
  const guidePage = source("app/guide/[guideId]/page.tsx");
  const guides = source("db/guides.ts");
  assert.match(guides, /eventId: row\.event_id/);
  assert.match(guidePage, /event=\$\{encodeURIComponent\(guide\.eventId\)\}&tab=overview/);
  assert.match(guidePage, /返回赛事概览/);
});

test("public event lifecycle labels have distinct semantics", () => {
  const home = source("db/public-home.ts");
  const detail = source("app/api/public/events/[eventId]/detail/route.ts");
  for (const current of [home, detail]) {
    assert.match(current, /registration_closed: "报名截止"/);
    assert.match(current, /upcoming: "待开始"/);
    assert.match(current, /archived: "已归档"/);
  }
});
