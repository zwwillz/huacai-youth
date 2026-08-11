import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildGroupWorkflow, chooseEventNextAction } from "../db/event-workflow-policy.mjs";

const emptyPhase = () => ({ drawStatus: null, scheduleStatus: null, playableMatchCount: 0, pendingResultCount: 0, confirmedResultCount: 0 });
function groupFact(overrides = {}) {
  return {
    eventId: "event_test", lifecycle: "registration_closed", groupId: "g_u16", groupName: "少年组", groupCode: "U16",
    rosterStatus: "draft", rosterCount: 0, pendingCount: 0, approvedCount: 462, unresolvedCount: 0, invalidProfileCount: 0,
    phases: {
      "qualifier-one": emptyPhase(), "qualifier-two": emptyPhase(), "main-one": emptyPhase(), "main-two": emptyPhase(),
    },
    mainRosterStatus: null, mainRosterCount: 0, mainRosterIssueCount: 0, rankingStatus: "none",
    ...overrides,
  };
}
function completedPhase(extra = {}) {
  return { drawStatus: "confirmed", scheduleStatus: "confirmed", playableMatchCount: 10, pendingResultCount: 0, confirmedResultCount: 10, ...extra };
}
function eventSummary(overrides = {}) {
  return {
    event: { id: "event_test", status: "draft", basicReady: true, isTest: true, legacyHistorical: false },
    registration: { timeState: "not_started", configReady: false, totalCount: 0, pendingCount: 0 },
    publications: { overview: "draft", registration: "draft" },
    groups: [], blockers: [], competitionReadyToStart: false, allRankingsConfirmed: false, allRankingsPublished: false,
    ...overrides,
  };
}

// Case 1: newly created event must stay in preparation instead of jumping to competition.
test("case 1 new event points to event preparation", () => {
  const action = chooseEventNextAction(eventSummary({ event: { id: "event_test", status: "draft", basicReady: false } }), "committee");
  assert.equal(action.code, "complete_event_basics");
  assert.match(action.href, /\/admin\/events\/event_test/);
});

// Case 2: overview is the first publication prerequisite.
test("case 2 overview published but registration not configured points to registration setup", () => {
  const action = chooseEventNextAction(eventSummary({ publications: { overview: "published", registration: "draft" } }), "committee");
  assert.equal(action.code, "setup_registration");
});

// Case 3: configured draft lifecycle recommends explicit open registration.
test("case 3 configured draft recommends open registration", () => {
  const action = chooseEventNextAction(eventSummary({ publications: { overview: "published", registration: "draft" }, registration: { timeState: "not_started", configReady: true, totalCount: 0, pendingCount: 0 } }), "committee");
  assert.equal(action.code, "open_registration");
  assert.equal(action.kind, "lifecycle");
});

// Cases 4-5: live registration blockers.
test("case 4 registration pending review has priority", () => {
  const action = chooseEventNextAction(eventSummary({ event: { id: "event_test", status: "registration_open", basicReady: true }, registration: { timeState: "open", configReady: true, totalCount: 20, pendingCount: 3 }, publications: { overview: "published", registration: "published" } }), "committee");
  assert.equal(action.code, "review_pending_registration");
});
test("case 5 passed registration deadline recommends close registration", () => {
  const action = chooseEventNextAction(eventSummary({ event: { id: "event_test", status: "registration_open", basicReady: true }, registration: { timeState: "closed", configReady: true, totalCount: 20, pendingCount: 3 } }), "committee");
  assert.equal(action.code, "close_registration");
  assert.equal(action.priority, 100);
});

// Cases 7-9: roster progression.
test("case 7 registration closed with reviewed roster recommends confirm roster", () => {
  const group = buildGroupWorkflow(groupFact());
  assert.equal(group.nextAction.code, "confirm_roster");
});
test("case 8 confirmed roster recommends lock roster", () => {
  const group = buildGroupWorkflow(groupFact({ rosterStatus: "confirmed", rosterCount: 462 }));
  assert.equal(group.nextAction.code, "lock_roster");
});
test("case 9 locked roster recommends qualifier one draw", () => {
  const group = buildGroupWorkflow(groupFact({ lifecycle: "in_progress", rosterStatus: "locked", rosterCount: 462 }));
  assert.equal(group.nextAction.code, "qualifier-one_draw");
});

// Cases 10-12: draw -> schedule -> score -> advancement.
test("case 10 confirmed draw recommends scheduling", () => {
  const q1 = { ...emptyPhase(), drawStatus: "confirmed" };
  const group = buildGroupWorkflow(groupFact({ lifecycle: "in_progress", rosterStatus: "locked", rosterCount: 462, phases: { ...groupFact().phases, "qualifier-one": q1 } }));
  assert.equal(group.nextAction.code, "qualifier-one_schedule");
});
test("case 11 pending matches recommend scoring", () => {
  const q1 = { drawStatus: "confirmed", scheduleStatus: "confirmed", playableMatchCount: 100, pendingResultCount: 17, confirmedResultCount: 83 };
  const group = buildGroupWorkflow(groupFact({ lifecycle: "in_progress", rosterStatus: "locked", rosterCount: 462, phases: { ...groupFact().phases, "qualifier-one": q1 } }));
  assert.equal(group.nextAction.code, "qualifier-one_scoring");
});
test("case 12 completed qualifier matches recommend advancement", () => {
  const q1 = completedPhase({ qualificationStatus: "draft" });
  const group = buildGroupWorkflow(groupFact({ lifecycle: "in_progress", rosterStatus: "locked", rosterCount: 462, phases: { ...groupFact().phases, "qualifier-one": q1 } }));
  assert.equal(group.nextAction.code, "qualifier-one_advancement");
});

// Main-field and ranking chain.
test("completed qualifiers require the 64-player main roster", () => {
  const phases = { ...groupFact().phases, "qualifier-one": completedPhase({ qualificationStatus: "confirmed" }), "qualifier-two": completedPhase({ qualificationStatus: "confirmed" }) };
  const group = buildGroupWorkflow(groupFact({ lifecycle: "in_progress", rosterStatus: "locked", rosterCount: 462, phases }));
  assert.equal(group.nextAction.code, "main_roster");
});
test("main one completion requires 32-player advancement", () => {
  const phases = {
    "qualifier-one": completedPhase({ qualificationStatus: "confirmed" }), "qualifier-two": completedPhase({ qualificationStatus: "confirmed" }),
    "main-one": completedPhase({ advancementStatus: "draft" }), "main-two": emptyPhase(),
  };
  const group = buildGroupWorkflow(groupFact({ lifecycle: "in_progress", rosterStatus: "locked", rosterCount: 462, phases, mainRosterStatus: "locked", mainRosterCount: 64 }));
  assert.equal(group.nextAction.code, "main_one_advancement");
});
test("main two completion goes directly to final ranking, not a fake advancement", () => {
  const phases = {
    "qualifier-one": completedPhase({ qualificationStatus: "confirmed" }), "qualifier-two": completedPhase({ qualificationStatus: "confirmed" }),
    "main-one": completedPhase({ advancementStatus: "confirmed" }), "main-two": completedPhase(),
  };
  const group = buildGroupWorkflow(groupFact({ lifecycle: "in_progress", rosterStatus: "locked", rosterCount: 462, phases, mainRosterStatus: "locked", mainRosterCount: 64, rankingStatus: "none" }));
  assert.equal(group.nextAction.code, "generate_ranking");
});

// Case 13: groups must keep independent progress.
test("case 13 youth groups can be at different workflow steps", () => {
  const youth = buildGroupWorkflow(groupFact({ groupId: "u16", groupName: "少年组", rosterStatus: "confirmed", rosterCount: 462 }));
  const young = buildGroupWorkflow(groupFact({ groupId: "u20", groupName: "青年组", lifecycle: "in_progress", rosterStatus: "locked", rosterCount: 560 }));
  assert.equal(youth.competition.step, "lock");
  assert.equal(young.competition.step, "draw");
  assert.notEqual(youth.nextAction.code, young.nextAction.code);
});

// Cases 14-15: site closing and historical terminal state.
test("case 14 both rankings confirmed allow explicit event finish", () => {
  const groups = [
    { groupId: "u16", groupName: "少年组", rankingStatus: "confirmed", nextAction: null },
    { groupId: "u20", groupName: "青年组", rankingStatus: "published", nextAction: null },
  ];
  const action = chooseEventNextAction(eventSummary({ event: { id: "event_test", status: "in_progress", basicReady: true }, groups, allRankingsConfirmed: true, allRankingsPublished: false }), "committee");
  assert.equal(action.code, "finish_event");
  assert.equal(action.kind, "lifecycle");
});
test("case 15 finished event never re-enters competition workflow", () => {
  const group = buildGroupWorkflow(groupFact({ lifecycle: "finished", rosterStatus: "locked", rankingStatus: "published" }));
  assert.equal(group.competition.phase, "complete");
  assert.equal(group.nextAction, null);
});

// Permission-aware recommendation.
test("referee never receives content, participant or ranking publishing recommendations", () => {
  const waiting = chooseEventNextAction(eventSummary({ event: { id: "event_test", status: "draft", basicReady: false } }), "referee");
  assert.equal(waiting.kind, "wait");
  const scoring = { code: "q1_scoring", title: "比分", description: "", href: "/admin/competition/scoring?event=event_test", priority: 80, kind: "link", lifecycleAction: null };
  const active = chooseEventNextAction(eventSummary({ event: { id: "event_test", status: "in_progress", basicReady: true }, groups: [{ nextAction: scoring }] }), "referee");
  assert.equal(active.href, scoring.href);
});

// Source contracts for server-side lifecycle safety.
test("lifecycle and roster safety cannot regress to client-only guards", async () => {
  const [eventApi, participantApi, rosterLifecycle, finalRanking, lifecycleService] = await Promise.all([
    readFile(new URL("../app/api/admin/event-management/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/participants/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/participant-roster-lifecycle.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/final-ranking-write-fast.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/event-lifecycle.ts", import.meta.url), "utf8"),
  ]);
  assert.match(eventApi, /input\.status !== current\.event\.status/);
  assert.match(participantApi, /participant-roster-lifecycle/);
  assert.match(rosterLifecycle, /status !== "registration_closed"/);
  assert.match(rosterLifecycle, /status !== "registration_closed" && status !== "in_progress"/);
  assert.doesNotMatch(finalRanking, /set status='finished'/i);
  assert.match(lifecycleService, /current\.status !== "registration_open"/);
  assert.match(lifecycleService, /current\.status !== "registration_closed"/);
  assert.match(lifecycleService, /unfinishedRankingGroups/);
  assert.match(lifecycleService, /force_finish/);
  assert.match(lifecycleService, /trimmedReason\.length < 4/);
});
