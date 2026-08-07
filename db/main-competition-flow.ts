import { randomUUID } from "node:crypto";
import { getSqlClient } from "./index";
import { rebuildMainRosterIfReady } from "./main-roster-engine";

export type SeedAttendanceStatus = "pending" | "confirmed" | "not_attending" | "ineligible" | "removed";

export type SeedSeat = {
  id: string;
  seedNo: number;
  playerId: string;
  playerName: string;
  birthDate: string | null;
  sourceType: string;
  sourceEventId: string | null;
  sourceEventTitle: string | null;
  sourceDisplayOrder: number | null;
  sourcePlacementLabel: string | null;
  eligibilityStatus: string;
  eligibilityNote: string | null;
  attendanceStatus: string;
  attendanceNote: string | null;
  replacementPlayerId: string | null;
  replacementPlayerName: string | null;
  replacementMetricValue: number | null;
  replacementInheritsSeed: boolean;
  effectivePlayerId: string | null;
  effectivePlayerName: string | null;
};

export type ReplacementCandidate = {
  playerId: string;
  playerName: string;
  phaseCode: string;
  phaseTitle: string;
  gameWinRateBp: number;
  netGames: number;
  gamesWon: number;
  gamesLost: number;
  rankNo: number | null;
};

export type MainRosterControlGroup = {
  groupId: string;
  groupName: string;
  groupCode: string;
  birthDateFrom: string | null;
  birthDateTo: string | null;
  qualifierOneCount: number;
  qualifierTwoCount: number;
  qualifierCount: number;
  seedSeats: SeedSeat[];
  replacementPool: ReplacementCandidate[];
  resolvedSeedCount: number;
  replacementCount: number;
  mainRosterCount: number;
  duplicateCount: number;
  currentLock: null | { id: string; versionNo: number; status: string; lockedAt: string; replacementCount: number };
  activeMainOneDraw: null | { id: string; versionNo: number; status: string };
  advancement: null | { id: string; status: string; winnerSideCount: number; loserSideCount: number; roster: Array<{ playerId: string; playerName: string; sourceType: string }> };
  canInitializeSeeds: boolean;
  canLock: boolean;
};

export type MainRosterControlData = {
  viewerRole: string;
  event: { id: string; shortTitle: string; year: number; stationNo: number };
  previousEvent: null | { id: string; shortTitle: string; stationNo: number };
  groups: MainRosterControlGroup[];
};

export type FinalRankingRow = {
  displayOrder: number;
  placementLabel: string;
  playerId: string;
  playerName: string;
  prizeDisplay: string;
  isExactPlace: boolean;
};

export type FinalRankingWorkspaceGroup = {
  groupId: string;
  groupName: string;
  sourceReady: boolean;
  completedMatchCount: number;
  requiredMatchCount: number;
  batch: null | { id: string; status: string; confirmedAt: string | null; publishedAt: string | null };
  rows: FinalRankingRow[];
};

export type FinalRankingWorkspaceData = {
  viewerRole: string;
  event: { id: string; shortTitle: string };
  groups: FinalRankingWorkspaceGroup[];
};

type Viewer = { id: string; role: string; displayName: string };

function now() { return new Date().toISOString(); }
function newId(prefix: string) { return `${prefix}_${randomUUID().replaceAll("-", "")}`; }
function phaseTitle(code: string) { return code === "qualifier-one" ? "资格赛第一场" : code === "qualifier-two" ? "资格赛第二场" : code === "main-one" ? "正赛第一阶段" : "正赛第二阶段"; }

async function requireViewer(username: string, write = false): Promise<Viewer> {
  const sql = getSqlClient();
  const rows = await sql<Viewer[]>`
    select id,role,display_name as "displayName" from public.users where username=${username} and status='active' limit 1
  `;
  const viewer = rows[0];
  if (!viewer || !["system_admin","committee","referee"].includes(viewer.role)) throw new Error("当前账号没有竞赛执行权限。");
  if (write && !["system_admin","committee"].includes(viewer.role)) throw new Error("该操作需要系统管理员或组委会权限。");
  return viewer;
}

function evaluateEligibility(birthDate: string | null, from: string | null, to: string | null) {
  if (!from && !to) return { status: "unknown", note: "当前组别尚未配置明确出生日期范围，请组委会人工核验。" };
  if (!birthDate) return { status: "unknown", note: "球员档案缺少出生日期，请组委会人工核验。" };
  if (from && birthDate < from) return { status: "ineligible", note: `出生日期早于本组允许范围 ${from}。` };
  if (to && birthDate > to) return { status: "ineligible", note: `出生日期晚于本组允许范围 ${to}。` };
  return { status: "eligible", note: "年龄条件符合本组设置。" };
}

async function previousEventFor(eventId: string) {
  const sql = getSqlClient();
  const current = await sql<Array<{ id: string; seriesId: string; year: number; stationNo: number }>>`
    select id,series_id as "seriesId",year,station_no as "stationNo" from public.events where id=${eventId} limit 1
  `;
  if (!current[0]) throw new Error("没有找到这场赛事。");
  const rows = await sql<Array<{ id: string; shortTitle: string; stationNo: number }>>`
    select id,short_title as "shortTitle",station_no as "stationNo" from public.events
    where series_id=${current[0].seriesId} and year=${current[0].year} and station_no < ${current[0].stationNo}
      and publish_status='published'
    order by station_no desc limit 1
  `;
  return { current: current[0], previous: rows[0] ?? null };
}

async function qualificationCount(eventId: string, groupId: string, phaseCode: string) {
  const sql = getSqlClient();
  const rows = await sql<Array<{ count: number }>>`
    select count(*)::int as count from public.competition_qualification_entries qe
    join public.competition_qualification_batches qb on qb.id=qe.batch_id
    where qb.event_id=${eventId} and qb.group_id=${groupId} and qb.phase_code=${phaseCode} and qb.status='confirmed'
      and (qe.entry_type='direct' or qe.selected=true)
  `;
  return rows[0]?.count ?? 0;
}

async function replacementPool(eventId: string, groupId: string): Promise<ReplacementCandidate[]> {
  const sql = getSqlClient();
  return sql<ReplacementCandidate[]>`
    with ranked as (
      select qe.player_id as "playerId",qe.player_name as "playerName",qb.phase_code as "phaseCode",
        qe.game_win_rate_bp as "gameWinRateBp",qe.net_games as "netGames",qe.games_won as "gamesWon",qe.games_lost as "gamesLost",qe.rank_no as "rankNo",
        row_number() over(partition by qe.player_id order by qe.game_win_rate_bp desc,qe.net_games desc,qe.games_won desc,coalesce(qe.rank_no,999)) as rn
      from public.competition_qualification_entries qe
      join public.competition_qualification_batches qb on qb.id=qe.batch_id
      where qb.event_id=${eventId} and qb.group_id=${groupId} and qb.status='confirmed'
        and qe.entry_type <> 'direct' and qe.selected=false and qe.eligibility_status='eligible'
        and not exists (
          select 1 from public.competition_qualification_entries qx
          join public.competition_qualification_batches bx on bx.id=qx.batch_id
          where bx.event_id=${eventId} and bx.group_id=${groupId} and bx.status='confirmed'
            and qx.player_id=qe.player_id and (qx.entry_type='direct' or qx.selected=true)
        )
        and not exists (
          select 1 from public.competition_seed_entries se
          where se.event_id=${eventId} and se.group_id=${groupId} and se.status='active'
            and (se.player_id=qe.player_id or se.replacement_player_id=qe.player_id)
        )
    )
    select "playerId","playerName","phaseCode",
      case when "phaseCode"='qualifier-one' then '资格赛第一场' else '资格赛第二场' end as "phaseTitle",
      "gameWinRateBp","netGames","gamesWon","gamesLost","rankNo"
    from ranked where rn=1
    order by "gameWinRateBp" desc,"netGames" desc,"gamesWon" desc,coalesce("rankNo",999),"playerName"
  `;
}

function effectiveSeat(row: Omit<SeedSeat,"effectivePlayerId"|"effectivePlayerName">) {
  if (row.attendanceStatus === "confirmed" && row.eligibilityStatus !== "ineligible") return { id: row.playerId, name: row.playerName };
  if (row.replacementPlayerId && row.replacementPlayerName) return { id: row.replacementPlayerId, name: row.replacementPlayerName };
  return { id: null, name: null };
}

export async function getMainRosterControlData(username: string, eventId: string): Promise<MainRosterControlData> {
  const viewer = await requireViewer(username);
  const sql = getSqlClient();
  const events = await sql<Array<{ id: string; shortTitle: string; year: number; stationNo: number }>>`
    select id,short_title as "shortTitle",year,station_no as "stationNo" from public.events where id=${eventId} limit 1
  `;
  if (!events[0]) throw new Error("没有找到这场赛事。");
  const { previous } = await previousEventFor(eventId);
  const groups = await sql<Array<{ groupId: string; groupName: string; groupCode: string; birthDateFrom: string | null; birthDateTo: string | null }>>`
    select id as "groupId",name as "groupName",code as "groupCode",birth_date_from as "birthDateFrom",birth_date_to as "birthDateTo"
    from public.event_groups where event_id=${eventId} and status='active' order by code
  `;
  const output: MainRosterControlGroup[] = [];
  for (const group of groups) {
    const [q1, q2, seedRows, pool, mainRows, locks, draws, advancementRows] = await Promise.all([
      qualificationCount(eventId, group.groupId, "qualifier-one"),
      qualificationCount(eventId, group.groupId, "qualifier-two"),
      sql<Array<Omit<SeedSeat,"effectivePlayerId"|"effectivePlayerName">>>`
        select se.id,se.seed_no as "seedNo",se.player_id as "playerId",se.player_name as "playerName",p.birth_date as "birthDate",
          se.source_type as "sourceType",se.source_event_id as "sourceEventId",src.short_title as "sourceEventTitle",
          se.source_display_order as "sourceDisplayOrder",se.source_placement_label as "sourcePlacementLabel",
          se.eligibility_status as "eligibilityStatus",se.eligibility_note as "eligibilityNote",se.attendance_status as "attendanceStatus",se.attendance_note as "attendanceNote",
          se.replacement_player_id as "replacementPlayerId",se.replacement_player_name as "replacementPlayerName",se.replacement_metric_value as "replacementMetricValue",
          se.replacement_inherits_seed as "replacementInheritsSeed"
        from public.competition_seed_entries se
        left join public.players p on p.id=se.player_id
        left join public.events src on src.id=se.source_event_id
        where se.event_id=${eventId} and se.group_id=${group.groupId} and se.status='active'
        order by se.seed_no
      `,
      replacementPool(eventId, group.groupId),
      sql<Array<{ count: number }>>`select count(*)::int as count from public.competition_phase_entries where event_id=${eventId} and group_id=${group.groupId} and phase_code='main-one' and status='active'`,
      sql<Array<{ id: string; versionNo: number; status: string; lockedAt: string; replacementCount: number }>>`
        select id,version_no as "versionNo",status,locked_at as "lockedAt",replacement_count as "replacementCount"
        from public.competition_main_roster_locks where event_id=${eventId} and group_id=${group.groupId} order by version_no desc limit 1
      `,
      sql<Array<{ id: string; versionNo: number; status: string }>>`
        select id,version_no as "versionNo",status from public.draw_sessions
        where event_id=${eventId} and group_id=${group.groupId} and phase_code='main-one' and status in ('draft','confirmed')
        order by version_no desc limit 1
      `,
      sql<Array<{ id: string; status: string; winnerSideCount: number; loserSideCount: number; roster: unknown }>>`
        select id,status,winner_side_count as "winnerSideCount",loser_side_count as "loserSideCount",roster_json as roster
        from public.competition_main_advancement_batches where event_id=${eventId} and group_id=${group.groupId} order by created_at desc limit 1
      `,
    ]);
    const seedSeats = seedRows.map((row) => { const effective = effectiveSeat(row); return { ...row, effectivePlayerId: effective.id, effectivePlayerName: effective.name }; });
    const effectiveIds = seedSeats.flatMap((seat) => seat.effectivePlayerId ? [seat.effectivePlayerId] : []);
    const duplicateCount = effectiveIds.length - new Set(effectiveIds).size;
    const resolvedSeedCount = effectiveIds.length;
    const replacementCount = seedSeats.filter((seat) => seat.replacementPlayerId).length;
    const currentLock = locks[0] ?? null;
    const advancement = advancementRows[0] ? {
      id: advancementRows[0].id,
      status: advancementRows[0].status,
      winnerSideCount: advancementRows[0].winnerSideCount,
      loserSideCount: advancementRows[0].loserSideCount,
      roster: Array.isArray(advancementRows[0].roster) ? advancementRows[0].roster as Array<{ playerId: string; playerName: string; sourceType: string }> : [],
    } : null;
    output.push({
      ...group,
      qualifierOneCount: q1,
      qualifierTwoCount: q2,
      qualifierCount: q1 + q2,
      seedSeats,
      replacementPool: pool,
      resolvedSeedCount,
      replacementCount,
      mainRosterCount: mainRows[0]?.count ?? 0,
      duplicateCount,
      currentLock,
      activeMainOneDraw: draws[0] ?? null,
      advancement,
      canInitializeSeeds: Boolean(previous) && seedSeats.length === 0 && !draws[0],
      canLock: q1 === 24 && q2 === 24 && seedSeats.length === 16 && resolvedSeedCount === 16 && duplicateCount === 0 && !draws[0] && currentLock?.status !== 'locked',
    });
  }
  return { viewerRole: viewer.role, event: events[0], previousEvent: previous, groups: output };
}

export async function initializeSeedsFromPreviousStation(username: string, eventId: string, groupId: string) {
  const viewer = await requireViewer(username, true);
  const sql = getSqlClient();
  const { previous } = await previousEventFor(eventId);
  if (!previous) throw new Error("没有找到可以作为种子来源的上一站赛事。");
  const groupRows = await sql<Array<{ name: string; birthDateFrom: string | null; birthDateTo: string | null }>>`
    select name,birth_date_from as "birthDateFrom",birth_date_to as "birthDateTo" from public.event_groups where id=${groupId} and event_id=${eventId} limit 1
  `;
  const group = groupRows[0]; if (!group) throw new Error("没有找到当前组别。");
  const activeDraw = await sql<Array<{ count: number }>>`select count(*)::int as count from public.draw_sessions where event_id=${eventId} and group_id=${groupId} and phase_code='main-one' and status in ('draft','confirmed')`;
  if ((activeDraw[0]?.count ?? 0) > 0) throw new Error("正赛第一阶段已经抽签，不能重建种子名单。请先作废抽签。\n");
  const existing = await sql<Array<{ count: number }>>`select count(*)::int as count from public.competition_seed_entries where event_id=${eventId} and group_id=${groupId} and status='active'`;
  if ((existing[0]?.count ?? 0) > 0) throw new Error("当前已经有种子候选名单。如需重建，请先处理现有名单。\n");
  const rows = await sql<Array<{ playerId: string | null; playerName: string; displayOrder: number; placementLabel: string; birthDate: string | null }>>`
    select er.player_id as "playerId",er.player_name as "playerName",er.display_order as "displayOrder",er.placement_label as "placementLabel",p.birth_date as "birthDate"
    from public.event_rankings er
    join public.event_groups peg on peg.id=er.group_id
    left join public.players p on p.id=er.player_id
    where er.event_id=${previous.id} and er.status='published' and peg.name=${group.name} and er.display_order<=16
    order by er.display_order limit 16
  `;
  if (rows.length !== 16 || rows.some((row) => !row.playerId)) throw new Error(`上一站${group.name}没有完整的16强球员ID，暂时不能自动生成种子候选。`);
  const timestamp = now();
  const inserts = rows.map((row, index) => {
    const eligibility = evaluateEligibility(row.birthDate, group.birthDateFrom, group.birthDateTo);
    return {
      id: newId("seed"), event_id: eventId, group_id: groupId, player_id: row.playerId!, player_name: row.playerName, seed_no: index + 1,
      attendance_status: eligibility.status === 'ineligible' ? 'ineligible' : 'pending', status: 'active', source_event_id: previous.id,
      source_display_order: row.displayOrder, source_placement_label: row.placementLabel, source_type: 'previous_station_top16',
      eligibility_status: eligibility.status, eligibility_note: eligibility.note, created_at: timestamp, updated_at: timestamp,
    };
  });
  await sql.begin(async (tx) => {
    await tx`insert into public.competition_seed_entries
      (id,event_id,group_id,player_id,player_name,seed_no,attendance_status,status,source_event_id,source_display_order,source_placement_label,source_type,eligibility_status,eligibility_note,created_at,updated_at)
      select x.id,x.event_id,x.group_id,x.player_id,x.player_name,x.seed_no,x.attendance_status,x.status,x.source_event_id,x.source_display_order,x.source_placement_label,x.source_type,x.eligibility_status,x.eligibility_note,x.created_at,x.updated_at
      from jsonb_to_recordset(${JSON.stringify(inserts)}::jsonb) as x(id text,event_id text,group_id text,player_id text,player_name text,seed_no int,attendance_status text,status text,source_event_id text,source_display_order int,source_placement_label text,source_type text,eligibility_status text,eligibility_note text,created_at text,updated_at text)`;
    await tx`insert into public.audit_logs (id,actor_user_id,event_id,module_type,target_type,target_id,action,after_json,created_at)
      values (${newId('log')},${viewer.id},${eventId},'competition','seed_roster',${groupId},'initialize_seeds_from_previous_station',${JSON.stringify({ previousEventId: previous.id, count: inserts.length })},${timestamp})`;
  });
  return { ok: true, count: inserts.length };
}

export async function updateSeedAttendance(username: string, seedEntryId: string, attendanceStatus: SeedAttendanceStatus, note?: string) {
  const viewer = await requireViewer(username, true);
  if (!["pending","confirmed","not_attending","ineligible","removed"].includes(attendanceStatus)) throw new Error("不支持的种子状态。");
  const sql = getSqlClient();
  const rows = await sql<Array<{ eventId: string; eligibilityStatus: string }>>`select event_id as "eventId",eligibility_status as "eligibilityStatus" from public.competition_seed_entries where id=${seedEntryId} limit 1`;
  if (!rows[0]) throw new Error("没有找到这名种子候选。");
  if (attendanceStatus === 'confirmed' && rows[0].eligibilityStatus === 'ineligible') throw new Error("该球员已被标记为年龄/资格不符合，不能直接确认参赛。请先更正资格状态或使用递补。\n");
  const timestamp = now();
  await sql.begin(async (tx) => {
    await tx`update public.competition_seed_entries set attendance_status=${attendanceStatus},attendance_note=${String(note || '').trim() || null},
      replacement_player_id=case when ${attendanceStatus}='confirmed' then null else replacement_player_id end,
      replacement_player_name=case when ${attendanceStatus}='confirmed' then null else replacement_player_name end,
      replacement_source_type=case when ${attendanceStatus}='confirmed' then null else replacement_source_type end,
      replacement_source_ref=case when ${attendanceStatus}='confirmed' then null else replacement_source_ref end,
      replacement_metric_value=case when ${attendanceStatus}='confirmed' then null else replacement_metric_value end,
      confirmed_by=${attendanceStatus === 'confirmed' ? viewer.id : null},confirmed_at=${attendanceStatus === 'confirmed' ? timestamp : null},updated_at=${timestamp}
      where id=${seedEntryId}`;
    await tx`insert into public.audit_logs (id,actor_user_id,event_id,module_type,target_type,target_id,action,after_json,created_at)
      values (${newId('log')},${viewer.id},${rows[0].eventId},'competition','seed_entry',${seedEntryId},'update_seed_status',${JSON.stringify({ attendanceStatus, note: note || null })},${timestamp})`;
  });
  return { ok: true };
}

export async function confirmAllAvailableSeeds(username: string, eventId: string, groupId: string) {
  const viewer = await requireViewer(username, true); const sql = getSqlClient(); const timestamp = now();
  await sql.begin(async (tx) => {
    await tx`update public.competition_seed_entries set attendance_status='confirmed',confirmed_by=${viewer.id},confirmed_at=${timestamp},updated_at=${timestamp}
      where event_id=${eventId} and group_id=${groupId} and status='active' and attendance_status='pending' and eligibility_status <> 'ineligible'`;
    await tx`insert into public.audit_logs (id,actor_user_id,event_id,module_type,target_type,target_id,action,created_at)
      values (${newId('log')},${viewer.id},${eventId},'competition','seed_roster',${groupId},'confirm_available_seeds',${timestamp})`;
  });
  return { ok: true };
}

export async function assignSeedReplacement(username: string, seedEntryId: string, playerId: string) {
  const viewer = await requireViewer(username, true); const sql = getSqlClient();
  const seats = await sql<Array<{ eventId: string; groupId: string; attendanceStatus: string; playerId: string }>>`
    select event_id as "eventId",group_id as "groupId",attendance_status as "attendanceStatus",player_id as "playerId" from public.competition_seed_entries where id=${seedEntryId} and status='active' limit 1
  `;
  const seat = seats[0]; if (!seat) throw new Error("没有找到种子席位。");
  if (seat.attendanceStatus === 'confirmed') throw new Error("该种子已经确认参赛，不需要递补。\n");
  const pool = await replacementPool(seat.eventId, seat.groupId); const candidate = pool.find((item) => item.playerId === playerId);
  if (!candidate) throw new Error("该球员当前不在可用的局胜率递补池中。");
  const duplicate = await sql<Array<{ count: number }>>`
    select count(*)::int as count from public.competition_seed_entries where event_id=${seat.eventId} and group_id=${seat.groupId} and status='active'
      and id<>${seedEntryId} and (player_id=${playerId} or replacement_player_id=${playerId})
  `;
  if ((duplicate[0]?.count ?? 0) > 0) throw new Error("该球员已经占用其他种子/递补席位。");
  const timestamp = now();
  await sql.begin(async (tx) => {
    await tx`update public.competition_seed_entries set replacement_player_id=${candidate.playerId},replacement_player_name=${candidate.playerName},
      replacement_source_type='qualification_game_win_rate',replacement_source_ref=${candidate.phaseCode},replacement_metric_value=${candidate.gameWinRateBp},replacement_inherits_seed=true,updated_at=${timestamp}
      where id=${seedEntryId}`;
    await tx`insert into public.audit_logs (id,actor_user_id,event_id,module_type,target_type,target_id,action,after_json,created_at)
      values (${newId('log')},${viewer.id},${seat.eventId},'competition','seed_entry',${seedEntryId},'assign_seed_replacement',${JSON.stringify({ playerId: candidate.playerId, playerName: candidate.playerName, gameWinRateBp: candidate.gameWinRateBp, phaseCode: candidate.phaseCode })},${timestamp})`;
  });
  return { ok: true };
}

export async function clearSeedReplacement(username: string, seedEntryId: string) {
  const viewer = await requireViewer(username, true); const sql = getSqlClient(); const timestamp = now();
  const rows = await sql<Array<{ eventId: string }>>`select event_id as "eventId" from public.competition_seed_entries where id=${seedEntryId} limit 1`;
  if (!rows[0]) throw new Error("没有找到种子席位。");
  await sql.begin(async (tx) => {
    await tx`update public.competition_seed_entries set replacement_player_id=null,replacement_player_name=null,replacement_source_type=null,replacement_source_ref=null,replacement_metric_value=null,updated_at=${timestamp} where id=${seedEntryId}`;
    await tx`insert into public.audit_logs (id,actor_user_id,event_id,module_type,target_type,target_id,action,created_at) values (${newId('log')},${viewer.id},${rows[0].eventId},'competition','seed_entry',${seedEntryId},'clear_seed_replacement',${timestamp})`;
  });
  return { ok: true };
}

export async function lockMainRoster(username: string, eventId: string, groupId: string) {
  const viewer = await requireViewer(username, true); const sql = getSqlClient();
  const draws = await sql<Array<{ count: number }>>`select count(*)::int as count from public.draw_sessions where event_id=${eventId} and group_id=${groupId} and phase_code='main-one' and status in ('draft','confirmed')`;
  if ((draws[0]?.count ?? 0) > 0) throw new Error("正赛第一阶段已经有抽签版本，不能重新锁定名单。若需调整，请先作废抽签。\n");
  const rebuilt = await rebuildMainRosterIfReady(eventId, groupId);
  if (!rebuilt.ready || rebuilt.mainRosterCount !== 64) throw new Error(`正赛名单尚未完整：资格赛${rebuilt.qualifierCount}/48，种子/递补${rebuilt.seedCount}/16。`);
  const roster = await sql<Array<{ playerId: string; playerName: string; sourceType: string; sourceRef: string | null; sortOrder: number }>>`
    select player_id as "playerId",player_name as "playerName",source_type as "sourceType",source_ref as "sourceRef",sort_order as "sortOrder"
    from public.competition_phase_entries where event_id=${eventId} and group_id=${groupId} and phase_code='main-one' and status='active' order by sort_order
  `;
  const duplicateCount = roster.length - new Set(roster.map((item) => item.playerId)).size;
  if (duplicateCount) throw new Error("正赛64人名单存在重复球员，不能锁定。\n");
  const seedStats = await sql<Array<{ replacements: number }>>`select count(*) filter(where replacement_player_id is not null)::int as replacements from public.competition_seed_entries where event_id=${eventId} and group_id=${groupId} and status='active'`;
  const versions = await sql<Array<{ value: number }>>`select coalesce(max(version_no),0)::int as value from public.competition_main_roster_locks where event_id=${eventId} and group_id=${groupId}`;
  const versionNo = (versions[0]?.value ?? 0) + 1; const timestamp = now(); const id = newId('mlock');
  await sql.begin(async (tx) => {
    await tx`update public.competition_main_roster_locks set status='void',voided_by=${viewer.id},voided_at=${timestamp},void_reason='新版本名单锁定',updated_at=${timestamp} where event_id=${eventId} and group_id=${groupId} and status='locked'`;
    await tx`insert into public.competition_main_roster_locks
      (id,event_id,group_id,version_no,status,qualifier_count,seed_slot_count,replacement_count,duplicate_count,eligibility_issue_count,roster_json,locked_by,locked_at,created_at,updated_at)
      values (${id},${eventId},${groupId},${versionNo},'locked',48,16,${seedStats[0]?.replacements ?? 0},0,0,${JSON.stringify(roster)}::jsonb,${viewer.id},${timestamp},${timestamp},${timestamp})`;
    await tx`insert into public.audit_logs (id,actor_user_id,event_id,module_type,target_type,target_id,action,after_json,created_at)
      values (${newId('log')},${viewer.id},${eventId},'competition','main_roster_lock',${id},'lock_main_roster',${JSON.stringify({ versionNo, rosterCount: 64, replacementCount: seedStats[0]?.replacements ?? 0 })},${timestamp})`;
  });
  return { ok: true, id, versionNo };
}

export async function voidMainRosterLock(username: string, lockId: string, reason: string) {
  const viewer = await requireViewer(username, true); const sql = getSqlClient();
  const rows = await sql<Array<{ eventId: string; groupId: string; status: string }>>`select event_id as "eventId",group_id as "groupId",status from public.competition_main_roster_locks where id=${lockId} limit 1`;
  const lock = rows[0]; if (!lock) throw new Error("没有找到正赛名单锁定版本。");
  const draws = await sql<Array<{ count: number }>>`select count(*)::int as count from public.draw_sessions where event_id=${lock.eventId} and group_id=${lock.groupId} and phase_code='main-one' and status in ('draft','confirmed')`;
  if ((draws[0]?.count ?? 0) > 0) throw new Error("已有正赛抽签，不能直接解锁名单。请先作废正赛抽签。\n");
  const timestamp = now();
  await sql.begin(async (tx) => {
    await tx`update public.competition_main_roster_locks set status='void',voided_by=${viewer.id},voided_at=${timestamp},void_reason=${String(reason || '').trim() || '人工解锁'},updated_at=${timestamp} where id=${lockId}`;
    await tx`insert into public.audit_logs (id,actor_user_id,event_id,module_type,target_type,target_id,action,after_json,created_at) values (${newId('log')},${viewer.id},${lock.eventId},'competition','main_roster_lock',${lockId},'void_main_roster_lock',${JSON.stringify({ reason })},${timestamp})`;
  });
  return { ok: true };
}

export async function prepareMain32Advancement(eventId: string, groupId: string) {
  const sql = getSqlClient();
  const sessions = await sql<Array<{ id: string }>>`select id from public.draw_sessions where event_id=${eventId} and group_id=${groupId} and phase_code='main-one' and status='confirmed' order by version_no desc limit 1`;
  const sessionId = sessions[0]?.id; if (!sessionId) return { ready: false, count: 0 };
  const rows = await sql<Array<{ id: string; roundName: string; winnerPlayerId: string | null; winnerPlayerName: string | null; resultStatus: string; divisionNo: number | null; matchCode: string }>>`
    select id,round_name as "roundName",winner_player_id as "winnerPlayerId",winner_player_name as "winnerPlayerName",result_status as "resultStatus",division_no as "divisionNo",match_code as "matchCode"
    from public.competition_bracket_matches where draw_session_id=${sessionId} and round_name in ('胜部晋级轮','败部晋级轮') order by division_no,match_code
  `;
  const completed = rows.filter((row) => row.resultStatus === 'confirmed' && row.winnerPlayerId && row.winnerPlayerName);
  if (rows.length !== 32 || completed.length !== 32) return { ready: false, count: completed.length };
  const roster = rows.map((row) => ({ playerId: row.winnerPlayerId!, playerName: row.winnerPlayerName!, sourceType: row.roundName === '胜部晋级轮' ? 'winner_side_qualified' : 'loser_side_qualified', sourceRef: row.id, divisionNo: row.divisionNo, matchCode: row.matchCode }));
  const existing = await sql<Array<{ id: string; status: string }>>`select id,status from public.competition_main_advancement_batches where source_draw_session_id=${sessionId} limit 1`;
  if (existing[0]) return { ready: true, count: 32, batchId: existing[0].id, status: existing[0].status };
  const timestamp = now(); const id = newId('adv');
  await sql`insert into public.competition_main_advancement_batches (id,event_id,group_id,source_draw_session_id,status,winner_side_count,loser_side_count,roster_json,created_at,updated_at)
    values (${id},${eventId},${groupId},${sessionId},'draft',16,16,${JSON.stringify(roster)}::jsonb,${timestamp},${timestamp})`;
  return { ready: true, count: 32, batchId: id, status: 'draft' };
}

export async function confirmMain32Advancement(username: string, batchId: string) {
  const viewer = await requireViewer(username, true); const sql = getSqlClient();
  const rows = await sql<Array<{ eventId: string; groupId: string; sourceDrawSessionId: string; status: string; roster: unknown }>>`
    select event_id as "eventId",group_id as "groupId",source_draw_session_id as "sourceDrawSessionId",status,roster_json as roster from public.competition_main_advancement_batches where id=${batchId} limit 1
  `;
  const batch = rows[0]; if (!batch) throw new Error("没有找到32强确认批次。");
  if (batch.status === 'confirmed') return { ok: true, count: 32 };
  const active = await sql<Array<{ count: number }>>`select count(*)::int as count from public.draw_sessions where event_id=${batch.eventId} and group_id=${batch.groupId} and phase_code='main-two' and status in ('draft','confirmed')`;
  if ((active[0]?.count ?? 0) > 0) throw new Error("正赛第二阶段已经抽签，不能重新确认32强名单。\n");
  const roster = Array.isArray(batch.roster) ? batch.roster as Array<{ playerId: string; playerName: string; sourceType: string; sourceRef: string }> : [];
  if (roster.length !== 32 || new Set(roster.map((item) => item.playerId)).size !== 32) throw new Error("32强名单不完整或存在重复球员。\n");
  const timestamp = now(); const mapped = roster.map((item,index) => ({ id:newId('pe'),event_id:batch.eventId,group_id:batch.groupId,phase_code:'main-two',player_id:item.playerId,player_name:item.playerName,source_type:item.sourceType,source_ref:item.sourceRef,status:'active',sort_order:index+1,created_at:timestamp,updated_at:timestamp }));
  await sql.begin(async (tx) => {
    await tx`delete from public.competition_phase_entries where event_id=${batch.eventId} and group_id=${batch.groupId} and phase_code='main-two'`;
    await tx`insert into public.competition_phase_entries (id,event_id,group_id,phase_code,player_id,player_name,source_type,source_ref,status,sort_order,created_at,updated_at)
      select x.id,x.event_id,x.group_id,x.phase_code,x.player_id,x.player_name,x.source_type,x.source_ref,x.status,x.sort_order,x.created_at,x.updated_at
      from jsonb_to_recordset(${JSON.stringify(mapped)}::jsonb) as x(id text,event_id text,group_id text,phase_code text,player_id text,player_name text,source_type text,source_ref text,status text,sort_order int,created_at text,updated_at text)`;
    await tx`update public.competition_main_advancement_batches set status='confirmed',confirmed_by=${viewer.id},confirmed_at=${timestamp},updated_at=${timestamp} where id=${batchId}`;
    await tx`insert into public.audit_logs (id,actor_user_id,event_id,module_type,target_type,target_id,action,after_json,created_at) values (${newId('log')},${viewer.id},${batch.eventId},'competition','main_advancement',${batchId},'confirm_main_32',${JSON.stringify({ count: 32 })},${timestamp})`;
  });
  return { ok: true, count: 32 };
}

function loserOf(match: { playerAId: string | null; playerAName: string | null; playerBId: string | null; playerBName: string | null; winnerPlayerId: string | null }) {
  if (!match.winnerPlayerId) return null;
  if (match.playerAId === match.winnerPlayerId && match.playerBId && match.playerBName) return { playerId: match.playerBId, playerName: match.playerBName };
  if (match.playerBId === match.winnerPlayerId && match.playerAId && match.playerAName) return { playerId: match.playerAId, playerName: match.playerAName };
  return null;
}

function parsePrizeAmount(value: string) { const digits = value.replace(/[^0-9]/g,''); return digits ? Number(digits) * 100 : 0; }

export async function prepareFinalRankingDraft(eventId: string, groupId: string) {
  const sql = getSqlClient();
  const sessions = await sql<Array<{ id: string }>>`select id from public.draw_sessions where event_id=${eventId} and group_id=${groupId} and phase_code='main-two' and status='confirmed' order by version_no desc limit 1`;
  const sessionId = sessions[0]?.id; if (!sessionId) return { ready: false, count: 0 };
  const matches = await sql<Array<{ id: string; matchType: string; roundNo: number; roundName: string; sortOrder: number; playerAId: string | null; playerAName: string | null; playerBId: string | null; playerBName: string | null; winnerPlayerId: string | null; winnerPlayerName: string | null; resultStatus: string }>>`
    select id,match_type as "matchType",round_no as "roundNo",round_name as "roundName",sort_order as "sortOrder",player_a_id as "playerAId",player_a_name as "playerAName",player_b_id as "playerBId",player_b_name as "playerBName",winner_player_id as "winnerPlayerId",winner_player_name as "winnerPlayerName",result_status as "resultStatus"
    from public.competition_bracket_matches where draw_session_id=${sessionId} and match_type in ('main_single','third_place') order by sort_order
  `;
  const completed = matches.filter((match) => match.resultStatus === 'confirmed').length;
  if (matches.length !== 32 || completed !== 32) return { ready: false, count: completed };
  const existingBatch = await sql<Array<{ id: string; status: string }>>`select id,status from public.competition_final_ranking_batches where source_draw_session_id=${sessionId} limit 1`;
  if (existingBatch[0]) return { ready: true, count: 32, batchId: existingBatch[0].id, status: existingBatch[0].status };
  const groupRows = await sql<Array<{ groupName: string }>>`select name as "groupName" from public.event_groups where id=${groupId} limit 1`;
  const groupName = groupRows[0]?.groupName; if (!groupName) throw new Error("没有找到组别。");
  const detailRows = await sql<Array<{ prizes: unknown }>>`select prizes from public.event_details where event_id=${eventId} limit 1`;
  const prizeObject = detailRows[0]?.prizes && typeof detailRows[0].prizes === 'object' ? detailRows[0].prizes as Record<string, unknown> : {};
  const prizeList = Array.isArray(prizeObject[groupName]) ? prizeObject[groupName] as Array<[string,string]> : [];
  const prizeMap = new Map(prizeList.map((item) => [String(item[0]),String(item[1])]));
  const final = matches.find((match) => match.matchType === 'main_single' && match.roundNo === 5 && match.roundName === '决赛');
  const third = matches.find((match) => match.matchType === 'third_place');
  if (!final?.winnerPlayerId || !final.winnerPlayerName || !third?.winnerPlayerId || !third.winnerPlayerName) throw new Error("决赛或三、四名决赛结果不完整。");
  const runner = loserOf(final); const fourth = loserOf(third); if (!runner || !fourth) throw new Error("无法识别亚军或殿军。");
  const tier = (roundNo: number) => matches.filter((match) => match.matchType === 'main_single' && match.roundNo === roundNo).map((match) => ({ match, loser: loserOf(match) })).filter((item): item is { match: typeof matches[number]; loser: { playerId: string; playerName: string } } => Boolean(item.loser)).sort((a,b) => a.match.sortOrder-b.match.sortOrder);
  const qf = tier(3), r16 = tier(2), r32 = tier(1);
  if (qf.length !== 4 || r16.length !== 8 || r32.length !== 16) throw new Error("淘汰轮次结果不完整，无法生成32强最终排名。");
  const make = (displayOrder:number,placementLabel:string,player:{playerId:string;playerName:string},exact:boolean): FinalRankingRow => ({ displayOrder,placementLabel,playerId:player.playerId,playerName:player.playerName,prizeDisplay:prizeMap.get(placementLabel) || '',isExactPlace:exact });
  const ranking: FinalRankingRow[] = [
    make(1,'冠军',{playerId:final.winnerPlayerId,playerName:final.winnerPlayerName},true),
    make(2,'亚军',runner,true),
    make(3,'季军',{playerId:third.winnerPlayerId,playerName:third.winnerPlayerName},true),
    make(4,'殿军',fourth,true),
    ...qf.map((item,index)=>make(5+index,'8强',item.loser,false)),
    ...r16.map((item,index)=>make(9+index,'16强',item.loser,false)),
    ...r32.map((item,index)=>make(17+index,'32强',item.loser,false)),
  ];
  if (new Set(ranking.map((item)=>item.playerId)).size !== 32) throw new Error("最终排名存在重复球员，请检查赛果流转。");
  const timestamp=now(); const batchId=newId('rankbatch');
  const dbRows=ranking.map((item)=>({ id:newId('rank'),event_id:eventId,group_id:groupId,player_id:item.playerId,player_name:item.playerName,display_order:item.displayOrder,placement_label:item.placementLabel,prize_amount_cents:parsePrizeAmount(item.prizeDisplay),prize_display:item.prizeDisplay,is_exact_place:item.isExactPlace,ranking_basis:item.isExactPlace?'competition_exact_place':'competition_elimination_tier',source:'competition_engine',note:item.isExactPlace?null:'同档位按签表比赛顺序展示',status:'draft',created_at:timestamp,updated_at:timestamp }));
  await sql.begin(async (tx)=>{
    const published=await tx<Array<{count:number}>>`select count(*)::int as count from public.event_rankings where event_id=${eventId} and group_id=${groupId} and status='published'`;
    if((published[0]?.count??0)>0) throw new Error("该组别已经发布正式排名，如需更正请走排名更正流程。\n");
    await tx`delete from public.event_rankings where event_id=${eventId} and group_id=${groupId} and status<>'published'`;
    await tx`insert into public.event_rankings (id,event_id,group_id,player_id,player_name,display_order,placement_label,prize_amount_cents,prize_display,is_exact_place,ranking_basis,source,note,status,created_at,updated_at)
      select x.id,x.event_id,x.group_id,x.player_id,x.player_name,x.display_order,x.placement_label,x.prize_amount_cents,x.prize_display,x.is_exact_place,x.ranking_basis,x.source,x.note,x.status,x.created_at,x.updated_at
      from jsonb_to_recordset(${JSON.stringify(dbRows)}::jsonb) as x(id text,event_id text,group_id text,player_id text,player_name text,display_order int,placement_label text,prize_amount_cents int,prize_display text,is_exact_place boolean,ranking_basis text,source text,note text,status text,created_at text,updated_at text)`;
    await tx`insert into public.competition_final_ranking_batches (id,event_id,group_id,source_draw_session_id,status,ranking_json,created_at,updated_at) values (${batchId},${eventId},${groupId},${sessionId},'draft',${JSON.stringify(ranking)}::jsonb,${timestamp},${timestamp})`;
  });
  return { ready:true,count:32,batchId,status:'draft' };
}

export async function ensureFinalRankingDrafts(eventId: string) {
  const sql=getSqlClient(); const groups=await sql<Array<{id:string}>>`select id from public.event_groups where event_id=${eventId} and status='active'`;
  for(const group of groups){ try{ await prepareFinalRankingDraft(eventId,group.id); } catch { /* 页面读取不因尚未满足条件而失败 */ } }
}

export async function getFinalRankingWorkspaceData(username:string,eventId:string):Promise<FinalRankingWorkspaceData>{
  const viewer=await requireViewer(username); await ensureFinalRankingDrafts(eventId); const sql=getSqlClient();
  const events=await sql<Array<{id:string;shortTitle:string}>>`select id,short_title as "shortTitle" from public.events where id=${eventId} limit 1`; if(!events[0])throw new Error("没有找到这场赛事。");
  const groups=await sql<Array<{groupId:string;groupName:string}>>`select id as "groupId",name as "groupName" from public.event_groups where event_id=${eventId} and status='active' order by code`;
  const out:FinalRankingWorkspaceGroup[]=[];
  for(const group of groups){
    const sessions=await sql<Array<{id:string}>>`select id from public.draw_sessions where event_id=${eventId} and group_id=${group.groupId} and phase_code='main-two' and status='confirmed' order by version_no desc limit 1`; const sid=sessions[0]?.id;
    const counts=sid?await sql<Array<{total:number;completed:number}>>`select count(*)::int as total,count(*) filter(where result_status='confirmed')::int as completed from public.competition_bracket_matches where draw_session_id=${sid} and match_type in ('main_single','third_place')`:[];
    const batches=await sql<Array<{id:string;status:string;confirmedAt:string|null;publishedAt:string|null}>>`select id,status,confirmed_at as "confirmedAt",published_at as "publishedAt" from public.competition_final_ranking_batches where event_id=${eventId} and group_id=${group.groupId} order by created_at desc limit 1`;
    const rows=await sql<FinalRankingRow[]>`select display_order as "displayOrder",placement_label as "placementLabel",player_id as "playerId",player_name as "playerName",prize_display as "prizeDisplay",is_exact_place as "isExactPlace" from public.event_rankings where event_id=${eventId} and group_id=${group.groupId} and status in ('draft','confirmed','published') order by display_order`;
    out.push({groupId:group.groupId,groupName:group.groupName,sourceReady:(counts[0]?.total??0)===32&&(counts[0]?.completed??0)===32,completedMatchCount:counts[0]?.completed??0,requiredMatchCount:32,batch:batches[0]??null,rows});
  }
  return {viewerRole:viewer.role,event:events[0],groups:out};
}

export async function confirmFinalRanking(username:string,batchId:string){
  const viewer=await requireViewer(username,true); const sql=getSqlClient(); const rows=await sql<Array<{eventId:string;groupId:string;status:string}>>`select event_id as "eventId",group_id as "groupId",status from public.competition_final_ranking_batches where id=${batchId} limit 1`; const batch=rows[0]; if(!batch)throw new Error("没有找到最终排名批次。");
  if(batch.status==='published'||batch.status==='confirmed')return {ok:true}; const timestamp=now();
  await sql.begin(async tx=>{await tx`update public.event_rankings set status='confirmed',updated_at=${timestamp} where event_id=${batch.eventId} and group_id=${batch.groupId} and status='draft'`;await tx`update public.competition_final_ranking_batches set status='confirmed',confirmed_by=${viewer.id},confirmed_at=${timestamp},updated_at=${timestamp} where id=${batchId}`;await tx`insert into public.audit_logs (id,actor_user_id,event_id,module_type,target_type,target_id,action,created_at) values (${newId('log')},${viewer.id},${batch.eventId},'competition','final_ranking',${batchId},'confirm_final_ranking',${timestamp})`;}); return {ok:true};
}

export async function publishFinalRanking(username:string,batchId:string){
  const viewer=await requireViewer(username,true); const sql=getSqlClient(); const rows=await sql<Array<{eventId:string;groupId:string;status:string}>>`select event_id as "eventId",group_id as "groupId",status from public.competition_final_ranking_batches where id=${batchId} limit 1`; const batch=rows[0]; if(!batch)throw new Error("没有找到最终排名批次。"); if(batch.status!=='confirmed'&&batch.status!=='published')throw new Error("请先确认最终排名，再进行发布。\n"); if(batch.status==='published')return {ok:true}; const timestamp=now();
  await sql.begin(async tx=>{await tx`update public.event_rankings set status='published',updated_at=${timestamp} where event_id=${batch.eventId} and group_id=${batch.groupId} and status='confirmed'`;await tx`update public.competition_final_ranking_batches set status='published',published_by=${viewer.id},published_at=${timestamp},updated_at=${timestamp} where id=${batchId}`;await tx`update public.publications set status='published',published_by=${viewer.id},published_at=coalesce(published_at,${timestamp}),updated_at=${timestamp} where event_id=${batch.eventId} and module_type='rankings'`;await tx`insert into public.audit_logs (id,actor_user_id,event_id,module_type,target_type,target_id,action,created_at) values (${newId('log')},${viewer.id},${batch.eventId},'competition','final_ranking',${batchId},'publish_final_ranking',${timestamp})`;});
  const groups=await sql<Array<{id:string}>>`select id from public.event_groups where event_id=${batch.eventId} and status='active'`; const published=await sql<Array<{groupId:string;count:number}>>`select group_id as "groupId",count(*)::int as count from public.event_rankings where event_id=${batch.eventId} and status='published' group by group_id`; const map=new Map(published.map(x=>[x.groupId,x.count])); if(groups.length>0&&groups.every(g=>(map.get(g.id)??0)>=32))await sql`update public.events set status='finished',updated_at=${timestamp},updated_by=${viewer.id} where id=${batch.eventId}`;
  return {ok:true};
}
