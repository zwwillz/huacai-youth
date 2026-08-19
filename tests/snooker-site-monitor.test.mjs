import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("snooker monitor is admin protected and switches between visitor and data source views", async () => {
  const [page, dataPage, layout, login, switcher, visitorClient, dataClient, visitReader, tracker, visitRoute, adminVisitRoute] = await Promise.all([
    read("app/snooker/site-monitor/page.tsx"),
    read("app/snooker/site-monitor/data/page.tsx"),
    read("app/snooker/site-monitor/layout.tsx"),
    read("app/snooker/site-monitor/monitor-login.tsx"),
    read("app/snooker/site-monitor/monitor-mode-nav.tsx"),
    read("app/snooker/site-monitor/snooker-visit-monitor.tsx"),
    read("app/snooker/site-monitor/snooker-site-monitor.tsx"),
    read("db/snooker-visit-monitor.ts"),
    read("app/public-visit-tracker.tsx"),
    read("app/api/public/visit/route.ts"),
    read("app/api/snooker/v1/visits/route.ts"),
  ]);

  assert.match(page, /SnookerVisitMonitor/);
  assert.match(page, /dynamic = "force-dynamic"/);
  assert.match(page, /robots: \{ index: false, follow: false \}/);

  assert.match(dataPage, /getCachedDashboardWithLiveOverlay/);
  assert.match(dataPage, /SnookerSiteMonitor/);
  assert.match(dataPage, /dynamic = "force-dynamic"/);
  assert.match(dataPage, /robots: \{ index: false, follow: false \}/);

  assert.match(layout, /getSnookerOpsViewer/);
  assert.match(layout, /if \(!viewer\) return <MonitorLogin \/>/);
  assert.match(layout, /viewer\.mustChangePassword/);
  assert.match(layout, /redirect\("\/snooker\/data-ops"\)/);
  assert.match(layout, /MonitorModeNav/);

  assert.match(login, /PROTECTED MONITOR/);
  assert.match(login, /Snooker Admin/);
  assert.match(login, /\/api\/snooker\/data-ops\/auth\/login/);
  assert.match(login, /window\.location\.reload\(\)/);
  assert.match(login, /完整 IP/);

  assert.match(switcher, /用户访问监测/);
  assert.match(switcher, /数据源监测/);
  assert.match(switcher, /href="\/snooker\/site-monitor"/);
  assert.match(switcher, /href="\/snooker\/site-monitor\/data"/);

  assert.match(visitorClient, /用户访问监测/);
  assert.match(visitorClient, /管理员专用访问日志/);
  assert.match(visitorClient, /今天/);
  assert.match(visitorClient, /近7天/);
  assert.match(visitorClient, /近30天/);
  assert.match(visitorClient, /搜索访客、IP、页面、赛事/);
  assert.match(visitorClient, /\/api\/snooker\/v1\/visits/);
  assert.match(visitorClient, /120_000/);
  assert.match(visitorClient, /document\.hidden/);
  assert.match(visitorClient, /visibilitychange/);
  assert.match(visitorClient, /每 2 分钟刷新一次/);
  assert.match(visitorClient, /每页 \{pageSize\} 条/);
  assert.match(visitorClient, /前台访问/);
  assert.match(visitorClient, /IP 完整展示/);
  assert.doesNotMatch(visitorClient, /公开监测页仅展示脱敏 IP/);

  assert.match(adminVisitRoute, /getSnookerOpsViewer/);
  assert.match(adminVisitRoute, /status: 401/);
  assert.match(adminVisitRoute, /status: 428/);
  assert.match(adminVisitRoute, /请先登录数据运维中心/);

  assert.match(visitReader, /module_type='public_visit'/);
  assert.match(visitReader, /like '\/snooker%'/);
  assert.match(visitReader, /not like '\/snooker\/site-monitor%'/);
  assert.match(visitReader, /PAGE_SIZE = 100/);
  assert.match(visitReader, /function fullIp/);
  assert.doesNotMatch(visitReader, /function maskIp/);

  assert.match(tracker, /"\/snooker\/site-monitor"/);
  assert.match(tracker, /snookerPageContext/);
  assert.match(tracker, /MutationObserver/);
  assert.match(visitRoute, /"\/snooker\/site-monitor"/);
  assert.match(visitRoute, /->>'pageLabel'=\$\{pageLabel\}/);

  assert.match(dataClient, /斯诺克数据监测/);
  assert.match(dataClient, /管理员专用/);
  assert.match(dataClient, /\/api\/snooker\/v1\/dashboard\?monitor=/);
  assert.match(dataClient, /120_000/);
  assert.match(dataClient, /document\.hidden/);
  assert.match(dataClient, /visibilitychange/);
  assert.match(dataClient, /每 2 分钟自动检测/);
  assert.match(dataClient, /立即刷新/);
  assert.match(dataClient, /WST 数据源/);
  assert.match(dataClient, /赛事映射/);
  assert.match(dataClient, /正在进行的比赛/);
  assert.match(dataClient, /当前局比分/);
  assert.match(dataClient, /Match Centre 逐局数据/);
  assert.match(dataClient, /已结束比赛不再进入实时同步队列/);
  assert.match(dataClient, /sourceHealth\.latencyMs/);
  assert.match(dataClient, /sourceHealth\.message/);
  assert.match(dataClient, /未登录无法访问/);
});
