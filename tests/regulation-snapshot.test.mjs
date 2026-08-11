import assert from "node:assert/strict";
import test from "node:test";
import { createRegulationSnapshot, parseRegulationSnapshot } from "../db/regulation-snapshot-policy.mjs";

const base = {
  competitionFormat: [["资格赛", "单败", "9局5胜", "13局7胜"]],
  drawRules: ["资格赛不设种子"],
  prizeNote: "税前奖金",
  prizes: { 少年组: [["冠军", "¥1"]], 青年组: [["冠军", "¥2"]] },
};

test("published regulation snapshot keeps V1 public while V2 is only draft", () => {
  const v1 = createRegulationSnapshot({ ...base, ruleStandard: "V1" });
  let publication = { status: "published", snapshotJson: JSON.stringify(v1) };
  let liveDraft = { ...base, ruleStandard: "V1" };
  assert.equal(parseRegulationSnapshot(publication.snapshotJson, publication.status === "published")?.ruleStandard, "V1");

  liveDraft = { ...liveDraft, ruleStandard: "V2" };
  assert.equal(liveDraft.ruleStandard, "V2");
  assert.equal(parseRegulationSnapshot(publication.snapshotJson, publication.status === "published")?.ruleStandard, "V1");

  const v2 = createRegulationSnapshot(liveDraft);
  publication = { status: "published", snapshotJson: JSON.stringify(v2) };
  assert.equal(parseRegulationSnapshot(publication.snapshotJson, true)?.ruleStandard, "V2");

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

test("snapshot normalizes all regulation fields and rejects invalid versions", () => {
  const snapshot = createRegulationSnapshot({
    rule_standard: "规则",
    competition_format: [["阶段", "赛制", "少年", "青年"]],
    draw_rules: ["抽签"],
    prize_note: "奖金说明",
    prizes: { 少年组: [["冠军", "1"]], 青年组: [["冠军", "2"]] },
  });
  assert.deepEqual(Object.keys(snapshot), ["version", "ruleStandard", "competitionFormat", "drawRules", "prizeNote", "prizes"]);
  assert.equal(snapshot.version, 1);
  assert.equal(parseRegulationSnapshot(JSON.stringify({ ...snapshot, version: 2 }), true), null);
  assert.equal(parseRegulationSnapshot(null, true), null);
});
