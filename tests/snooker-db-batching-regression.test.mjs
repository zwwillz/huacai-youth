import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const baseLoader = readFileSync(new URL("../lib/snooker/database-public.ts", import.meta.url), "utf8");
const v2Loader = readFileSync(new URL("../lib/snooker/database-public-v2.ts", import.meta.url), "utf8");

test("snooker frame reads are batched and isolated from the primary database snapshot", () => {
  assert.match(baseLoader, /const ID_FILTER_BATCH_SIZE = 32;/);
  assert.match(baseLoader, /Promise\.allSettled/);
  assert.match(baseLoader, /restInBatchesBestEffort<DbFrame>/);
  assert.match(baseLoader, /\(batch\) => `snooker_frames\?[^`]+match_id=in\.\$\{inFilter\(batch\)\}/);
  assert.doesNotMatch(baseLoader, /snooker_frames\?[^`]+inFilter\(matchIds\)/);
});

test("snooker match statistics and head-to-head enrichment use bounded id batches", () => {
  assert.match(v2Loader, /const ID_FILTER_BATCH_SIZE = 32;/);
  assert.match(v2Loader, /restInBatchesBestEffort<DbMatchStat>/);
  assert.match(v2Loader, /restInBatchesBestEffort<DbHeadToHead>/);
  assert.match(v2Loader, /match_id=in\.\$\{inFilter\(batch\)\}/);
  assert.doesNotMatch(v2Loader, /snooker_match_statistics\?[^`]+inFilter\(matchUuids\)/);
  assert.doesNotMatch(v2Loader, /snooker_match_head_to_head\?[^`]+inFilter\(matchUuids\)/);
});
