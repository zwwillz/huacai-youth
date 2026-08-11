import assert from "node:assert/strict";
import test from "node:test";
import { createRegulationSnapshot, parseRegulationSnapshot } from "../db/regulation-snapshot-policy.mjs";

const base = {
  competitionFormat: [["资格赛", "单败", "9局5胜", "13局7胜"]],
  drawRules: ["资格赛不设种子"],
  prizeNote: "税前奖金",
  prizes: { 少年组: [["冠军", "¥1"]], 青年组: [["冠军", "¥2"]] },
  signupNote: "费用说明",
  registrationFees: { 少年组: 10000, 青年组: 20000 },
};

test("published regulation snapshot keeps V1 public while V2 is only draft", () => {
  const v1 = createRegulationSnapshot({ ...base, ruleStandard: "V1" });
  let publication = { status: "published", snapshotJson: JSON.stringify(v1) };
  let liveDraft = { ...base, ruleStandard: "V1" };
  assert.equal(parseRegulationSnapshot(publication.snapshotJson, publication.status === "published")?.ruleStandard, "V1");

  liveDraft = { ...liveDraft, ruleStandard: "V2", registrationFees: { 少年组: 30000, 青年组: 40000 } };
  assert.equal(liveDraft.ruleStandard, "V2");
  assert.equal(parseRegulationSnapshot(publication.snapshotJson, publication.status === "published")?.ruleStandard, "V1");
  assert.deepEqual(parseRegulationSnapshot(publication.snapshotJson, true)?.registrationFees, { 少年组: 10000, 青年组: 20000 });

  const v2 = createRegulationSnapshot(liveDraft);
  publication = { status: "published", snapshotJson: JSON.stringify(v2) };
  const publishedV2 = parseRegulationSnapshot(publication.snapshotJson, true);
  assert.equal(publishedV2?.ruleStandard, "V2");
  assert.deepEqual(publishedV2?.registrationFees, { 少年组: 30000, 青年组: 40000 });

  publication = { ...publication, status: "draft" };
  assert.equal(parseRegulationSnapshot(publication.snapshotJson, false), null);
});

test("empty rule standard is a valid published snapshot", () => {
  const snapshot = createRegulationSnapshot({ ...base, ruleStandard: "" });
  const parsed = parseRegulationSnapshot(JSON.stringify(snapshot), true);
  assert.ok(parsed);
  assert.equal(parsed.ruleStandard, "");
  assert.deepEqual(parsed.competitionFormat, base.competitionFormat);
});

test("snapshot normalizes all current regulation fields and supports legacy v1 reads", () => {
  const snapshot = createRegulationSnapshot({
    rule_standard: "规则",
    competition_format: [["阶段", "赛制", "少年", "青年"]],
    draw_rules: ["抽签"],
    prize_note: "奖金说明",
    prizes: { 少年组: [["冠军", "1"]], 青年组: [["冠军", "2"]] },
    signup_note: "费用说明",
    registration_fees: { 少年组: 10000, 青年组: 20000 },
  });
  assert.deepEqual(Object.keys(snapshot), ["version", "ruleStandard", "competitionFormat", "drawRules", "prizeNote", "prizes", "signupNote", "registrationFees"]);
  assert.equal(snapshot.version, 2);
  assert.deepEqual(snapshot.registrationFees, { 少年组: 10000, 青年组: 20000 });
  assert.equal(snapshot.signupNote, "费用说明");

  const legacy = { ...snapshot, version: 1 };
  delete legacy.signupNote;
  delete legacy.registrationFees;
  const parsedLegacy = parseRegulationSnapshot(JSON.stringify(legacy), true);
  assert.ok(parsedLegacy);
  assert.equal(parsedLegacy.version, 2);
  assert.deepEqual(parsedLegacy.registrationFees, { 少年组: null, 青年组: null });
  assert.equal(parsedLegacy.signupNote, "");

  assert.equal(parseRegulationSnapshot(JSON.stringify({ ...snapshot, version: 99 }), true), null);
  assert.equal(parseRegulationSnapshot(null, true), null);
});
