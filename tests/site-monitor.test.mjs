import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("site monitor is root-admin only and remains a single list page", () => {
  const page = read("app/site-monitor/page.tsx");
  assert.match(page, /viewer\.username !== "admin"/);
  assert.match(page, /viewer\.role !== "system_admin"/);
  assert.match(page, /\/admin\/login\?next=%2Fsite-monitor/);
  for (const column of ["时间", "类型", "用户 \/ 访客", "IP", "地区", "设备", "页面 \/ 模块", "赛事", "操作"]) {
    assert.ok(page.includes(column), `missing monitor column: ${column}`);
  }
  assert.doesNotMatch(page, /详情|查看详情/);
});

test("admin login only restores the explicit site-monitor destination", () => {
  const login = read("app/admin/login/login-form.tsx");
  assert.match(login, /params\.get\("next"\) === "\/site-monitor" \? "\/site-monitor" : "\/admin"/);
  assert.match(login, /window\.location\.replace\(loginDestination\(\)\)/);
});

test("site monitor avoids Intl timezone dependency in EdgeOne server rendering", () => {
  const page = read("app/site-monitor/page.tsx");
  const reader = read("db/site-monitor-runtime.ts");
  assert.doesNotMatch(page, /Intl\.DateTimeFormat/);
  assert.doesNotMatch(reader, /Intl\.DateTimeFormat/);
  assert.match(page, /CHINA_OFFSET_MS/);
  assert.match(reader, /CHINA_OFFSET_MS/);
});

test("site monitor runtime uses bounded ISO text ranges and partial-query isolation", () => {
  const reader = read("db/site-monitor-runtime.ts");
  assert.match(reader, /const nowIso = now\.toISOString\(\)/);
  assert.match(reader, /return \{ from: todayStart, to: nowIso \}/);
  assert.match(reader, /Promise\.allSettled/);
  assert.match(reader, /rowsOrWarning/);
  assert.match(reader, /al\.created_at>=\$\{from\}/);
  assert.match(reader, /al\.created_at<\$\{to\}/);
  assert.match(reader, /attempted_at>=\$\{from\}/);
  assert.match(reader, /attempted_at<\$\{to\}/);
  assert.doesNotMatch(reader, /::timestamptz|\$\{to\}=''|to: ""/);
});

test("site monitor paginates server-side at 100 rows without a 500-row ceiling", () => {
  const page = read("app/site-monitor/page.tsx");
  const reader = read("db/site-monitor-runtime.ts");
  assert.match(reader, /SITE_MONITOR_PAGE_SIZE = 100/);
  assert.match(reader, /const offset = \(page - 1\) \* SITE_MONITOR_PAGE_SIZE/);
  assert.match(reader, /const sourceLimit = offset \+ SITE_MONITOR_PAGE_SIZE \+ 1/);
  assert.match(reader, /limit \$\{sourceLimit\}/);
  assert.match(reader, /hasPrevious: page > 1/);
  assert.match(reader, /hasNext: pageWindow\.length > SITE_MONITOR_PAGE_SIZE/);
  assert.match(reader, /pageWindow\.slice\(0, SITE_MONITOR_PAGE_SIZE\)/);
  assert.doesNotMatch(reader, /\.slice\(0, 500\)|limit 700/);
  assert.match(page, /上一页/);
  assert.match(page, /下一页/);
  assert.match(page, /每页 \{pageSize\} 条/);
  assert.match(page, /params\.set\("page", String\(page\)\)/);
});

test("site monitor search is applied before paginated source limits", () => {
  const reader = read("db/site-monitor-runtime.ts");
  assert.match(reader, /const searchPattern = query \? `%\$\{query\.toLowerCase\(\)\}%` : ""/);
  assert.match(reader, /lower\(concat_ws\(' ',al\.target_id,al\.ip_address,evt\.short_title,al\.after_json\)\) like \$\{searchPattern\}/);
  assert.match(reader, /actor\.display_name,actor\.username,al\.ip_address,evt\.short_title,al\.module_type,al\.action/);
  assert.match(reader, /username_key,ip_address,user_agent/);
});

test("site monitor page renders a warning instead of crashing when data load fails", () => {
  const page = read("app/site-monitor/page.tsx");
  assert.match(page, /try \{/);
  assert.match(page, /page data load failed/);
  assert.match(page, /部分监测数据暂未读取成功/);
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

test("site monitor reuses existing audit/login/session data and adds no migration", () => {
  const reader = read("db/site-monitor-runtime.ts");
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
