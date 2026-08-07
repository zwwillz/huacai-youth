import { createHash, randomBytes } from "node:crypto";
import { getSqlClient } from "./index";
import { requireEventAccess } from "./permissions";

export const DRAW_PHASES = ["qualifier-one", "qualifier-two", "main-one", "main-two"] as const;
export type DrawPhaseCode = (typeof DRAW_PHASES)[number];

const PHASE_TITLES: Record<DrawPhaseCode, string> = {
  "qualifier-one": "资格赛第一场",
  "qualifier-two": "资格赛第二场",
  "main-one": "正赛第一阶段",
  "main-two": "正赛第二阶段",
};

export type DrawPlan = {
  entrantCount: number;
  bracketSize: number;
  divisionSize: number;
  divisionCount: number;
  directQualifierCount: number;
  rateQualifierCount: number;
  totalQualifierCount: number;
  playoffMatchCount: number;
  playoffPlayerCount: number;
  directEntryCount: number;
  byeCount: number;
  roundsPerDivision: number;
  sourceReady: boolean;
  sourceNote: string;
};

export type DrawWorkspaceData = {
  viewerRole: string;
  event: { id: string; shortTitle: string; stationNo: number; status: string };
  groups: Array<{ id: string; name: string; code: string; approvedCount: number }>;
  selectedGroupId: string;
  selectedPhase: DrawPhaseCode;
  phaseTitle: string;
  settings: {
    bracketSize: number;
    divisionSize: number;
    rateQualifierCount: number;
    seedsEnabled: boolean;
    seedTargetCount: number;
    seedFillRule: string;
  };
  plan: DrawPlan;
  latestSession: null | {
    id: string;
    versionNo: number;
    status: string;
    entrantCount: number;
    bracketSize: number;
    divisionCount: number;
    playoffMatchCount: number;
    byeCount: number;
    randomCommitment: string;
    createdAt: string;
    confirmedAt: string | null;
  };
};

export type DrawSessionDetail = {
  viewerRole: string;
  session: {
    id: string;
    eventId: string;
    eventTitle: string;
    groupId: string;
    groupName: string;
    phaseCode: DrawPhaseCode;
    phaseTitle: string;
    versionNo: number;
    status: string;
    entrantCount: number;
    bracketSize: number;
    divisionSize: number;
    divisionCount: number;
    directQualifierCount: number;
    rateQualifierCount: number;
    totalQualifierCount: number;
    playoffMatchCount: number;
    playoffPlayerCount: number;
    byeCount: number;
    seedsEnabled: boolean;
    seedTargetCount: number;
    seedFillRule: string;
    randomCommitment: string;
    randomSeed: string;
    createdAt: string;
    confirmedAt: string | null;
  };
  participants: Array<{
    playerId: string | null;
    playerName: string;
    randomOrder: number;
    assignmentType: string;
    displayDrawNo: string;
  }>;
  prelimMatches: Array<{
    id: string;
    matchNo: number;
    playerAId: string | null;
    playerAName: string;
    playerBId: string | null;
    playerBName: string;
    targetSlotNo: number;
    status: string;
  }>;
  slots: Array<{
    slotNo: number;
    divisionNo: number;
    divisionSlotNo: number;
    slotType: string;
    playerId: string | null;
    playerName: string | null;
    prelimMatchId: string | null;
  }>;
};

type Viewer = { id: string; username: string; role: string };
type Participant = { playerId: string; playerName: string };

function now() {
  return new Date().toISOString();
}

function newId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

function isPowerOfTwo(value: number) {
  return Number.isInteger(value) && value > 0 && (value & (value - 1)) === 0;
}

function defaultSettings(phaseCode: DrawPhaseCode) {
  if (phaseCode === "qualifier-one" || phaseCode === "qualifier-two") {
    return { bracketSize: 512, divisionSize: 32, rateQualifierCount: 8, seedsEnabled: false, seedTargetCount: 0, seedFillRule: "game_win_rate" };
  }
  if (phaseCode === "main-one") {
    return { bracketSize: 64, divisionSize: 8, rateQualifierCount: 0, seedsEnabled: true, seedTargetCount: 16, seedFillRule: "game_win_rate" };
  }
  return { bracketSize: 32, divisionSize: 8, rateQualifierCount: 0, seedsEnabled: false, seedTargetCount: 0, seedFillRule: "game_win_rate" };
}

async function requireViewer(username: string, confirm = false): Promise<Viewer> {
  const sql = getSqlClient();
  const rows = await sql<Viewer[]>`
    select id, username, role
    from public.users
    where username = ${username} and status = 'active'
    limit 1
  `;
  const viewer = rows[0];
  if (!viewer || !["system_admin", "committee", "referee"].includes(viewer.role)) throw new Error("当前账号没有竞赛执行权限。");
  if (confirm && !["system_admin", "committee"].includes(viewer.role)) throw new Error("抽签确认和作废需要系统管理员或组委会权限。");
  return viewer;
}

function sourceStatus(phaseCode: DrawPhaseCode) {
  if (phaseCode === "qualifier-one") return { sourceReady: true, sourceNote: "使用本赛事该组别已审核通过的参赛名单。" };
  if (phaseCode === "qualifier-two") return { sourceReady: false, sourceNote: "第二场应使用第一场未晋级球员名单；等晋级确认模块接入后自动生成，避免把已晋级球员再次抽入。" };
  if (phaseCode === "main-one") return { sourceReady: false, sourceNote: "正赛第一阶段将由两场资格赛晋级球员 + 可选种子球员组成；种子缺席时按局胜率增补。" };
  return { sourceReady: false, sourceNote: "正赛第二阶段应使用正赛第一阶段确认后的晋级名单重新抽签。" };
}

export function calculateQualificationPlan(input: { entrantCount: number; bracketSize: number; divisionSize: number; rateQualifierCount: number; phaseCode: DrawPhaseCode }): DrawPlan {
  const entrantCount = Number(input.entrantCount);
  const bracketSize = Number(input.bracketSize);
  const divisionSize = Number(input.divisionSize);
  const rateQualifierCount = Math.max(0, Number(input.rateQualifierCount));
  if (!Number.isInteger(entrantCount) || entrantCount < 2) throw new Error("当前参赛人数不足，至少需要2人才能抽签。");
  if (!isPowerOfTwo(bracketSize)) throw new Error("标准签表容量必须是2的整数次幂，例如256、512、1024。");
  if (!isPowerOfTwo(divisionSize) || divisionSize > bracketSize || bracketSize % divisionSize !== 0) throw new Error("每区人数必须是2的整数次幂，并且能够整除标准签表容量。");
  if (entrantCount > bracketSize * 2) throw new Error("当前人数超过一轮附加赛可承载范围，请把标准签表容量调大后再抽签。");

  const divisionCount = bracketSize / divisionSize;
  const directQualifierCount = divisionCount;
  const totalQualifierCount = directQualifierCount + rateQualifierCount;
  const playoffMatchCount = Math.max(0, entrantCount - bracketSize);
  const playoffPlayerCount = playoffMatchCount * 2;
  const directEntryCount = entrantCount > bracketSize ? entrantCount - playoffPlayerCount : entrantCount;
  const byeCount = Math.max(0, bracketSize - entrantCount);
  const source = sourceStatus(input.phaseCode);

  return {
    entrantCount,
    bracketSize,
    divisionSize,
    divisionCount,
    directQualifierCount,
    rateQualifierCount,
    totalQualifierCount,
    playoffMatchCount,
    playoffPlayerCount,
    directEntryCount,
    byeCount,
    roundsPerDivision: Math.log2(divisionSize),
    ...source,
  };
}

function seededRandom(seedText: string) {
  let state = createHash("sha256").update(seedText).digest().readUInt32BE(0) || 0x9e3779b9;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], random: () => number) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function balancedSpecialSlots(bracketSize: number, divisionSize: number, count: number, random: () => number) {
  if (count <= 0) return [] as number[];
  const divisionCount = bracketSize / divisionSize;
  const pairsPerDivision = divisionSize / 2;
  const firstPass: number[] = [];
  const secondPass: number[] = [];

  const pairOrders = Array.from({ length: divisionCount }, (_, divisionIndex) =>
    shuffled(Array.from({ length: pairsPerDivision }, (_, pairIndex) => pairIndex), random).map((pairIndex) => ({ divisionIndex, pairIndex })),
  );

  for (let depth = 0; depth < pairsPerDivision; depth += 1) {
    const divisionOrder = shuffled(Array.from({ length: divisionCount }, (_, index) => index), random);
    for (const divisionIndex of divisionOrder) {
      const pair = pairOrders[divisionIndex][depth];
      const pairStart = divisionIndex * divisionSize + pair.pairIndex * 2 + 1;
      const firstSide = random() < 0.5 ? pairStart : pairStart + 1;
      firstPass.push(firstSide);
      secondPass.push(firstSide === pairStart ? pairStart + 1 : pairStart);
    }
  }
  return [...firstPass, ...secondPass].slice(0, count);
}

function pad(value: number, width = 3) {
  return String(value).padStart(width, "0");
}

async function loadApprovedParticipants(eventId: string, groupId: string): Promise<Participant[]> {
  const sql = getSqlClient();
  return sql<Participant[]>`
    select distinct p.id as "playerId", p.full_name as "playerName"
    from public.registrations r
    join public.players p on p.id = r.player_id
    where r.event_id = ${eventId}
      and r.group_id = ${groupId}
      and r.status = 'approved'
      and coalesce(p.profile_status, 'active') <> 'merged'
    order by p.full_name, p.id
  `;
}

export async function getDrawWorkspaceData(username: string, eventId: string, groupId?: string, phaseCode: DrawPhaseCode = "qualifier-one"): Promise<DrawWorkspaceData> {
  const viewer = await requireViewer(username);
  if (!DRAW_PHASES.includes(phaseCode)) throw new Error("竞赛阶段不正确。");
  const sql = getSqlClient();
  const eventRows = await sql<Array<{ id: string; shortTitle: string; stationNo: number; status: string }>>`
    select id, short_title as "shortTitle", station_no as "stationNo", status
    from public.events where id = ${eventId} limit 1
  `;
  const event = eventRows[0];
  if (!event) throw new Error("没有找到这场赛事。");

  const groupRows = await sql<Array<{ id: string; name: string; code: string; approvedCount: number }>>`
    select g.id, g.name, g.code, count(r.id)::int as "approvedCount"
    from public.event_groups g
    left join public.registrations r on r.group_id = g.id and r.event_id = g.event_id and r.status = 'approved'
    where g.event_id = ${eventId} and g.status = 'active'
    group by g.id, g.name, g.code
    order by g.code
  `;
  if (!groupRows.length) throw new Error("这场赛事还没有参赛组别。");
  const selectedGroupId = groupRows.some((group) => group.id === groupId) ? String(groupId) : groupRows[0].id;
  const selectedGroup = groupRows.find((group) => group.id === selectedGroupId)!;
  const defaults = defaultSettings(phaseCode);
  const settingRows = await sql<Array<{ bracketSize: number; divisionSize: number; rateQualifierCount: number; seedsEnabled: boolean; seedTargetCount: number; seedFillRule: string }>>`
    select bracket_size as "bracketSize", division_size as "divisionSize", rate_qualifier_count as "rateQualifierCount",
           seeds_enabled as "seedsEnabled", seed_target_count as "seedTargetCount", seed_fill_rule as "seedFillRule"
    from public.competition_phase_settings
    where event_id = ${eventId} and group_id = ${selectedGroupId} and phase_code = ${phaseCode}
    limit 1
  `;
  const settings = settingRows[0] ?? defaults;
  const plan = calculateQualificationPlan({ entrantCount: selectedGroup.approvedCount, bracketSize: settings.bracketSize, divisionSize: settings.divisionSize, rateQualifierCount: settings.rateQualifierCount, phaseCode });

  const sessionRows = await sql<Array<{ id: string; versionNo: number; status: string; entrantCount: number; bracketSize: number; divisionCount: number; playoffMatchCount: number; byeCount: number; randomCommitment: string; createdAt: string; confirmedAt: string | null }>>`
    select id, version_no as "versionNo", status, entrant_count as "entrantCount", bracket_size as "bracketSize",
           division_count as "divisionCount", playoff_match_count as "playoffMatchCount", bye_count as "byeCount",
           random_commitment as "randomCommitment", created_at as "createdAt", confirmed_at as "confirmedAt"
    from public.draw_sessions
    where event_id = ${eventId} and group_id = ${selectedGroupId} and phase_code = ${phaseCode}
    order by version_no desc
    limit 1
  `;

  return { viewerRole: viewer.role, event, groups: groupRows, selectedGroupId, selectedPhase: phaseCode, phaseTitle: PHASE_TITLES[phaseCode], settings, plan, latestSession: sessionRows[0] ?? null };
}

export async function createQualificationDraw(username: string, input: { eventId: string; groupId: string; phaseCode: DrawPhaseCode; bracketSize: number; divisionSize: number; rateQualifierCount: number; seedsEnabled?: boolean; seedTargetCount?: number; seedFillRule?: string }) {
  const viewer = await requireViewer(username);
  await requireEventAccess(username, input.eventId, { write: true });
  if (input.phaseCode !== "qualifier-one") throw new Error("第一版先开放“资格赛第一场”的正式抽签。资格赛第二场将在第一场晋级确认模块接入后开放，避免重复抽入已晋级球员。");
  const participants = await loadApprovedParticipants(input.eventId, input.groupId);
  const plan = calculateQualificationPlan({ entrantCount: participants.length, bracketSize: input.bracketSize, divisionSize: input.divisionSize, rateQualifierCount: input.rateQualifierCount, phaseCode: input.phaseCode });
  if (!plan.sourceReady) throw new Error(plan.sourceNote);

  const sql = getSqlClient();
  const activeRows = await sql<Array<{ id: string; versionNo: number; status: string }>>`
    select id, version_no as "versionNo", status
    from public.draw_sessions
    where event_id = ${input.eventId} and group_id = ${input.groupId} and phase_code = ${input.phaseCode} and status in ('draft','confirmed')
    order by version_no desc limit 1
  `;
  if (activeRows[0]?.status === "draft") throw new Error(`当前已有V${activeRows[0].versionNo}抽签草稿，请先确认或作废后再重新抽签。`);
  if (activeRows[0]?.status === "confirmed") throw new Error(`当前已有V${activeRows[0].versionNo}正式抽签；如需重抽，请先由组委会作废原版本并填写原因。`);

  const versionRows = await sql<Array<{ maxVersion: number }>>`
    select coalesce(max(version_no), 0)::int as "maxVersion"
    from public.draw_sessions
    where event_id = ${input.eventId} and group_id = ${input.groupId} and phase_code = ${input.phaseCode}
  `;
  const versionNo = (versionRows[0]?.maxVersion ?? 0) + 1;
  const sessionId = newId("draw");
  const createdAt = now();
  const randomSeed = randomBytes(32).toString("hex");
  const randomCommitment = createHash("sha256").update(randomSeed).digest("hex");
  const random = seededRandom(randomSeed);
  const randomParticipants = shuffled(participants, random);

  const playoffPool = plan.playoffPlayerCount ? randomParticipants.slice(0, plan.playoffPlayerCount) : [];
  const directPool = plan.playoffPlayerCount ? randomParticipants.slice(plan.playoffPlayerCount) : randomParticipants;
  const specialCount = plan.playoffMatchCount || plan.byeCount;
  const specialSlots = balancedSpecialSlots(plan.bracketSize, plan.divisionSize, specialCount, random);
  const specialSlotSet = new Set(specialSlots);
  const ordinarySlots = shuffled(Array.from({ length: plan.bracketSize }, (_, index) => index + 1).filter((slot) => !specialSlotSet.has(slot)), random);
  const directPlayers = shuffled(directPool, random);

  const prelimRows = Array.from({ length: plan.playoffMatchCount }, (_, index) => {
    const playerA = playoffPool[index * 2];
    const playerB = playoffPool[index * 2 + 1];
    return {
      id: newId("prelim"),
      matchNo: index + 1,
      playerA,
      playerB,
      targetSlotNo: specialSlots[index],
    };
  });

  const prelimBySlot = new Map(prelimRows.map((row) => [row.targetSlotNo, row]));
  const directBySlot = new Map<number, Participant>();
  ordinarySlots.forEach((slot, index) => {
    const player = directPlayers[index];
    if (player) directBySlot.set(slot, player);
  });

  const participantAssignments = new Map<string, { assignmentType: string; displayDrawNo: string }>();
  for (const row of prelimRows) {
    participantAssignments.set(row.playerA.playerId, { assignmentType: "playoff", displayDrawNo: `附${pad(row.matchNo)}-A` });
    participantAssignments.set(row.playerB.playerId, { assignmentType: "playoff", displayDrawNo: `附${pad(row.matchNo)}-B` });
  }
  for (const [slot, player] of directBySlot) participantAssignments.set(player.playerId, { assignmentType: "direct", displayDrawNo: pad(slot) });

  const participantRows = randomParticipants.map((player, index) => ({
    id: newId("dp"),
    player,
    randomOrder: index + 1,
    assignment: participantAssignments.get(player.playerId)!,
  }));

  const slotRows = Array.from({ length: plan.bracketSize }, (_, index) => {
    const slotNo = index + 1;
    const divisionNo = Math.ceil(slotNo / plan.divisionSize);
    const divisionSlotNo = ((slotNo - 1) % plan.divisionSize) + 1;
    const prelim = prelimBySlot.get(slotNo);
    const player = directBySlot.get(slotNo);
    return {
      id: newId("slot"),
      slotNo,
      divisionNo,
      divisionSlotNo,
      slotType: prelim ? "playoff_winner" : specialSlotSet.has(slotNo) && plan.byeCount ? "bye" : "player",
      player,
      prelim,
    };
  });

  const settingsId = `cps_${createHash("sha1").update(`${input.eventId}|${input.groupId}|${input.phaseCode}`).digest("hex").slice(0, 24)}`;
  const rulesJson = JSON.stringify({
    draw_scope: "single_draw_to_direct_qualifiers",
    qualification_rule: "division_winner_plus_final_loser_game_win_rate",
    division_size: plan.divisionSize,
    division_count: plan.divisionCount,
    direct_qualifiers: plan.directQualifierCount,
    rate_qualifiers: plan.rateQualifierCount,
    rate_pool: "division_final_losers",
    rate_metric: "game_win_rate",
    seed_absence_fill_rule: input.seedFillRule || "game_win_rate",
  });

  await sql.begin(async (tx) => {
    await tx`
      insert into public.competition_phase_settings
        (id,event_id,group_id,phase_code,bracket_size,division_size,rate_qualifier_count,seeds_enabled,seed_target_count,seed_fill_rule,allow_playoff,allow_bye,created_at,updated_at)
      values
        (${settingsId},${input.eventId},${input.groupId},${input.phaseCode},${plan.bracketSize},${plan.divisionSize},${plan.rateQualifierCount},${Boolean(input.seedsEnabled)},${Number(input.seedTargetCount || 0)},${input.seedFillRule || "game_win_rate"},true,true,${createdAt},${createdAt})
      on conflict (event_id,group_id,phase_code) do update set
        bracket_size=excluded.bracket_size, division_size=excluded.division_size, rate_qualifier_count=excluded.rate_qualifier_count,
        seeds_enabled=excluded.seeds_enabled, seed_target_count=excluded.seed_target_count, seed_fill_rule=excluded.seed_fill_rule, updated_at=excluded.updated_at
    `;
    await tx`
      insert into public.draw_sessions
        (id,event_id,group_id,phase_code,version_no,status,entrant_count,bracket_size,division_size,division_count,direct_qualifier_count,rate_qualifier_count,total_qualifier_count,playoff_match_count,playoff_player_count,bye_count,seeds_enabled,seed_target_count,seed_fill_rule,random_seed,random_commitment,rules_json,created_by,created_at)
      values
        (${sessionId},${input.eventId},${input.groupId},${input.phaseCode},${versionNo},'draft',${plan.entrantCount},${plan.bracketSize},${plan.divisionSize},${plan.divisionCount},${plan.directQualifierCount},${plan.rateQualifierCount},${plan.totalQualifierCount},${plan.playoffMatchCount},${plan.playoffPlayerCount},${plan.byeCount},${Boolean(input.seedsEnabled)},${Number(input.seedTargetCount || 0)},${input.seedFillRule || "game_win_rate"},${randomSeed},${randomCommitment},${rulesJson}::jsonb,${viewer.id},${createdAt})
    `;
    for (const row of prelimRows) {
      await tx`
        insert into public.draw_prelim_matches
          (id,session_id,match_no,player_a_id,player_a_name,player_b_id,player_b_name,target_slot_no,status,created_at,updated_at)
        values
          (${row.id},${sessionId},${row.matchNo},${row.playerA.playerId},${row.playerA.playerName},${row.playerB.playerId},${row.playerB.playerName},${row.targetSlotNo},'pending',${createdAt},${createdAt})
      `;
    }
    for (const row of participantRows) {
      await tx`
        insert into public.draw_participants
          (id,session_id,player_id,player_name,source_type,seed_no,random_order,assignment_type,display_draw_no,created_at)
        values
          (${row.id},${sessionId},${row.player.playerId},${row.player.playerName},'registration',null,${row.randomOrder},${row.assignment.assignmentType},${row.assignment.displayDrawNo},${createdAt})
      `;
    }
    for (const row of slotRows) {
      await tx`
        insert into public.draw_slots
          (id,session_id,slot_no,division_no,division_slot_no,slot_type,player_id,player_name,prelim_match_id,created_at)
        values
          (${row.id},${sessionId},${row.slotNo},${row.divisionNo},${row.divisionSlotNo},${row.slotType},${row.player?.playerId ?? null},${row.player?.playerName ?? null},${row.prelim?.id ?? null},${createdAt})
      `;
    }
    await tx`
      insert into public.audit_logs
        (id,actor_user_id,event_id,module_type,target_type,target_id,action,after_json,created_at)
      values
        (${newId("log")},${viewer.id},${input.eventId},'competition','draw_session',${sessionId},'create_draw_draft',${JSON.stringify({ groupId: input.groupId, phaseCode: input.phaseCode, versionNo, entrantCount: plan.entrantCount, bracketSize: plan.bracketSize, divisionSize: plan.divisionSize, playoffMatchCount: plan.playoffMatchCount, byeCount: plan.byeCount, randomCommitment })},${createdAt})
    `;
  });

  return getDrawSessionDetail(username, sessionId);
}

export async function getDrawSessionDetail(username: string, sessionId: string): Promise<DrawSessionDetail> {
  const viewer = await requireViewer(username);
  const sql = getSqlClient();
  const sessionRows = await sql<Array<any>>`
    select s.id, s.event_id as "eventId", e.short_title as "eventTitle", s.group_id as "groupId", g.name as "groupName",
      s.phase_code as "phaseCode", s.version_no as "versionNo", s.status, s.entrant_count as "entrantCount",
      s.bracket_size as "bracketSize", s.division_size as "divisionSize", s.division_count as "divisionCount",
      s.direct_qualifier_count as "directQualifierCount", s.rate_qualifier_count as "rateQualifierCount", s.total_qualifier_count as "totalQualifierCount",
      s.playoff_match_count as "playoffMatchCount", s.playoff_player_count as "playoffPlayerCount", s.bye_count as "byeCount",
      s.seeds_enabled as "seedsEnabled", s.seed_target_count as "seedTargetCount", s.seed_fill_rule as "seedFillRule",
      s.random_commitment as "randomCommitment", s.random_seed as "randomSeed", s.created_at as "createdAt", s.confirmed_at as "confirmedAt"
    from public.draw_sessions s
    join public.events e on e.id=s.event_id
    join public.event_groups g on g.id=s.group_id
    where s.id=${sessionId}
    limit 1
  `;
  const raw = sessionRows[0];
  if (!raw) throw new Error("没有找到这次抽签。");
  await requireEventAccess(username, raw.eventId);
  const phaseCode = raw.phaseCode as DrawPhaseCode;
  const [participants, prelimMatches, slots] = await Promise.all([
    sql<Array<any>>`
      select player_id as "playerId", player_name as "playerName", random_order as "randomOrder", assignment_type as "assignmentType", display_draw_no as "displayDrawNo"
      from public.draw_participants where session_id=${sessionId} order by random_order
    `,
    sql<Array<any>>`
      select id,match_no as "matchNo",player_a_id as "playerAId",player_a_name as "playerAName",player_b_id as "playerBId",player_b_name as "playerBName",target_slot_no as "targetSlotNo",status
      from public.draw_prelim_matches where session_id=${sessionId} order by match_no
    `,
    sql<Array<any>>`
      select slot_no as "slotNo",division_no as "divisionNo",division_slot_no as "divisionSlotNo",slot_type as "slotType",player_id as "playerId",player_name as "playerName",prelim_match_id as "prelimMatchId"
      from public.draw_slots where session_id=${sessionId} order by slot_no
    `,
  ]);
  return { viewerRole: viewer.role, session: { ...raw, phaseCode, phaseTitle: PHASE_TITLES[phaseCode] }, participants, prelimMatches, slots };
}

export async function confirmDrawSession(username: string, sessionId: string) {
  const viewer = await requireViewer(username, true);
  const sql = getSqlClient();
  const rows = await sql<Array<{ eventId: string; status: string }>>`select event_id as "eventId", status from public.draw_sessions where id=${sessionId} limit 1`;
  const session = rows[0];
  if (!session) throw new Error("没有找到这次抽签。");
  await requireEventAccess(username, session.eventId, { write: true });
  if (session.status !== "draft") throw new Error("只有抽签草稿可以确认。");
  const confirmedAt = now();
  await sql.begin(async (tx) => {
    await tx`update public.draw_sessions set status='confirmed', confirmed_by=${viewer.id}, confirmed_at=${confirmedAt} where id=${sessionId}`;
    await tx`insert into public.audit_logs (id,actor_user_id,event_id,module_type,target_type,target_id,action,created_at) values (${newId("log")},${viewer.id},${session.eventId},'competition','draw_session',${sessionId},'confirm_draw',${confirmedAt})`;
  });
  return getDrawSessionDetail(username, sessionId);
}

export async function voidDrawSession(username: string, sessionId: string, reason: string) {
  const viewer = await requireViewer(username, true);
  const cleanReason = reason.trim();
  if (cleanReason.length < 3) throw new Error("请填写作废原因，至少3个字。");
  const sql = getSqlClient();
  const rows = await sql<Array<{ eventId: string; status: string }>>`select event_id as "eventId", status from public.draw_sessions where id=${sessionId} limit 1`;
  const session = rows[0];
  if (!session) throw new Error("没有找到这次抽签。");
  await requireEventAccess(username, session.eventId, { write: true });
  if (session.status === "void") throw new Error("这次抽签已经作废。");
  const voidedAt = now();
  await sql.begin(async (tx) => {
    await tx`update public.draw_sessions set status='void', voided_at=${voidedAt}, void_reason=${cleanReason} where id=${sessionId}`;
    await tx`insert into public.audit_logs (id,actor_user_id,event_id,module_type,target_type,target_id,action,reason,created_at) values (${newId("log")},${viewer.id},${session.eventId},'competition','draw_session',${sessionId},'void_draw',${cleanReason},${voidedAt})`;
  });
  return { ok: true };
}
