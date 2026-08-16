import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("snooker monitor is a public POC page backed by the realtime dashboard", async () => {
  const [page, client] = await Promise.all([
    read("app/snooker/site-monitor/page.tsx"),
    read("app/snooker/site-monitor/snooker-site-monitor.tsx"),
  ]);

  assert.match(page, /getDashboardWithLiveOverlay/);
  assert.match(page, /dynamic = "force-dynamic"/);
  assert.match(page, /robots: \{ index: false, follow: false \}/);
  assert.doesNotMatch(page, /getAdminViewer|redirect\(|notFound\(/);

  assert.match(client, /斯诺克数据监测/);
  assert.match(client, /\/api\/snooker\/v1\/dashboard\?monitor=/);
  assert.match(client, /15_000/);
  assert.match(client, /visibilitychange/);
  assert.match(client, /立即刷新/);
  assert.match(client, /WST 数据源/);
  assert.match(client, /赛事映射/);
  assert.match(client, /正在进行的比赛/);
  assert.match(client, /当前局比分/);
  assert.match(client, /Match Centre 逐局数据/);
  assert.match(client, /sourceHealth\.latencyMs/);
  assert.match(client, /sourceHealth\.message/);
});
