import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("public event surfaces never expose archived as a customer-facing state", () => {
  const home = source("app/page.tsx");
  const detail = source("app/api/public/events/[eventId]/detail/route.ts");
  assert.match(home, /station\.status === "已归档" \? \{ \.\.\.station, status: "已结束" \}/);
  assert.match(detail, /archived: "已结束"/);
  assert.doesNotMatch(detail, /archived: "已归档"/);
});

test("public bracket payload preserves published bye slots as round byes", () => {
  const payload = source("app/api/public/events/[eventId]/competition/payload.ts");
  const live = source("app/public-competition-live-v2.tsx");
  assert.match(payload, /match\.resultType === "bye"/);
  assert.match(payload, /match\.sourceAType === "bye"/);
  assert.match(payload, /match\.sourceBType === "bye"/);
  assert.match(payload, /playerA: byeOnA \? "BYE" : match\.playerA/);
  assert.match(payload, /playerB: byeOnB \? "BYE" : match\.playerB/);
  assert.match(payload, /status: isBye \? "auto_advanced" : match\.status/);
  assert.match(payload, /public-competition-event-v5/);
  assert.match(live, /if \(value === "BYE"\) return "轮空"/);
});
