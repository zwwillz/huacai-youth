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
  assert.match(app, /<h2>\{ruleStandard \? "比赛规则与赛制" : "赛制"\}<\/h2>/);
  assert.match(app, /ruleStandard && <div className="rule-standard"/);
  assert.match(app, /const competitionFormat = regulation\?\.competitionFormat/);
  assert.match(app, /const drawRules = regulation\?\.drawRules/);
  assert.match(app, /const prizes = regulation\?\.prizes/);
  assert.match(app, /const prizeNote = regulation\?\.prizeNote/);
  assert.doesNotMatch(content, /eventDetails/);
  assert.match(content, /parseRegulationSnapshot/);
  assert.match(content, /row\.moduleType !== "regulation" \|\| Boolean\(regulation\)/);
});

test("placeholder participant guide is isolated to the current event", () => {
  const app = source("app/event-app.tsx");
  const start = app.indexOf("function ParticipantGuide");
  const end = app.indexOf("function eventUrl", start);
  const guide = app.slice(start, end);
  assert.match(guide, /station:Station/);
  assert.match(guide, /<p>\{station\.title\}<\/p>/);
  assert.doesNotMatch(guide, /廊坊站|太原站|洛阳站|济南站|朝阳站/);
  assert.match(app, /<ParticipantGuide station=\{station\}/);
});

test("public regulation has no fixed single-station fee", () => {
  const app = source("app/event-app.tsx");
  assert.doesNotMatch(app, /¥100/);
  assert.doesNotMatch(app, /单站参赛费/);
  assert.match(app, /<h2>报名须知<\/h2>[^]*\{station\.signup\}/);
});

test("regulation publication writes a complete snapshot and public only reads it", () => {
  const publisher = source("db/content-publication-fast.ts");
  const publicContent = source("db/public-content.ts");
  assert.match(publisher, /before\.moduleType === "regulation" && status === "published"/);
  assert.match(publisher, /createRegulationSnapshot/);
  assert.match(publisher, /snapshot_json=\$\{regulationSnapshotJson\}/);
  assert.match(publisher, /sql\.begin/);
  assert.match(publisher, /insert into public\.audit_logs/);
  assert.doesNotMatch(publicContent, /event_details|eventDetails/);
  assert.match(publicContent, /regulation: RegulationSnapshot \| null/);
});

test("regulation backfill is narrow and snapshot-complete", () => {
  const migration = source("db/migrations/20260812_backfill_regulation_publication_snapshots.sql");
  for (const field of ["ruleStandard", "competitionFormat", "drawRules", "prizeNote", "prizes"]) assert.match(migration, new RegExp(`'${field}'`));
  assert.match(migration, /p\.module_type = 'regulation'/);
  assert.match(migration, /p\.status = 'published'/);
  assert.match(migration, /p\.snapshot_json is null/);
  assert.doesNotMatch(migration, /update public\.events|update public\.matches|update public\.event_documents/);
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
