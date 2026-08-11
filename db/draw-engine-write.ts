import { createHash, randomBytes, randomUUID } from "node:crypto";
import type postgres from "postgres";
import { getSqlClient } from "./index";
import { requireEventAccess } from "./permissions";
import { calculateQualificationPlan, getDrawSessionDetail, type DrawPhaseCode } from "./draw-engine";

type Participant = { playerId: string; playerName: string; sourceType: string };
type Viewer = { id: string; role: string };

function now() { return new Date().toISOString(); }
function newId(prefix: string) { return `${prefix}_${randomUUID().replaceAll("-", "")}`; }
function pad(value: number, width = 3) { return String(value).padStart(width, "0"); }

const DRAW_INSERT_CHUNK_SIZE = 200;

async function insertScalarRows(tx: postgres.Sql, insertPrefix: string, columnCount: number, rows: unknown[][]) {
  for (let offset = 0; offset < rows.length; offset += DRAW_INSERT_CHUNK_SIZE) {
    const chunk = rows.slice(offset, offset + DRAW_INSERT_CHUNK_SIZE);
    const params = chunk.flat();
    const valuesSql = chunk.map((_, rowIndex) => {
      const base = rowIndex * columnCount;
      return `(${Array.from({ length: columnCount }, (_item, columnIndex) => `$${base + columnIndex + 1}`).join(",")})`;
    }).join(",");
    await tx.unsafe(`${insertPrefix} values ${valuesSql}`, params);
  }
}

async function requireViewer(username: string): Promise<Viewer> {
  const sql = getSqlClient();
  const rows = await sql<Viewer[]>`select id,role from public.users where username=${username} and status='active' limit 1`;
  const viewer = rows[0];
  if (!viewer || !["system_admin", "committee", "referee"].includes(viewer.role)) throw new Error("当前账号没有竞赛执行权限。");
  return viewer;
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

async function phaseParticipants(eventId: string, groupId: string, phaseCode: DrawPhaseCode): Promise<Participant[]> {
  const sql = getSqlClient();
  if (phaseCode === "qualifier-one") {
    return sql<Participant[]>`
      select distinct p.id as "playerId", p.full_name as "playerName", 'registration'::text as "sourceType"
      from public.registrations r
      join public.players p on p.id=r.player_id
      where r.event_id=${eventId} and r.group_id=${groupId} and r.status='approved' and p.merged_into_player_id is null
      order by p.full_name,p.id
    `;
  }
  if (phaseCode === "qualifier-two") {
    return sql<Participant[]>`
      select pe.player_id as "playerId",pe.player_name as "playerName",'phase_entry'::text as "sourceType"
      from public.competition_phase_entries pe
      where pe.event_id=${eventId} and pe.group_id=${groupId} and pe.phase_code='qualifier-two' and pe.status='active'
      order by pe.sort_order,pe.player_name,pe.player_id
    `;
  }
  throw new Error("当前阶段的抽签名单来源尚未开放。");
}

export async function createQualificationDrawFast(username: string, input: {
  eventId: string;
  groupId: string;
  phaseCode: DrawPhaseCode;
  bracketSize: number;
  divisionSize: number;
  rateQualifierCount: number;
  seedsEnabled?: boolean;
  seedTargetCount?: number;
  seedFillRule?: string;
}) {
  const viewer = await requireViewer(username);
  await requireEventAccess(username, input.eventId, { write: true });
  if (!["qualifier-one", "qualifier-two"].includes(input.phaseCode)) throw new Error("当前只开放资格赛第一场和资格赛第二场的正式抽签。");
  const participants = await phaseParticipants(input.eventId, input.groupId, input.phaseCode);
  if (participants.length < 2) {
    if (input.phaseCode === "qualifier-two") throw new Error("资格赛第二场参赛名单尚未生成。请先完成资格赛第一场晋级确认。");
    throw new Error("当前已审核参赛名单不足2人，不能开始抽签。");
  }
  const plan = calculateQualificationPlan({ entrantCount: participants.length, bracketSize: input.bracketSize, divisionSize: input.divisionSize, rateQualifierCount: input.rateQualifierCount, phaseCode: input.phaseCode });
  const sql = getSqlClient();
  const active = await sql<Array<{ versionNo: number; status: string }>>`
    select version_no as "versionNo",status from public.draw_sessions
    where event_id=${input.eventId} and group_id=${input.groupId} and phase_code=${input.phaseCode} and status in ('draft','confirmed')
    order by version_no desc limit 1
  `;
  if (active[0]?.status === "draft") throw new Error(`当前已有V${active[0].versionNo}抽签草稿，请先确认或作废。`);
  if (active[0]?.status === "confirmed") throw new Error(`当前已有V${active[0].versionNo}正式抽签；如需重抽，请先作废原版本并填写原因。`);

  const versionRows = await sql<Array<{ maxVersion: number }>>`select coalesce(max(version_no),0)::int as "maxVersion" from public.draw_sessions where event_id=${input.eventId} and group_id=${input.groupId} and phase_code=${input.phaseCode}`;
  const versionNo = (versionRows[0]?.maxVersion ?? 0) + 1;
  const sessionId = newId("draw");
  const createdAt = now();
  const randomSeed = randomBytes(32).toString("hex");
  const randomCommitment = createHash("sha256").update(randomSeed).digest("hex");
  const random = seededRandom(randomSeed);
  const randomized = shuffled(participants, random);

  const playoffPool = plan.playoffPlayerCount ? randomized.slice(0, plan.playoffPlayerCount) : [];
  const directPool = plan.playoffPlayerCount ? randomized.slice(plan.playoffPlayerCount) : randomized;
  const specialCount = plan.playoffMatchCount || plan.byeCount;
  const specialSlots = balancedSpecialSlots(plan.bracketSize, plan.divisionSize, specialCount, random);
  const specialSet = new Set(specialSlots);
  const ordinarySlots = shuffled(Array.from({ length: plan.bracketSize }, (_, index) => index + 1).filter((slot) => !specialSet.has(slot)), random);
  const directPlayers = shuffled(directPool, random);

  const prelimRows = Array.from({ length: plan.playoffMatchCount }, (_, index) => ({
    id: newId("prelim"), session_id: sessionId, match_no: index + 1,
    player_a_id: playoffPool[index * 2].playerId, player_a_name: playoffPool[index * 2].playerName,
    player_b_id: playoffPool[index * 2 + 1].playerId, player_b_name: playoffPool[index * 2 + 1].playerName,
    target_slot_no: specialSlots[index], status: "pending", winner_player_id: null, winner_player_name: null,
    created_at: createdAt, updated_at: createdAt,
  }));
  const prelimBySlot = new Map(prelimRows.map((row) => [row.target_slot_no, row]));
  const directBySlot = new Map<number, Participant>();
  ordinarySlots.forEach((slot, index) => { const player = directPlayers[index]; if (player) directBySlot.set(slot, player); });

  const assignment = new Map<string, { type: string; drawNo: string }>();
  for (const row of prelimRows) {
    assignment.set(row.player_a_id, { type: "playoff", drawNo: `附${pad(row.match_no)}-A` });
    assignment.set(row.player_b_id, { type: "playoff", drawNo: `附${pad(row.match_no)}-B` });
  }
  for (const [slot, player] of directBySlot) assignment.set(player.playerId, { type: "direct", drawNo: pad(slot) });

  const participantRows = randomized.map((player, index) => ({
    id: newId("dp"), session_id: sessionId, player_id: player.playerId, player_name: player.playerName,
    source_type: player.sourceType, seed_no: null, random_order: index + 1,
    assignment_type: assignment.get(player.playerId)!.type, display_draw_no: assignment.get(player.playerId)!.drawNo, created_at: createdAt,
  }));

  const slotRows = Array.from({ length: plan.bracketSize }, (_, index) => {
    const slotNo = index + 1;
    const prelim = prelimBySlot.get(slotNo);
    const player = directBySlot.get(slotNo);
    return {
      id: newId("slot"), session_id: sessionId, slot_no: slotNo,
      division_no: Math.ceil(slotNo / plan.divisionSize), division_slot_no: ((slotNo - 1) % plan.divisionSize) + 1,
      slot_type: prelim ? "playoff_winner" : specialSet.has(slotNo) && plan.byeCount ? "bye" : "player",
      player_id: player?.playerId ?? null, player_name: player?.playerName ?? null, prelim_match_id: prelim?.id ?? null, created_at: createdAt,
    };
  });

  const settingsId = `cps_${createHash("sha1").update(`${input.eventId}|${input.groupId}|${input.phaseCode}`).digest("hex").slice(0, 24)}`;
  const seedFillRule = input.seedFillRule || "game_win_rate";
  const rulesJson = JSON.stringify({
    draw_scope: "single_draw_to_direct_qualifiers",
    qualification_rule: "division_winner_plus_final_loser_game_win_rate",
    division_size: plan.divisionSize,
    division_count: plan.divisionCount,
    direct_qualifiers: plan.directQualifierCount,
    rate_qualifiers: plan.rateQualifierCount,
    rate_pool: "division_final_losers",
    rate_metric: "game_win_rate",
    seed_absence_fill_rule: seedFillRule,
  });

  await sql.begin(async (tx) => {
    await tx`insert into public.competition_phase_settings (id,event_id,group_id,phase_code,bracket_size,division_size,rate_qualifier_count,seeds_enabled,seed_target_count,seed_fill_rule,allow_playoff,allow_bye,created_at,updated_at)
      values (${settingsId},${input.eventId},${input.groupId},${input.phaseCode},${plan.bracketSize},${plan.divisionSize},${plan.rateQualifierCount},${Boolean(input.seedsEnabled)},${Number(input.seedTargetCount || 0)},${seedFillRule},true,true,${createdAt},${createdAt})
      on conflict (event_id,group_id,phase_code) do update set bracket_size=excluded.bracket_size,division_size=excluded.division_size,rate_qualifier_count=excluded.rate_qualifier_count,seeds_enabled=excluded.seeds_enabled,seed_target_count=excluded.seed_target_count,seed_fill_rule=excluded.seed_fill_rule,updated_at=excluded.updated_at`;

    await tx`insert into public.draw_sessions (id,event_id,group_id,phase_code,version_no,status,entrant_count,bracket_size,division_size,division_count,direct_qualifier_count,rate_qualifier_count,total_qualifier_count,playoff_match_count,playoff_player_count,bye_count,seeds_enabled,seed_target_count,seed_fill_rule,random_seed,random_commitment,rules_json,created_by,created_at)
      values (${sessionId},${input.eventId},${input.groupId},${input.phaseCode},${versionNo},'draft',${plan.entrantCount},${plan.bracketSize},${plan.divisionSize},${plan.divisionCount},${plan.directQualifierCount},${plan.rateQualifierCount},${plan.totalQualifierCount},${plan.playoffMatchCount},${plan.playoffPlayerCount},${plan.byeCount},${Boolean(input.seedsEnabled)},${Number(input.seedTargetCount || 0)},${seedFillRule},${randomSeed},${randomCommitment},${rulesJson}::jsonb,${viewer.id},${createdAt})`;

    await insertScalarRows(tx,
      "insert into public.draw_prelim_matches (id,session_id,match_no,player_a_id,player_a_name,player_b_id,player_b_name,target_slot_no,status,winner_player_id,winner_player_name,created_at,updated_at)",
      13,
      prelimRows.map((row) => [row.id,row.session_id,row.match_no,row.player_a_id,row.player_a_name,row.player_b_id,row.player_b_name,row.target_slot_no,row.status,row.winner_player_id,row.winner_player_name,row.created_at,row.updated_at]),
    );

    await insertScalarRows(tx,
      "insert into public.draw_participants (id,session_id,player_id,player_name,source_type,seed_no,random_order,assignment_type,display_draw_no,created_at)",
      10,
      participantRows.map((row) => [row.id,row.session_id,row.player_id,row.player_name,row.source_type,row.seed_no,row.random_order,row.assignment_type,row.display_draw_no,row.created_at]),
    );

    await insertScalarRows(tx,
      "insert into public.draw_slots (id,session_id,slot_no,division_no,division_slot_no,slot_type,player_id,player_name,prelim_match_id,created_at)",
      10,
      slotRows.map((row) => [row.id,row.session_id,row.slot_no,row.division_no,row.division_slot_no,row.slot_type,row.player_id,row.player_name,row.prelim_match_id,row.created_at]),
    );

    await tx`insert into public.audit_logs (id,actor_user_id,event_id,module_type,target_type,target_id,action,after_json,created_at)
      values (${newId("log")},${viewer.id},${input.eventId},'competition','draw_session',${sessionId},'create_draw_draft',${JSON.stringify({ groupId: input.groupId, phaseCode: input.phaseCode, versionNo, entrantCount: plan.entrantCount, bracketSize: plan.bracketSize, divisionSize: plan.divisionSize, playoffMatchCount: plan.playoffMatchCount, byeCount: plan.byeCount, randomCommitment })},${createdAt})`;
  });

  return getDrawSessionDetail(username, sessionId);
}
