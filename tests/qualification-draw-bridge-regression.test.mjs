import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const writerUrl = new URL("../db/draw-engine-write.ts", import.meta.url);

test("qualification draw persistence never sends row arrays through jsonb_to_recordset", async () => {
  const code = await readFile(writerUrl, "utf8");
  const drawWrite = code.slice(code.indexOf("export async function createQualificationDrawFast"));

  assert.doesNotMatch(drawWrite, /jsonb_to_recordset/);
  assert.match(code, /const DRAW_INSERT_CHUNK_SIZE = 200/);
  assert.match(code, /async function insertScalarRows/);
  assert.match(code, /await unsafe\(`\$\{insertPrefix\} values \$\{valuesSql\}`, params\)/);
  assert.match(drawWrite, /insert into public\.draw_prelim_matches/);
  assert.match(drawWrite, /insert into public\.draw_participants/);
  assert.match(drawWrite, /insert into public\.draw_slots/);
});

test("qualification draw calculation path remains unchanged around scalar persistence", async () => {
  const code = await readFile(writerUrl, "utf8");
  assert.match(code, /calculateQualificationPlan/);
  assert.match(code, /const randomSeed = randomBytes\(32\)/);
  assert.match(code, /const random = seededRandom\(randomSeed\)/);
  assert.match(code, /const randomized = shuffled\(participants, random\)/);
  assert.match(code, /balancedSpecialSlots\(plan\.bracketSize, plan\.divisionSize, specialCount, random\)/);
  assert.match(code, /direct_qualifiers: plan\.directQualifierCount/);
  assert.match(code, /rate_qualifiers: plan\.rateQualifierCount/);
});
