import test from "node:test";
import assert from "node:assert/strict";
import { chooseEventNextAction } from "../db/event-workflow-policy.mjs";

function summary(event, groups = []) {
  return {
    event,
    registration: { timeState: "closed", configReady: true, totalCount: 0, pendingCount: 0 },
    publications: { overview: "published", registration: "published" },
    groups,
    blockers: [],
    competitionReadyToStart: false,
    allRankingsConfirmed: true,
    allRankingsPublished: true,
  };
}

test("permanent finished test event is kept available instead of recommending archive", () => {
  const action = chooseEventNextAction(summary({ id: "event_luoyang_test_2026", status: "finished", isTest: true, legacyHistorical: false }), "system_admin");
  assert.equal(action.kind, "wait");
  assert.match(action.title, /测试赛事已结束/);
});

test("finished legacy event never points into new Competition final-ranking workflow", () => {
  const groups = [{ groupId: "legacy-u16", rankingStatus: "none", nextAction: null }];
  const action = chooseEventNextAction(summary({ id: "event_taiyuan_2026", status: "finished", isTest: false, legacyHistorical: true }, groups), "committee");
  assert.equal(action.code, "archive_event");
  assert.equal(action.kind, "lifecycle");
  assert.equal(action.lifecycleAction, "archive");
  assert.equal(action.href, "");
});
