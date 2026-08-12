import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("public event shell keeps compact mobile navigation and visible center title", () => {
  const app = source("app/event-app.tsx");
  const css = source("app/public-ux-polish.css");
  assert.doesNotMatch(app, /返回赛事中心/);
  assert.match(app, /admin-short[^>]*[^]*>管</);
  assert.match(app, /view === "players" \? "球员数据"[^]*station\?\.city \|\| "赛事中心"/);
  assert.match(css, /\.top h3\{display:block!important\}/);
  assert.match(css, /\.top \.admin\{grid-column:3;justify-self:end/);
  assert.match(css, /grid-template-columns:repeat\(5,minmax\(0,1fr\)\)!important/);
  assert.match(css, /min-height:42px!important/);
  assert.doesNotMatch(css, /safe-area-inset|viewport-fit|Home Indicator/i);
});

test("overview group cards restore age, main draw size and champion prize from data", () => {
  const app = source("app/event-app.tsx");
  const publicData = source("db/public.ts");
  assert.doesNotMatch(app, /station\.format\[0\]/);
  assert.match(app, /station\.age\[group\]/);
  assert.match(app, /groupMainSize\(station, group\)/);
  assert.match(app, /station\.prizes\[group\]\[0\]/);
  assert.match(publicData, /registrationFeeCents: eventGroups\.registrationFeeCents/);
  assert.match(publicData, /mainDrawSize: eventGroups\.mainDrawSize/);
  assert.match(publicData, /groupDetails: groupDetailsByEvent\.get\(row\.id\)/);
});

test("overview registration card is emphasized and open registration uses a button-like CTA", () => {
  const app = source("app/event-app.tsx");
  const css = source("app/public-ux-polish.css");
  assert.match(app, /registration-public-card/);
  assert.match(app, /<a href=\{registration\.url\}[^>]*>立即报名<\/a>/);
  assert.match(css, /\.registration-public-card\{[^}]*background:/);
  assert.match(css, /\.registration-public-card \.inline-actions a\{[^}]*min-height:42px/);
  assert.match(css, /\.registration-public-card \.inline-actions a\{[^}]*display:inline-flex/);
  assert.match(css, /\.registration-public-card \.inline-actions a\{[^}]*background:linear-gradient/);
});

test("qualifier playoffs stay in three or four columns and keep the game label in a reserved right-side lane", () => {
  const live = source("app/public-competition-live-v2.tsx");
  const css = source("app/public-ux-polish.css");
  assert.match(live, /<b>附加赛<\/b>/);
  assert.match(live, /className="public-prelim-grid"/);
  assert.match(css, /\.public-prelim-grid\{grid-template-columns:repeat\(4,230px\)!important/);
  assert.match(css, /@media\(max-width:900px\)[^]*\.public-prelim-grid\{grid-template-columns:repeat\(3,230px\)!important\}/);
  assert.match(css, /\.public-prelim-grid \.stage-tree-match\{width:230px!important;padding-right:76px\}/);
  assert.match(css, /\.public-prelim-grid \.stage-game-no\{left:auto!important;right:0!important/);
  assert.doesNotMatch(css, /\.public-prelim-grid\{grid-template-columns:154px/);
});

test("regulation content remains snapshot-backed and handles empty rule standard", () => {
  const app = source("app/event-app.tsx");
  const content = source("db/public-content.ts");
  assert.doesNotMatch(app, /pdf-pending/);
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

test("published guides use prefetched navigation, cached data and unified station header", () => {
  const app = source("app/event-app.tsx");
  const guidePage = source("app/guide/[guideId]/page.tsx");
  assert.match(app, /<Link prefetch href=\{`\/guide\//);
  assert.match(guidePage, /unstable_cache/);
  assert.match(guidePage, /revalidate: 300/);
  assert.match(guidePage, /<header className="top public-guide-unified-top"/);
  assert.match(guidePage, /<h3>\{stationTitle\}<\/h3>/);
  assert.match(guidePage, /event=\$\{encodeURIComponent\(guide\.eventId\)\}&tab=overview/);
});

test("public regulation fees are dynamic, grouped and remain inside published snapshot", () => {
  const app = source("app/event-app.tsx");
  const publisher = source("db/content-publication-fast.ts");
  const migration = source("db/migrations/20260812_upgrade_regulation_snapshot_fees.sql");
  assert.doesNotMatch(app, /¥100/);
  assert.match(app, /regulation\?\.registrationFees\.少年组/);
  assert.match(app, /regulation\?\.registrationFees\.青年组/);
  assert.match(app, /const sameFee = Boolean\(u16Fee && u20Fee && u16Fee === u20Fee\)/);
  assert.match(app, /public-fee-grid/);
  assert.match(app, /本站参赛费用/);
  assert.match(publisher, /registration_fee_cents/);
  assert.match(publisher, /signup_note as "signupNote"/);
  assert.match(migration, /'registrationFees'/);
  assert.match(migration, /'signupNote'/);
  assert.doesNotMatch(migration, /update public\.events|update public\.matches|update public\.event_documents/);
});

test("regulation format table is compact on mobile", () => {
  const css = source("app/public-ux-polish.css");
  assert.match(css, /\.regulation \.format-table>div\{min-width:500px!important/);
  assert.doesNotMatch(css, /\.regulation \.format-table>div\{min-width:650px/);
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

test("original regulation backfill remains narrow and snapshot-complete", () => {
  const migration = source("db/migrations/20260812_backfill_regulation_publication_snapshots.sql");
  for (const field of ["ruleStandard", "competitionFormat", "drawRules", "prizeNote", "prizes"]) assert.match(migration, new RegExp(`'${field}'`));
  assert.match(migration, /p\.module_type = 'regulation'/);
  assert.match(migration, /p\.status = 'published'/);
  assert.match(migration, /p\.snapshot_json is null/);
  assert.doesNotMatch(migration, /update public\.events|update public\.matches|update public\.event_documents/);
});

test("schedule group switches stay independent and finished events override stale phase status", () => {
  const schedule = source("app/public-master-schedule.tsx");
  assert.match(schedule, /const effectiveGroup = group;/);
  assert.doesNotMatch(schedule, /!u16Published && u20Published/);
  assert.match(schedule, /const eventFinished = station\.status === "已结束" \|\| station\.status === "已归档"/);
  assert.match(schedule, /const status = eventFinished \? "已结束" : phase\?\.status \|\| "待开始"/);
  assert.match(schedule, /赛程待组委会发布/);
});

test("match navigation keeps date context and ended events default to their final available day", () => {
  const schedule = source("app/public-master-schedule.tsx");
  const enhancer = source("app/public-ux-enhancer.tsx");
  assert.doesNotMatch(schedule, /<strong>晋级说明<\/strong>/);
  assert.match(schedule, /public-master-detail-content \.draw-back\{display:none!important\}/);
  assert.match(schedule, /赛程说明：/);
  assert.match(enhancer, /params\.set\("date", value\)/);
  assert.match(enhancer, /currentEventFinished\(\)/);
  assert.match(enhancer, /const last = buttons\.at\(-1\)/);
  assert.match(enhancer, /nav\.scrollTo\(\{ left, behavior: "smooth" \}\)/);
  assert.match(enhancer, /index <= 0 \? 0 : index >= buttons\.length - 1 \? maxLeft/);
});

test("published guides return to their own event overview", () => {
  const guidePage = source("app/guide/[guideId]/page.tsx");
  const guides = source("db/guides.ts");
  assert.match(guides, /eventId: row\.event_id/);
  assert.match(guidePage, /返回赛事概览/);
});

test("public event lifecycle labels keep public-only semantics", () => {
  const home = source("db/public-home.ts");
  const detail = source("app/api/public/events/[eventId]/detail/route.ts");
  for (const current of [home, detail]) {
    assert.match(current, /registration_closed: "报名截止"/);
    assert.match(current, /upcoming: "待开始"/);
  }
  assert.match(detail, /archived: "已结束"/);
  assert.doesNotMatch(detail, /archived: "已归档"/);
});