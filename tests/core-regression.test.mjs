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

test("event management and main roster mutations use archived write guards", () => {
  const eventManagement = source("db/event-management.ts");
  assert.match(eventManagement, /requireEventEditor\(username, input\.eventId, true\)/);
  const rosterRoute = source("app/api/admin/competition/main-roster/route.ts");
  assert.match(rosterRoute, /requireEventAccess\(viewer, targetEventId/);
  assert.match(rosterRoute, /write: true/);
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

test("registration public data is also published snapshot-only", () => {
  const code = source("db/registration-publishing.ts");
  assert.match(code, /module_type='registration' and p\.status='published'/);
  assert.match(code, /p\.snapshot_json/);
  assert.match(code, /coalesce\(e\.is_hidden,false\)=false/);
});

test("qualification draw API uses q1/q2 fast implementation", () => {
  const route = source("app/api/admin/competition/draw/route.ts");
  const writer = source("db/draw-engine-write.ts");
  assert.match(route, /createQualificationDrawFast/);
  assert.doesNotMatch(route, /createQualificationDraw\(/);
  assert.match(writer, /\["qualifier-one", "qualifier-two"\]/);
});

test("legacy qualification draw entry is explicitly deprecated", () => {
  const legacy = source("db/draw-engine.ts");
  assert.match(legacy, /@deprecated Use createQualificationDrawFast/);
});

test("seed source requires prior finished published event with complete top16", () => {
  const code = source("db/seed-initialization.ts");
  assert.match(code, /e\.status in \('finished','archived'\)/);
  assert.match(code, /e\.publish_status='published'/);
  assert.match(code, /coalesce\(e\.is_test,false\)=false/);
  assert.match(code, /display_order between 1 and 16/);
  assert.match(code, /count\(distinct er\.display_order\)/);
  const safeRead = source("db/main-roster-safe.ts");
  assert.match(safeRead, /data\.groups\.map\(\(group\) => findEligiblePreviousSeedEvent\(eventId, group\.groupName\)\)/);
  assert.match(safeRead, /Boolean\(previousEvents\[index\]\)/);
});

test("participant locking and scoring keep server-side write guards", () => {
  assert.match(source("db/participant-roster.ts"), /requireEventAccess\([^;]+write: true/s);
  assert.match(source("db/scoring-write-fast.ts"), /write: true/);
  assert.match(source("db/scoring-write-fast.ts"), /viewer\.role === "referee" && match\.refereeUserId !== viewer\.id/);
});

test("unpublished competition writes remain dirty drafts until explicit publish", () => {
  const context = source("db/competition-context.ts");
  assert.match(context, /has_unpublished_changes=true/);
  assert.match(context, /'draft',true/);
  assert.match(context, /write: true/);
});

test("event overview save is one client request backed by a server transaction", () => {
  const client = source("app/admin/content/content-management-client.tsx");
  const saveStart = client.indexOf("const saveOverview");
  const saveEnd = client.indexOf("const saveRegulation", saveStart);
  const overviewSave = client.slice(saveStart, saveEnd);
  assert.match(overviewSave, /fetch\("\/api\/admin\/event-overview"/);
  assert.doesNotMatch(overviewSave, /Promise\.all/);
  assert.match(source("db/event-overview.ts"), /db\.transaction/);
});

test("public matches initially render forty cards and load forty more", () => {
  const competition = source("app/public-competition-live-v2.tsx");
  assert.match(competition, /useState\(40\)/);
  assert.match(competition, /matches\.slice\(0, visibleCount\)/);
  assert.match(competition, /count \+ 40/);
});

test("drizzle events schema tracks test and registration migration fields", () => {
  const schema = source("db/schema.ts");
  assert.match(schema, /registrationState: text\("registration_state"\)/);
  assert.match(schema, /registrationUrl: text\("registration_url"\)/);
  assert.match(schema, /isTest: boolean\("is_test"\)/);
});

test("test-only performance items remain untouched in this stability round", () => {
  const app = source("app/event-app.tsx");
  assert.match(app, /warmCompetition\(next\.eventId, "entry"\)/);
  const competition = source("app/public-competition-live-v2.tsx");
  assert.match(competition, /preloadPublicCompetition/);
});
