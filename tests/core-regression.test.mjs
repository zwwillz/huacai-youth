import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { shouldRestoreLegacyPublishedResults } from "../db/public-competition-legacy-policy.mjs";
import { parseRegistrationTime, registrationTimeState } from "../db/registration-time-policy.mjs";

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
  assert.match(code, /shouldRestoreLegacyPublishedResults/);
  assert.match(code, /Never read live Competition-engine results/);
});

test("legacy empty published result snapshots recover only explicit legacy results", () => {
  assert.equal(shouldRestoreLegacyPublishedResults({ isExplicitLegacy: true, snapshotMatchCount: 0, hasConfirmedLegacyResults: true }), true);
  assert.equal(shouldRestoreLegacyPublishedResults({ isExplicitLegacy: false, snapshotMatchCount: 0, hasConfirmedLegacyResults: true }), false);
  assert.equal(shouldRestoreLegacyPublishedResults({ isExplicitLegacy: true, snapshotMatchCount: 1, hasConfirmedLegacyResults: true }), false);
  assert.equal(shouldRestoreLegacyPublishedResults({ isExplicitLegacy: true, snapshotMatchCount: 0, hasConfirmedLegacyResults: false }), false);
});

test("registration public data is published snapshot plus lifecycle only", () => {
  const code = source("db/registration-publishing.ts");
  assert.match(code, /module_type='registration' and p\.status='published'/);
  assert.match(code, /p\.snapshot_json/);
  assert.match(code, /e\.status='registration_open'/);
  assert.match(code, /coalesce\(e\.is_hidden,false\)=false/);
  const publicRead = code.slice(code.indexOf("export async function getPublicRegistrationInfo"));
  assert.doesNotMatch(publicRead, /registration_state/);
});

test("registration time policy treats stored local timestamps as Asia Shanghai", () => {
  assert.equal(parseRegistrationTime("2026-08-22T18:00"), Date.parse("2026-08-22T18:00:00+08:00"));
  assert.equal(registrationTimeState("2026-08-12T00:00", "2026-08-25T23:59", Date.parse("2026-08-11T13:50:00+08:00")), "not_started");
  assert.equal(registrationTimeState("2026-08-06T00:00", "2026-08-22T18:00", Date.parse("2026-08-11T13:50:00+08:00")), "open");
  assert.equal(registrationTimeState("2026-08-06T00:00", "2026-08-10T18:00", Date.parse("2026-08-11T13:50:00+08:00")), "closed");
});

test("registration workspace remounts per event and guards stale submissions", () => {
  const page = source("app/admin/registration-publish/page.tsx");
  const client = source("app/admin/registration-publish/registration-publish-client.tsx");
  const route = source("app/api/admin/registration-publish/route.ts");
  assert.match(page, /key=\{currentEventId\}/);
  assert.match(page, /currentEventId=\{currentEventId\}/);
  assert.match(client, /currentEventId !== data\.eventId/);
  assert.match(client, /当前赛事上下文发生变化，请刷新页面后重试/);
  assert.doesNotMatch(client, /报名状态<\/span><select/);
  assert.doesNotMatch(route, /registrationState/);
});

test("registration publish validates lifecycle time and URL with clear errors", () => {
  const code = source("db/registration-publishing.ts");
  assert.match(code, /current\.eventStatus !== "registration_open"/);
  assert.match(code, /当前赛事尚未进入报名阶段/);
  assert.match(code, /请先填写完整的报名开始时间和报名截止时间/);
  assert.match(code, /当前报名截止时间已经过去/);
  assert.match(code, /报名期间必须填写有效报名入口/);
  const saveSection = code.slice(code.indexOf("export async function saveRegistrationDraft"), code.indexOf("export async function setRegistrationPublicationStatus"));
  assert.doesNotMatch(saveSection, /registration_state/);
});

test("public registration card timing and event status are derived without DB lifecycle writes", () => {
  const registration = source("db/registration-publishing.ts");
  const home = source("db/public-home.ts");
  const detail = source("app/api/public/events/[eventId]/detail/route.ts");
  const page = source("app/page.tsx");
  assert.match(registration, /state === "not_set" \|\| state === "not_started"/);
  assert.match(registration, /state === "closed"[\s\S]*报名已于/);
  assert.match(registration, /url: state === "open" \? String\(parsed\.url \|\| ""\) : ""/);
  assert.match(home, /报名即将开始/);
  assert.match(home, /报名已截止/);
  assert.match(home, /effectiveLifecycleStatus/);
  assert.match(detail, /getEffectivePublicStatus/);
  assert.match(detail, /revalidate = 60/);
  assert.match(page, /revalidate = 60/);
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

test("qualification production support query uses only scalar eventId and is shared by DB smoke", () => {
  const production = source("db/qualification-fast.ts");
  const shared = source("db/qualification-support-query.mjs");
  const smoke = source("scripts/qualification-db-smoke.mjs");
  assert.match(production, /loadQualificationSupportRows\(sql, eventId\)/);
  assert.doesNotMatch(production, /jsonb_to_recordset|stageFilter|JSON\.stringify\(stageFilter\)|drawSessionIds/);
  assert.match(shared, /with latest_stages as/);
  assert.match(shared, /b\.event_id=\$1/);
  assert.match(shared, /join public\.competition_bracket_matches bm on bm\.bracket_id=ls\."bracketId"/);
  assert.match(shared, /join public\.competition_qualification_batches qb on qb\.draw_session_id=ls\."drawSessionId"/);
  assert.match(smoke, /import \{ loadQualificationSupportRows \} from "\.\.\/db\/qualification-support-query\.mjs"/);
  assert.match(smoke, /loadQualificationSupportRows\(smokeSql, eventId\)/);
  assert.doesNotMatch(shared, /\b(insert|update|delete|alter|drop|truncate)\b/i);
  assert.match(source("package.json"), /"test:db-smoke": "node scripts\/qualification-db-smoke\.mjs"/);
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

test("scoring workspace bootstraps once and confirmed toggle cannot rebootstrap-loop", () => {
  const code = source("app/admin/competition/scoring/scoring-local-workspace-client.tsx");
  assert.match(code, /const dataRef = useRef<ScoringWorkspaceData \| null>\(initialData\)/);
  assert.match(code, /const didBootstrapRef = useRef\(Boolean\(initialData\)\)/);
  assert.match(code, /const currentData = dataRef\.current/);
  assert.match(code, /if \(initialData \|\| !initialEventId \|\| didBootstrapRef\.current\) return/);
  assert.match(code, /didBootstrapRef\.current = true/);
  const fetchStart = code.indexOf("const fetchWorkspace = useCallback");
  const fetchEnd = code.indexOf("useEffect(() => {", fetchStart);
  const fetchBlock = code.slice(fetchStart, fetchEnd);
  assert.match(fetchBlock, /\}, \[applyData, initialDate, initialGroupId, initialPhase, initialShowConfirmed\]\);/);
  assert.doesNotMatch(fetchBlock, /\[applyData, data,/);
  assert.match(code, /const toggleConfirmed = \(\) => \{[\s\S]*showConfirmed: !data\.filters\.showConfirmed, force: true/);
  assert.match(fetchBlock, /finally \{ if \(currentRequest === requestId\.current\) setLoading\(false\); \}/);
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

test("overview publication is updated inside the same overview transaction", () => {
  const overview = source("db/event-overview.ts");
  const helper = source("db/event-publication-sync.ts");
  const oldRoute = source("app/api/admin/event-management/route.ts");
  const newRoute = source("app/api/admin/event-overview/route.ts");
  assert.match(overview, /syncEventOverviewPublicationInTransaction\(tx,/);
  assert.match(helper, /tx\.insert\(publications\)/);
  assert.match(helper, /publications\.versionNo\}\+1/);
  assert.doesNotMatch(oldRoute, /syncEventOverviewPublication/);
  assert.doesNotMatch(newRoute, /syncEventOverviewPublication/);
  assert.match(oldRoute, /赛事概览发布或撤回请前往/);
});

test("existing overview publication mismatches are reconciled idempotently", () => {
  const migration = source("db/migrations/20260811_reconcile_overview_publication_state.sql");
  assert.match(migration, /p\.module_type = 'overview'/);
  assert.match(migration, /p\.status is distinct from e\.publish_status/);
  assert.match(migration, /p\.version_no \+ 1/);
  assert.match(migration, /published_by = case/);
  assert.match(migration, /published_at = case/);
  assert.doesNotMatch(migration, /insert\s+into/i);
});

test("registration lifecycle compatibility backfill is narrow and does not publish", () => {
  const migration = source("db/migrations/20260811_backfill_registration_state.sql");
  assert.match(migration, /status = 'registration_open' then 'open'/);
  assert.match(migration, /status = 'registration_closed' then 'closed'/);
  assert.match(migration, /where registration_state = 'not_open'/);
  assert.match(migration, /status in \('registration_open', 'registration_closed'\)/);
  assert.doesNotMatch(migration, /publications|snapshot|registration_url/i);
});

test("referee competition navigation never points to event or participant management", () => {
  const dashboard = source("db/competition-dashboard.ts");
  const overview = source("app/admin/competition/competition-overview-view.tsx");
  const eventRoute = source("app/admin/events/[eventId]/page.tsx");
  const drawPage = source("app/admin/competition/draw/page.tsx");
  assert.match(dashboard, /viewerRole: principal\.role/);
  assert.match(overview, /model\.viewerRole === "referee"/);
  assert.match(overview, /等待组委会确认参赛名单/);
  assert.doesNotMatch(overview, /\/admin\/events\//);
  assert.match(eventRoute, /if \(viewer\.role === "referee"\) redirect\(`\/admin\/competition\?event=/);
  assert.match(drawPage, /const refereeBlocked = viewer\.role === "referee"/);
  assert.match(drawPage, /!refereeBlocked && <a href=\{`\/admin\/participants\?event=/);
  assert.doesNotMatch(drawPage, /redirect\("\/admin\/events"\)/);
});

test("public matches initially render forty cards and load forty more", () => {
  const competition = source("app/public-competition-live-v2.tsx");
  assert.match(competition, /useState\(40\)/);
  assert.match(competition, /matches\.slice\(0, visibleCount\)/);
  assert.match(competition, /count \+ 40/);
});

test("public URL state restores event, tab and master-schedule group", () => {
  const app = source("app/event-app.tsx");
  assert.match(app, /params\.set\("event", eventId\)/);
  assert.match(app, /params\.set\("tab",/);
  assert.match(app, /window\.addEventListener\("popstate"/);
  const schedule = source("app/public-master-schedule.tsx");
  assert.match(schedule, /groupFromUrl/);
  assert.match(schedule, /params\.set\("group", next === "青年组" \? "u20" : "u16"\)/);
  assert.match(schedule, /window\.addEventListener\("popstate", restoreGroup\)/);
});

test("returning to event center clears event detail URL state", () => {
  const app = source("app/event-app.tsx");
  assert.match(app, /if \(!eventId\) return `\$\{window\.location\.pathname\}\$\{window\.location\.hash\}`/);
  assert.match(app, /if \(nextView === "event"\)[\s\S]*setSelectedId\(null\)[\s\S]*setTab\("overview"\)[\s\S]*window\.history\.pushState\(\{\}, "", eventUrl\(null\)\)/);
});

test("test events remain listed but cannot become featured when formal events exist", () => {
  const home = source("db/public-home.ts");
  assert.match(home, /isTest: events\.isTest/);
  assert.match(home, /const formalRows = yearRows\.filter\(\(row\) => !row\.isTest\)/);
  assert.match(home, /const candidates = formalRows\.length \? formalRows : yearRows/);
  assert.doesNotMatch(home, /where[\s\S]*is_test[^\n]*false/);
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
