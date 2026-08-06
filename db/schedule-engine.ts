import { randomUUID } from "node:crypto";
import { getSqlClient } from "./index";

export type CompetitionTable = {
  id: string;
  positionNo: number;
  displayName: string;
  isTv: boolean;
  isActive: boolean;
};

export type CompetitionTimeSlot = {
  id: string;
  matchDate: string;
  startTime: string;
  sortOrder: number;
};

export type CompetitionReferee = {
  id: string;
  displayName: string;
  username: string;
};

export type ScheduleAssignment = {
  id: string;
  bracketMatchId: string;
  matchCode: string;
  matchType: string;
  divisionNo: number | null;
  roundNo: number;
  roundName: string;
  playerAName: string | null;
  playerBName: string | null;
  timeSlotId: string | null;
  tableId: string | null;
  refereeUserId: string | null;
  isManual: boolean;
};

export type ScheduleWorkspaceData = {
  viewerRole: string;
  drawSessionId: string;
  bracket: {
    id: string;
    eventId: string;
    groupId: string;
    phaseCode: string;
    eventTitle: string;
    groupName: string;
    phaseTitle: string;
    playableMatchCount: number;
    totalNodeCount: number;
    eventStartDate: string;
    eventEndDate: string;
    venueTableCount: number;
  };
  tables: CompetitionTable[];
  timeSlots: CompetitionTimeSlot[];
  referees: CompetitionReferee[];
  schedule: null | {
    id: string;
    status: string;
    minRestSlots: number;
    refereeMode: string;
    generatedAt: string;
  };
  assignments: ScheduleAssignment[];
};

type Viewer = { id: string; role: string };
type BracketRow = ScheduleWorkspaceData["bracket"];
type MatchRow = {
  id: string;
  matchCode: string;
  matchType: string;
  divisionNo: number | null;
  roundNo: number;
  roundName: string;
  matchNo: number;
  playerAName: string | null;
  playerBName: string | null;
  status: string;
  sortOrder: number;
};

function now() { return new Date().toISOString(); }
function newId(prefix: string) { return `${prefix}_${randomUUID().replaceAll("-", "")}`; }

async function requireViewer(username: string, write = false): Promise<Viewer> {
  const sql = getSqlClient();
  const rows = await sql<Viewer[]>`select id,role from public.users where username=${username} and status='active' limit 1`;
  const viewer = rows[0];
  if (!viewer || !["system_admin", "committee", "referee"].includes(viewer.role)) throw new Error("当前账号没有竞赛执行权限。");
  if (write && !["system_admin", "committee", "referee"].includes(viewer.role)) throw new Error("当前账号没有赛程编排权限。");
  return viewer;
}

async function loadBracket(sessionId: string): Promise<BracketRow> {
  const sql = getSqlClient();
  const rows = await sql<BracketRow[]>`
    select b.id,b.event_id as "eventId",b.group_id as "groupId",b.phase_code as "phaseCode",
      e.short_title as "eventTitle",eg.name as "groupName",coalesce(ep.title,b.phase_code) as "phaseTitle",
      b.playable_match_count as "playableMatchCount",b.total_node_count as "totalNodeCount",
      e.start_date as "eventStartDate",e.end_date as "eventEndDate",coalesce(v.table_count,0)::int as "venueTableCount"
    from public.competition_brackets b
    join public.events e on e.id=b.event_id
    join public.event_groups eg on eg.id=b.group_id
    left join public.event_phases ep on ep.event_id=b.event_id and ep.code=b.phase_code
    left join public.venues v on v.id=e.venue_id
    where b.draw_session_id=${sessionId}
    limit 1
  `;
  if (!rows[0]) throw new Error("请先生成完整分区签表，再进入赛程编排。");
  return rows[0];
}

export async function getScheduleWorkspaceData(username: string, sessionId: string): Promise<ScheduleWorkspaceData> {
  const viewer = await requireViewer(username);
  const bracket = await loadBracket(sessionId);
  const sql = getSqlClient();
  const [tables, timeSlots, referees, schedules] = await Promise.all([
    sql<CompetitionTable[]>`
      select id,position_no as "positionNo",display_name as "displayName",is_tv as "isTv",is_active as "isActive"
      from public.competition_event_tables where event_id=${bracket.eventId} order by sort_order,position_no
    `,
    sql<CompetitionTimeSlot[]>`
      select id,match_date as "matchDate",start_time as "startTime",sort_order as "sortOrder"
      from public.competition_time_slots
      where event_id=${bracket.eventId} and group_id=${bracket.groupId} and phase_code=${bracket.phaseCode} and is_active=true
      order by sort_order,match_date,start_time
    `,
    sql<CompetitionReferee[]>`
      select distinct u.id,u.display_name as "displayName",u.username
      from public.event_members em
      join public.users u on u.id=em.user_id
      where em.event_id=${bracket.eventId} and em.status='active' and u.status='active'
        and (em.role='referee' or u.role='referee')
      order by u.display_name,u.username
    `,
    sql<Array<{ id: string; status: string; minRestSlots: number; refereeMode: string; generatedAt: string }>>`
      select id,status,min_rest_slots as "minRestSlots",referee_mode as "refereeMode",generated_at as "generatedAt"
      from public.competition_schedules where bracket_id=${bracket.id} limit 1
    `,
  ]);
  const schedule = schedules[0] ?? null;
  const assignments = schedule ? await sql<ScheduleAssignment[]>`
    select ms.id,ms.bracket_match_id as "bracketMatchId",bm.match_code as "matchCode",bm.match_type as "matchType",
      bm.division_no as "divisionNo",bm.round_no as "roundNo",bm.round_name as "roundName",
      bm.player_a_name as "playerAName",bm.player_b_name as "playerBName",
      ms.time_slot_id as "timeSlotId",ms.table_id as "tableId",ms.referee_user_id as "refereeUserId",ms.is_manual as "isManual"
    from public.competition_match_schedules ms
    join public.competition_bracket_matches bm on bm.id=ms.bracket_match_id
    where ms.schedule_id=${schedule.id}
    order by bm.match_type desc,bm.round_no,bm.division_no,bm.match_no,bm.sort_order
  ` : [];
  return { viewerRole: viewer.role, drawSessionId: sessionId, bracket, tables, timeSlots, referees, schedule, assignments };
}

export async function saveCompetitionTables(username: string, sessionId: string, input: {
  totalCount: number;
  mode: "auto" | "manual";
  tvPositions?: number[];
  manualLabels?: string[];
}) {
  const viewer = await requireViewer(username, true);
  const bracket = await loadBracket(sessionId);
  const totalCount = Math.max(1, Math.min(128, Math.floor(Number(input.totalCount) || 0)));
  const tvPositions = [...new Set((input.tvPositions ?? []).map(Number).filter((value) => Number.isInteger(value) && value >= 1 && value <= totalCount))];
  const manualLabels = input.manualLabels ?? [];
  const createdAt = now();
  let numericNo = 0;
  const rows = Array.from({ length: totalCount }, (_, index) => {
    const positionNo = index + 1;
    const tvIndex = tvPositions.indexOf(positionNo);
    let displayName: string;
    let isTv = false;
    if (input.mode === "manual") {
      displayName = String(manualLabels[index] || `${positionNo}号台`).trim() || `${positionNo}号台`;
      isTv = /^tv\s*\d*/i.test(displayName.replaceAll("台", ""));
    } else if (tvIndex >= 0) {
      displayName = `TV${tvIndex + 1}台`;
      isTv = true;
    } else {
      numericNo += 1;
      displayName = `${numericNo}号台`;
    }
    return { id: `ct_${bracket.eventId}_${positionNo}`, event_id: bracket.eventId, position_no: positionNo, display_name: displayName, is_tv: isTv, is_active: true, sort_order: positionNo, created_at: createdAt, updated_at: createdAt };
  });
  const sql = getSqlClient();
  await sql.begin(async (tx) => {
    await tx`delete from public.competition_event_tables where event_id=${bracket.eventId} and position_no>${totalCount}`;
    await tx`
      insert into public.competition_event_tables (id,event_id,position_no,display_name,is_tv,is_active,sort_order,created_at,updated_at)
      select x.id,x.event_id,x.position_no,x.display_name,x.is_tv,x.is_active,x.sort_order,x.created_at,x.updated_at
      from jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) as x(id text,event_id text,position_no int,display_name text,is_tv boolean,is_active boolean,sort_order int,created_at text,updated_at text)
      on conflict (event_id,position_no) do update set display_name=excluded.display_name,is_tv=excluded.is_tv,is_active=true,sort_order=excluded.sort_order,updated_at=excluded.updated_at
    `;
    await tx`insert into public.audit_logs (id,actor_user_id,event_id,module_type,target_type,target_id,action,after_json,created_at)
      values (${newId("log")},${viewer.id},${bracket.eventId},'competition','competition_tables',${bracket.eventId},'save_tables',${JSON.stringify({ totalCount, mode: input.mode, tvPositions })},${createdAt})`;
  });
  return getScheduleWorkspaceData(username, sessionId);
}

export async function saveCompetitionTimeSlots(username: string, sessionId: string, slots: Array<{ matchDate: string; startTime: string }>) {
  const viewer = await requireViewer(username, true);
  const bracket = await loadBracket(sessionId);
  const cleaned = slots
    .map((slot) => ({ matchDate: String(slot.matchDate || "").trim(), startTime: String(slot.startTime || "").trim().slice(0, 5) }))
    .filter((slot) => /^\d{4}-\d{2}-\d{2}$/.test(slot.matchDate) && /^\d{2}:\d{2}$/.test(slot.startTime));
  const unique = [...new Map(cleaned.map((slot) => [`${slot.matchDate}|${slot.startTime}`, slot])).values()]
    .sort((a, b) => `${a.matchDate} ${a.startTime}`.localeCompare(`${b.matchDate} ${b.startTime}`));
  if (!unique.length) throw new Error("请至少设置一个有效的比赛日期和时间段。");
  const sql = getSqlClient();
  const existingAssignments = await sql<Array<{ count: number }>>`
    select count(*)::int as count from public.competition_match_schedules ms
    join public.competition_schedules s on s.id=ms.schedule_id
    where s.bracket_id=${bracket.id}
  `;
  if ((existingAssignments[0]?.count ?? 0) > 0) throw new Error("当前已经生成赛程。请先清空自动排程，再修改比赛时间段。");
  const createdAt = now();
  const rows = unique.map((slot, index) => ({ id: newId("cts"), event_id: bracket.eventId, group_id: bracket.groupId, phase_code: bracket.phaseCode, match_date: slot.matchDate, start_time: slot.startTime, sort_order: index + 1, is_active: true, created_at: createdAt, updated_at: createdAt }));
  await sql.begin(async (tx) => {
    await tx`delete from public.competition_time_slots where event_id=${bracket.eventId} and group_id=${bracket.groupId} and phase_code=${bracket.phaseCode}`;
    await tx`
      insert into public.competition_time_slots (id,event_id,group_id,phase_code,match_date,start_time,sort_order,is_active,created_at,updated_at)
      select x.id,x.event_id,x.group_id,x.phase_code,x.match_date,x.start_time,x.sort_order,x.is_active,x.created_at,x.updated_at
      from jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) as x(id text,event_id text,group_id text,phase_code text,match_date text,start_time text,sort_order int,is_active boolean,created_at text,updated_at text)
    `;
    await tx`insert into public.audit_logs (id,actor_user_id,event_id,module_type,target_type,target_id,action,after_json,created_at)
      values (${newId("log")},${viewer.id},${bracket.eventId},'competition','time_slots',${bracket.id},'save_time_slots',${JSON.stringify({ count: rows.length, slots: unique })},${createdAt})`;
  });
  return getScheduleWorkspaceData(username, sessionId);
}

function bucketKey(match: MatchRow) {
  return match.matchType === "playoff" ? "00-playoff" : `10-round-${String(match.roundNo).padStart(2, "0")}`;
}

export async function generateCompetitionSchedule(username: string, sessionId: string, input: { minRestSlots?: number; autoAssignReferees?: boolean }) {
  const viewer = await requireViewer(username, true);
  const data = await getScheduleWorkspaceData(username, sessionId);
  const { bracket } = data;
  const tables = data.tables.filter((table) => table.isActive);
  const slots = data.timeSlots;
  if (!tables.length) throw new Error("请先设置可用球台。");
  if (!slots.length) throw new Error("请先设置比赛日期和时间段。");
  const minRestSlots = Math.max(0, Math.min(4, Math.floor(Number(input.minRestSlots) || 0)));
  const refereeMode = input.autoAssignReferees ? "auto" : "manual";
  const sql = getSqlClient();
  const matches = await sql<MatchRow[]>`
    select id,match_code as "matchCode",match_type as "matchType",division_no as "divisionNo",round_no as "roundNo",round_name as "roundName",match_no as "matchNo",
      player_a_name as "playerAName",player_b_name as "playerBName",status,sort_order as "sortOrder"
    from public.competition_bracket_matches
    where bracket_id=${bracket.id} and status='pending'
    order by case when match_type='playoff' then 0 else 1 end,round_no,division_no,match_no,sort_order
  `;
  if (!matches.length) throw new Error("当前没有需要安排球台的实际比赛。");

  const buckets = new Map<string, MatchRow[]>();
  for (const match of matches) {
    const key = bucketKey(match);
    const list = buckets.get(key) ?? [];
    list.push(match);
    buckets.set(key, list);
  }
  const orderedBuckets = [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b));
  const requiredWaves = orderedBuckets.reduce((total, [, rows], index) => total + Math.ceil(rows.length / tables.length) + (index ? minRestSlots : 0), 0);
  if (requiredWaves > slots.length) throw new Error(`当前时间段不足：按${tables.length}张球台和轮次间隔设置，至少需要${requiredWaves}个时间段，目前只有${slots.length}个。请增加日期/时间段或球台数量。`);

  const createdAt = now();
  const scheduleId = data.schedule?.id ?? newId("sched");
  let cursor = 0;
  const rows: Array<{ id: string; schedule_id: string; bracket_match_id: string; time_slot_id: string; table_id: string; referee_user_id: string | null; assignment_status: string; is_manual: boolean; note: string | null; created_at: string; updated_at: string }> = [];
  for (let bucketIndex = 0; bucketIndex < orderedBuckets.length; bucketIndex += 1) {
    if (bucketIndex > 0) cursor += minRestSlots;
    const [, bucketMatches] = orderedBuckets[bucketIndex];
    for (let index = 0; index < bucketMatches.length; index += 1) {
      const waveOffset = Math.floor(index / tables.length);
      const tableIndex = index % tables.length;
      const timeSlot = slots[cursor + waveOffset];
      const table = tables[tableIndex];
      let refereeUserId: string | null = null;
      if (input.autoAssignReferees && data.referees.length && tableIndex < data.referees.length) {
        refereeUserId = data.referees[(tableIndex + cursor + waveOffset) % data.referees.length].id;
      }
      rows.push({ id: newId("cms"), schedule_id: scheduleId, bracket_match_id: bucketMatches[index].id, time_slot_id: timeSlot.id, table_id: table.id, referee_user_id: refereeUserId, assignment_status: "draft", is_manual: false, note: null, created_at: createdAt, updated_at: createdAt });
    }
    cursor += Math.ceil(bucketMatches.length / tables.length);
  }

  await sql.begin(async (tx) => {
    await tx`
      insert into public.competition_schedules (id,bracket_id,event_id,group_id,phase_code,status,min_rest_slots,referee_mode,generated_by,generated_at,updated_at)
      values (${scheduleId},${bracket.id},${bracket.eventId},${bracket.groupId},${bracket.phaseCode},'draft',${minRestSlots},${refereeMode},${viewer.id},${createdAt},${createdAt})
      on conflict (bracket_id) do update set status='draft',min_rest_slots=excluded.min_rest_slots,referee_mode=excluded.referee_mode,generated_by=excluded.generated_by,generated_at=excluded.generated_at,updated_at=excluded.updated_at
    `;
    await tx`delete from public.competition_match_schedules where schedule_id=${scheduleId}`;
    await tx`
      insert into public.competition_match_schedules (id,schedule_id,bracket_match_id,time_slot_id,table_id,referee_user_id,assignment_status,is_manual,note,created_at,updated_at)
      select x.id,x.schedule_id,x.bracket_match_id,x.time_slot_id,x.table_id,x.referee_user_id,x.assignment_status,x.is_manual,x.note,x.created_at,x.updated_at
      from jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) as x(id text,schedule_id text,bracket_match_id text,time_slot_id text,table_id text,referee_user_id text,assignment_status text,is_manual boolean,note text,created_at text,updated_at text)
    `;
    await tx`insert into public.audit_logs (id,actor_user_id,event_id,module_type,target_type,target_id,action,after_json,created_at)
      values (${newId("log")},${viewer.id},${bracket.eventId},'competition','competition_schedule',${scheduleId},'auto_schedule',${JSON.stringify({ matchCount: rows.length, tableCount: tables.length, timeSlotCount: slots.length, minRestSlots, refereeMode })},${createdAt})`;
  });
  return getScheduleWorkspaceData(username, sessionId);
}

export async function clearCompetitionSchedule(username: string, sessionId: string) {
  const viewer = await requireViewer(username, true);
  const data = await getScheduleWorkspaceData(username, sessionId);
  if (!data.schedule) return data;
  const sql = getSqlClient();
  const changedAt = now();
  await sql.begin(async (tx) => {
    await tx`delete from public.competition_match_schedules where schedule_id=${data.schedule!.id}`;
    await tx`delete from public.competition_schedules where id=${data.schedule!.id}`;
    await tx`insert into public.audit_logs (id,actor_user_id,event_id,module_type,target_type,target_id,action,created_at)
      values (${newId("log")},${viewer.id},${data.bracket.eventId},'competition','competition_schedule',${data.schedule!.id},'clear_schedule',${changedAt})`;
  });
  return getScheduleWorkspaceData(username, sessionId);
}

export async function updateScheduleAssignment(username: string, sessionId: string, input: { assignmentId: string; timeSlotId: string | null; tableId: string | null; refereeUserId: string | null }) {
  const viewer = await requireViewer(username, true);
  const data = await getScheduleWorkspaceData(username, sessionId);
  if (!data.schedule) throw new Error("请先生成自动赛程。");
  if (input.timeSlotId && !data.timeSlots.some((slot) => slot.id === input.timeSlotId)) throw new Error("比赛时间段无效。");
  if (input.tableId && !data.tables.some((table) => table.id === input.tableId && table.isActive)) throw new Error("球台无效。");
  if (input.refereeUserId && !data.referees.some((referee) => referee.id === input.refereeUserId)) throw new Error("裁判账号无效或未分配到本赛事。");
  const sql = getSqlClient();
  const changedAt = now();
  await sql`
    update public.competition_match_schedules
    set time_slot_id=${input.timeSlotId},table_id=${input.tableId},referee_user_id=${input.refereeUserId},is_manual=true,updated_at=${changedAt}
    where id=${input.assignmentId} and schedule_id=${data.schedule.id}
  `;
  await sql`insert into public.audit_logs (id,actor_user_id,event_id,module_type,target_type,target_id,action,after_json,created_at)
    values (${newId("log")},${viewer.id},${data.bracket.eventId},'competition','match_schedule',${input.assignmentId},'manual_adjust_schedule',${JSON.stringify({ timeSlotId: input.timeSlotId, tableId: input.tableId, refereeUserId: input.refereeUserId })},${changedAt})`;
  return getScheduleWorkspaceData(username, sessionId);
}
