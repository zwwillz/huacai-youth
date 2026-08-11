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

const [workspace] = await query(`
  with latest_stages as (
    select distinct on (b.group_id,b.phase_code)
      ds.id as "drawSessionId",b.id as "bracketId",b.group_id as "groupId",eg.name as "groupName",
      b.phase_code as "phaseCode",b.division_count as "divisionCount",b.division_size as "divisionSize",
      ds.rate_qualifier_count as "rateQualifierCount",ds.version_no as "drawVersion"
    from public.competition_brackets b
    join public.draw_sessions ds on ds.id=b.draw_session_id
    join public.event_groups eg on eg.id=b.group_id
    where b.event_id=$1 and b.phase_code in ('qualifier-one','qualifier-two') and ds.status='confirmed'
    order by b.group_id,b.phase_code,ds.version_no desc
  ), relevant_matches as (
    select ls."groupName",ls."phaseCode",bm.id,bm.result_status,bm.status
    from latest_stages ls
    join public.competition_bracket_matches bm on bm.bracket_id=ls."bracketId"
    where bm.round_no=(ln(ls."divisionSize"::numeric)/ln(2))::int
      or (bm.result_status='confirmed' and bm.result_type='normal' and bm.score_a is not null and bm.score_b is not null)
  ), relevant_batches as (
    select ls."groupName",ls."phaseCode",qb.id,qb.draw_session_id as "drawSessionId",qb.confirmed_at as "confirmedAt"
    from latest_stages ls
    join public.competition_qualification_batches qb on qb.draw_session_id=ls."drawSessionId"
  ), batch_payload as (
    select b."groupName",b."phaseCode",jsonb_build_object(
      'id',b.id,
      'drawSessionId',b."drawSessionId",
      'confirmedAt',b."confirmedAt",
      'entries',coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'playerId',qe.player_id,
            'playerName',qe.player_name,
            'entryType',qe.entry_type,
            'selected',qe.selected,
            'rankNo',qe.rank_no,
            'divisionNo',qe.division_no,
            'gamesWon',qe.games_won,
            'gamesLost',qe.games_lost,
            'gameWinRateBp',qe.game_win_rate_bp,
            'netGames',qe.net_games,
            'finalMatchId',qe.final_match_id,
            'finalResultType',qe.final_result_type,
            'eligibilityStatus',qe.eligibility_status
          )
          order by case when qe.entry_type='direct' then 0 else 1 end,coalesce(qe.rank_no,999),qe.division_no
        )
        from public.competition_qualification_entries qe
        where qe.batch_id=b.id
      ),'[]'::jsonb)
    ) as payload
    from relevant_batches b
  )
  select
    (select count(*)::int from latest_stages) as "stageCount",
    coalesce((select jsonb_agg(jsonb_build_object('groupName',s."groupName",'phaseCode',s."phaseCode") order by s."groupName",s."phaseCode") from latest_stages s),'[]'::jsonb) as stages,
    (select count(*)::int from relevant_matches) as "supportMatchCount",
    (select count(*)::int from batch_payload) as "batchCount",
    coalesce((select sum(jsonb_array_length(payload->'entries'))::int from batch_payload),0) as "qualificationEntryCount"
`, [eventId]);

if (!workspace) throw new Error(`No qualification workspace data returned for ${eventId}.`);
const expectedStages = ["少年组|qualifier-one", "少年组|qualifier-two", "青年组|qualifier-one", "青年组|qualifier-two"];
const actualStages = (workspace.stages || []).map((stage) => `${stage.groupName}|${stage.phaseCode}`).sort();
for (const expected of expectedStages) {
  if (!actualStages.includes(expected)) throw new Error(`Missing qualification stage: ${expected}`);
}
if (Number(workspace.stageCount) !== 4) throw new Error(`Expected 4 qualification stages, got ${workspace.stageCount}.`);
if (Number(workspace.batchCount) !== 4) throw new Error(`Expected 4 confirmed qualification batches, got ${workspace.batchCount}.`);
if (Number(workspace.qualificationEntryCount) !== 128) throw new Error(`Expected 128 stored qualification entries, got ${workspace.qualificationEntryCount}.`);

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
  supportMatchCount: Number(workspace.supportMatchCount),
  qualificationBatches: Number(workspace.batchCount),
  qualificationEntries: Number(workspace.qualificationEntryCount),
  phaseEntries: phaseRows,
}, null, 2));
