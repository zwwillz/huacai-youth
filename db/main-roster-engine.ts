import { randomUUID } from "node:crypto";
import { getSqlClient } from "./index";

export type MainRosterSummary = {
  groupId: string;
  groupName: string;
  qualifierOneCount: number;
  qualifierTwoCount: number;
  qualifierCount: number;
  seedCount: number;
  confirmedSeedCount: number;
  replacementCount: number;
  resolvedSeedSlotCount: number;
  mainRosterCount: number;
  lockStatus: string | null;
  lockVersion: number | null;
  ready: boolean;
};

function now() { return new Date().toISOString(); }
function newId(prefix: string) { return `${prefix}_${randomUUID().replaceAll("-", "")}`; }

export async function getMainRosterSummaries(eventId: string): Promise<MainRosterSummary[]> {
  const sql = getSqlClient();
  const groups = await sql<Array<{ groupId: string; groupName: string }>>`
    select id as "groupId",name as "groupName" from public.event_groups
    where event_id=${eventId} and status='active' order by code
  `;
  const result: MainRosterSummary[] = [];
  for (const group of groups) {
    const [q1, q2, seeds, main, locks] = await Promise.all([
      sql<Array<{ count: number }>>`
        select count(*)::int as count
        from public.competition_qualification_entries qe
        join public.competition_qualification_batches qb on qb.id=qe.batch_id
        where qb.event_id=${eventId} and qb.group_id=${group.groupId} and qb.phase_code='qualifier-one'
          and qb.status='confirmed' and (qe.entry_type='direct' or qe.selected=true)
      `,
      sql<Array<{ count: number }>>`
        select count(*)::int as count
        from public.competition_qualification_entries qe
        join public.competition_qualification_batches qb on qb.id=qe.batch_id
        where qb.event_id=${eventId} and qb.group_id=${group.groupId} and qb.phase_code='qualifier-two'
          and qb.status='confirmed' and (qe.entry_type='direct' or qe.selected=true)
      `,
      sql<Array<{ total: number; confirmed: number; replacements: number; resolved: number }>>`
        select count(*)::int as total,
          count(*) filter (where attendance_status='confirmed' and status='active' and eligibility_status <> 'ineligible')::int as confirmed,
          count(*) filter (where replacement_player_id is not null and status='active')::int as replacements,
          count(*) filter (where status='active' and ((attendance_status='confirmed' and eligibility_status <> 'ineligible') or replacement_player_id is not null))::int as resolved
        from public.competition_seed_entries
        where event_id=${eventId} and group_id=${group.groupId} and status='active'
      `,
      sql<Array<{ count: number }>>`
        select count(*)::int as count from public.competition_phase_entries
        where event_id=${eventId} and group_id=${group.groupId} and phase_code='main-one' and status='active'
      `,
      sql<Array<{ status: string; versionNo: number }>>`
        select status,version_no as "versionNo" from public.competition_main_roster_locks
        where event_id=${eventId} and group_id=${group.groupId}
        order by version_no desc limit 1
      `,
    ]);
    const qualifierOneCount = q1[0]?.count ?? 0;
    const qualifierTwoCount = q2[0]?.count ?? 0;
    const seedCount = seeds[0]?.total ?? 0;
    const confirmedSeedCount = seeds[0]?.confirmed ?? 0;
    const replacementCount = seeds[0]?.replacements ?? 0;
    const resolvedSeedSlotCount = seeds[0]?.resolved ?? 0;
    const mainRosterCount = main[0]?.count ?? 0;
    const lockStatus = locks[0]?.status ?? null;
    const lockVersion = locks[0]?.versionNo ?? null;
    result.push({
      ...group,
      qualifierOneCount,
      qualifierTwoCount,
      qualifierCount: qualifierOneCount + qualifierTwoCount,
      seedCount,
      confirmedSeedCount,
      replacementCount,
      resolvedSeedSlotCount,
      mainRosterCount,
      lockStatus,
      lockVersion,
      ready: qualifierOneCount === 24 && qualifierTwoCount === 24 && resolvedSeedSlotCount === 16 && mainRosterCount === 64 && lockStatus === 'locked',
    });
  }
  return result;
}

export async function rebuildMainRosterIfReady(eventId: string, groupId: string) {
  const sql = getSqlClient();
  const qualifiers = await sql<Array<{ playerId: string; playerName: string; phaseCode: string; batchId: string }>>`
    select qe.player_id as "playerId",qe.player_name as "playerName",qb.phase_code as "phaseCode",qb.id as "batchId"
    from public.competition_qualification_entries qe
    join public.competition_qualification_batches qb on qb.id=qe.batch_id
    where qb.event_id=${eventId} and qb.group_id=${groupId} and qb.status='confirmed'
      and qb.phase_code in ('qualifier-one','qualifier-two')
      and (qe.entry_type='direct' or qe.selected=true)
    order by qb.phase_code,case when qe.entry_type='direct' then 0 else 1 end,coalesce(qe.rank_no,999),qe.division_no
  `;
  const seedRows = await sql<Array<{
    id: string; playerId: string; playerName: string; seedNo: number; attendanceStatus: string; eligibilityStatus: string;
    replacementPlayerId: string | null; replacementPlayerName: string | null;
  }>>`
    select id,player_id as "playerId",player_name as "playerName",seed_no as "seedNo",attendance_status as "attendanceStatus",
      eligibility_status as "eligibilityStatus",replacement_player_id as "replacementPlayerId",replacement_player_name as "replacementPlayerName"
    from public.competition_seed_entries
    where event_id=${eventId} and group_id=${groupId} and status='active'
    order by seed_no
  `;
  const resolvedSeeds = seedRows.flatMap((item) => {
    if (item.attendanceStatus === 'confirmed' && item.eligibilityStatus !== 'ineligible') {
      return [{ playerId: item.playerId, playerName: item.playerName, seedNo: item.seedNo, sourceRef: item.id, replacement: false }];
    }
    if (item.replacementPlayerId && item.replacementPlayerName) {
      return [{ playerId: item.replacementPlayerId, playerName: item.replacementPlayerName, seedNo: item.seedNo, sourceRef: item.id, replacement: true }];
    }
    return [];
  });
  if (qualifiers.length !== 48 || seedRows.length !== 16 || resolvedSeeds.length !== 16) {
    return { ready: false, qualifierCount: qualifiers.length, seedCount: resolvedSeeds.length, mainRosterCount: 0 };
  }

  const duplicateIds = new Set<string>();
  const seen = new Set<string>();
  for (const item of [...qualifiers, ...resolvedSeeds]) {
    if (seen.has(item.playerId)) duplicateIds.add(item.playerId);
    seen.add(item.playerId);
  }
  if (duplicateIds.size) throw new Error("正赛名单中存在重复球员，请检查种子、递补与资格赛晋级名单。\n" + [...duplicateIds].join("、"));

  const timestamp = now();
  const rows = [
    ...qualifiers.map((item, index) => ({
      id: newId("pe"), event_id: eventId, group_id: groupId, phase_code: "main-one",
      player_id: item.playerId, player_name: item.playerName, source_type: item.phaseCode === "qualifier-one" ? "qualifier_one_qualified" : "qualifier_two_qualified",
      source_ref: item.batchId, status: "active", sort_order: index + 1, created_at: timestamp, updated_at: timestamp,
    })),
    ...resolvedSeeds.map((item, index) => ({
      id: newId("pe"), event_id: eventId, group_id: groupId, phase_code: "main-one",
      player_id: item.playerId, player_name: item.playerName, source_type: "seed",
      source_ref: item.replacement ? `${item.sourceRef}:replacement` : item.sourceRef,
      status: "active", sort_order: qualifiers.length + index + 1, created_at: timestamp, updated_at: timestamp,
    })),
  ];

  await sql.begin(async (tx) => {
    await tx`delete from public.competition_phase_entries where event_id=${eventId} and group_id=${groupId} and phase_code='main-one'`;
    await tx`
      insert into public.competition_phase_entries
        (id,event_id,group_id,phase_code,player_id,player_name,source_type,source_ref,status,sort_order,created_at,updated_at)
      select x.id,x.event_id,x.group_id,x.phase_code,x.player_id,x.player_name,x.source_type,x.source_ref,x.status,x.sort_order,x.created_at,x.updated_at
      from jsonb_to_recordset(${JSON.stringify(rows)}::jsonb)
      as x(id text,event_id text,group_id text,phase_code text,player_id text,player_name text,source_type text,source_ref text,status text,sort_order int,created_at text,updated_at text)
    `;
  });
  return { ready: true, qualifierCount: qualifiers.length, seedCount: resolvedSeeds.length, mainRosterCount: rows.length };
}
