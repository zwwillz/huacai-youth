import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("archived events are rejected by the common write boundary", () => {
  const code = source("db/permissions.ts");
  assert.match(code, /ARCHIVED_EVENT_WRITE_MESSAGE/);
  assert.match(code, /status === "archived"/);
  assert.match(code, /if \(options\.write\) assertEventWritable/);
});

test("event asset upload requires assigned committee/admin event access", () => {
  const code = source("db/assets.ts");
  assert.match(code, /requireEventAccess\(username, input\.eventId/);
  assert.match(code, /write: true/);
  assert.match(code, /allowedRoles: \["system_admin", "committee"\]/);
});

test("formal public players require approved non-test published registrations", () => {
  const code = source("db/player-data-formal.ts");
  assert.match(code, /r\.status = 'approved'/);
  assert.match(code, /e\.publish_status = 'published'/);
  assert.match(code, /coalesce\(e\.is_test, false\) = false/);
  assert.doesNotMatch(code, /status\s*<>\s*'withdrawn'/);
});

test("new public competition data is snapshot-only while legacy fallback is explicit", () => {
  const code = source("db/public-competition-published.ts");
  assert.match(code, /not exists \(select 1 from public\.competition_brackets/);
  assert.match(code, /m\.source like 'static_%'/);
  assert.match(code, /m\.source like 'pdf_static_%'/);
  assert.match(code, /Never read live Competition-engine results/);
});

test("qualification draw API uses q1/q2 fast implementation", () => {
  const route = source("app/api/admin/competition/draw/route.ts");
  const writer = source("db/draw-engine-write.ts");
  assert.match(route, /createQualificationDrawFast/);
  assert.doesNotMatch(route, /createQualificationDraw\(/);
  assert.match(writer, /\["qualifier-one", "qualifier-two"\]/);
});

test("seed source requires prior finished published event with complete top16", () => {
  const code = source("db/seed-initialization.ts");
  assert.match(code, /e\.status in \('finished','archived'\)/);
  assert.match(code, /e\.publish_status='published'/);
  assert.match(code, /coalesce\(e\.is_test,false\)=false/);
  assert.match(code, /display_order between 1 and 16/);
  assert.match(code, /count\(distinct er\.display_order\)/);
});

test("participant locking and scoring keep server-side write guards", () => {
  assert.match(source("db/participant-roster.ts"), /requireEventAccess\([^;]+write: true/s);
  assert.match(source("db/scoring-write-fast.ts"), /write: true/);
  assert.match(source("db/scoring-write-fast.ts"), /viewer\.role === "referee" && match\.refereeUserId !== viewer\.id/);
});

test("unpublished competition writes remain dirty drafts until explicit publish", () => {
  const context = source("db/competition-context.ts");
  assert.match(context, /has_unpublished_changes=true/);
  assert.match(context, /status='draft'/);
  assert.match(context, /write: true/);
});

test("test-only performance items remain untouched in this stability round", () => {
  const app = source("app/event-app.tsx");
  assert.match(app, /warmCompetition\(next\.eventId, "entry"\)/);
  const competition = source("app/public-competition-live-v2.tsx");
  assert.match(competition, /preloadPublicCompetition/);
});
