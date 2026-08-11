import { loadQualificationSupportRows } from "../db/qualification-support-query.mjs";

const eventId = process.env.DB_SMOKE_EVENT_ID || "event_luoyang_test_2026";
const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("test:db-smoke requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(2);
}

async function query(sql, params = []) {
  const response = await fetch(`${supabaseUrl}/functions/v1/huacai-db-bridge`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({ type: "query", query: sql, params, mode: "object" }),
  });
  const body = await response.json();
  if (!response.ok || !body.ok) throw new Error(body?.error?.message || `DB bridge returned HTTP ${response.status}`);
  return body.rows || [];
}

// This adapter makes the smoke test execute the exact shared query used by getQualificationWorkspaceDataFast().
const smokeSql = { unsafe: (sql, params) => query(sql, params) };
const [support] = await loadQualificationSupportRows(smokeSql, eventId);
if (!support) throw new Error(`No production qualification support data returned for ${eventId}.`);

const stageRows = await query(`
  select eg.name as "groupName",b.phase_code as "phaseCode",ds.id as "drawSessionId"
  from public.competition_brackets b
  join public.draw_sessions ds on ds.id=b.draw_session_id
  join public.event_groups eg on eg.id=b.group_id
  where b.event_id=$1 and b.phase_code in ('qualifier-one','qualifier-two') and ds.status='confirmed'
    and ds.version_no=(
      select max(ds2.version_no)
      from public.draw_sessions ds2
      join public.competition_brackets b2 on b2.draw_session_id=ds2.id
      where b2.event_id=b.event_id and b2.group_id=b.group_id and b2.phase_code=b.phase_code and ds2.status='confirmed'
    )
  order by eg.name,b.phase_code
`, [eventId]);

const expectedStages = ["少年组|qualifier-one", "少年组|qualifier-two", "青年组|qualifier-one", "青年组|qualifier-two"];
const actualStages = stageRows.map((stage) => `${stage.groupName}|${stage.phaseCode}`).sort();
for (const expected of expectedStages) {
  if (!actualStages.includes(expected)) throw new Error(`Missing qualification stage: ${expected}`);
}
if (actualStages.length !== 4) throw new Error(`Expected 4 qualification stages, got ${actualStages.length}.`);

const batches = support.batches || [];
const matches = support.matches || [];
const qualificationEntryCount = batches.reduce((sum, batch) => sum + (batch.entries || []).length, 0);
if (batches.length !== 4) throw new Error(`Expected 4 confirmed qualification batches, got ${batches.length}.`);
if (qualificationEntryCount !== 128) throw new Error(`Expected 128 stored qualification entries, got ${qualificationEntryCount}.`);
for (const batch of batches) {
  const entries = batch.entries || [];
  const direct = entries.filter((entry) => entry.entryType === "direct").length;
  const selectedRate = entries.filter((entry) => entry.entryType === "rate_candidate" && entry.selected).length;
  if (direct !== 16 || selectedRate !== 8) throw new Error(`${batch.drawSessionId} expected 16 direct + 8 selected rate qualifiers, got ${direct} + ${selectedRate}.`);
}

const phaseRows = await query(`
  select eg.name as "groupName",pe.phase_code as "phaseCode",count(*)::int as count
  from public.competition_phase_entries pe
  join public.event_groups eg on eg.id=pe.group_id
  where pe.event_id=$1 and pe.status='active' and pe.phase_code in ('main-one','main-two')
  group by eg.name,pe.phase_code
  order by eg.name,pe.phase_code
`, [eventId]);

for (const groupName of ["少年组", "青年组"]) {
  const main64 = phaseRows.find((row) => row.groupName === groupName && row.phaseCode === "main-one");
  const main32 = phaseRows.find((row) => row.groupName === groupName && row.phaseCode === "main-two");
  if (Number(main64?.count) !== 64) throw new Error(`${groupName} main-one expected 64 active entries, got ${main64?.count ?? 0}.`);
  if (Number(main32?.count) !== 32) throw new Error(`${groupName} main-two expected 32 active entries, got ${main32?.count ?? 0}.`);
}

console.log(JSON.stringify({
  eventId,
  qualificationStages: actualStages,
  supportMatchCount: matches.length,
  qualificationBatches: batches.length,
  qualificationEntries: qualificationEntryCount,
  phaseEntries: phaseRows,
}, null, 2));
