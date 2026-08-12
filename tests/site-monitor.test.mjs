import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("site monitor is root-admin only and remains a single list page", () => {
  const page = read("app/site-monitor/page.tsx");
  assert.match(page, /viewer\.username !== "admin"/);
  assert.match(page, /viewer\.role !== "system_admin"/);
  for (const column of ["时间", "类型", "用户 \/ 访客", "IP", "地区", "设备", "页面 \/ 模块", "赛事", "操作"]) {
    assert.ok(page.includes(column), `missing monitor column: ${column}`);
  }
  assert.doesNotMatch(page, /详情|查看详情|pagination|下一页|上一页/);
});

test("public visit logging is asynchronous, deduplicated, rate-limited, and excludes private paths", () => {
  const tracker = read("app/public-visit-tracker.tsx");
  const route = read("app/api/public/visit/route.ts");
  const layout = read("app/layout.tsx");

  assert.match(layout, /<PublicVisitTracker \/>/);
  assert.match(tracker, /keepalive: true/);
  assert.match(tracker, /\/admin/);
  assert.match(tracker, /\/site-monitor/);
  assert.match(tracker, /huacai:navigation/);
  assert.match(route, /'public_visit'/);
  assert.match(route, /interval '20 seconds'/);
  assert.match(route, /interval '1 minute'/);
  assert.match(route, /\) < 120/);
  assert.match(route, /select e\.id from public\.events/);
  assert.match(route, /status: 204/);
  assert.match(route, /public visit logging skipped/);
});

test("visitor geo uses EdgeOne context without third-party geo API", () => {
  const geo = read("cloud-functions/api/visitor-geo.js");
  assert.match(geo, /context\.clientIp/);
  assert.match(geo, /context\.geo/);
  assert.match(geo, /regionName/);
  assert.match(geo, /cityName/);
  assert.match(geo, /Cache-Control": "no-store"/);
  assert.doesNotMatch(geo, /fetch\(/);
});

test("site monitor reuses existing audit/login data and adds no migration", () => {
  const reader = read("db/site-monitor.ts");
  assert.match(reader, /public\.audit_logs/);
  assert.match(reader, /public\.admin_login_attempts/);
  assert.match(reader, /public\.admin_sessions/);
  assert.match(reader, /al\.module_type='public_visit'/);
  assert.match(reader, /al\.module_type<>'public_visit'/);
});

test("existing operation log excludes public page views", () => {
  const audit = read("db/audit-log.ts");
  const matches = audit.match(/al\.module_type<>'public_visit'/g) || [];
  assert.ok(matches.length >= 2, "operation log list and detail should both exclude public_visit rows");
});
