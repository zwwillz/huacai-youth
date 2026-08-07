import { createHash, randomBytes, randomUUID } from "node:crypto";
import { getSqlClient } from "./index";
import { getDrawSessionDetail, type DrawPhaseCode, type DrawSessionDetail } from "./draw-engine";

export type MainPhaseCode = "main-one" | "main-two";

type Viewer = { id: string; role: string };
type Entry = { playerId: string; playerName: string; sourceType: string; sourceRef: string | null; sortOrder: number };
type Session = {
  id: string; eventId: string; groupId: string; phaseCode: MainPhaseCode; status: string;
  bracketSize: number; divisionSize: number; divisionCount: number;
};

type MatchRow = {
  id: string; bracket_id: string; draw_session_id: string; event_id: string; group_id: string; phase_code: string;
  match_type: string; division_no: number | null; round_no: number; round_name: string; match_no: number; match_code: string;
  player_a_id: string | null; player_a_name: string | null; player_b_id: string | null; player_b_name: string | null;
  source_a_type: string; source_a_ref: string | null; source_b_type: string; source_b_ref: string | null;
  status: string; winner_player_id: string | null; winner_player_name: string | null; result_type: string | null;
  sort_order: number; created_at: string; updated_at: string;
};
type LinkRow = { id: string; bracket_id: string; source_match_id: string; source_result: string; target_match_id: string; target_side: string; created_at: string };

type MainStageWorkspace = {
  viewerRole: string;
  event: { id: string; shortTitle: string };
  groups: Array<{ id: string; name: string; code: string }>;
  selectedGroupId: string;
  selectedPhase: MainPhaseCode;
  phaseTitle: string;
  sourceCount: number;
  sourceReady: boolean;
  sourceNote: string;
  seedCount: number;
  latestSession: null | { id: string; versionNo: number; status: string; entrantCount: number; createdAt: string; confirmedAt: string | null };
};

function now() { return new Date().toISOString(); }
function newId(prefix: string) { return `${prefix}_${randomUUID().replaceAll("-", "")}`; }
function phaseTitle(phase: MainPhaseCode) { return phase === "main-one" ? "正赛第一阶段" : "正赛第二阶段"; }

async function requireViewer(username: string, confirm = false): Promise<Viewer> {
  const sql = getSqlClient();
  const rows = await sql<Viewer[]>`select id,role from public.users where username=${username} and status='active' limit 1`;
  const viewer = rows[0];
  if (!viewer || !["system_admin","committee","referee"].includes(viewer.role)) throw new Error("当前账号没有竞赛执行权限。");
  if (confirm && !["system_admin","committee"].includes(viewer.role)) throw new Error("正式抽签需要系统管理员或组委会权限。");
  return viewer;
}

async function loadEntries(eventId: string, groupId: string, phase: MainPhaseCode): Promise<Entry[]> {
  const sql = getSqlClient();
  return sql<Entry[]>`
    select player_id as "playerId",player_name as "playerName",source_type as "sourceType",source_ref as "sourceRef",sort_order as "sortOrder"
    from public.competition_phase_entries
    where event_id=${eventId} and group_id=${groupId} and phase_code=${phase} and status='active'
    order by sort_order,player_name,player_id
  `;
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

export async function getMainStageWorkspaceData(username: string, eventId: string, groupId: string | undefined, phase: MainPhaseCode): Promise<MainStageWorkspace> {
  const viewer = await requireViewer(username);
  const sql = getSqlClient();
  const events = await sql<Array<{ id: string; shortTitle: string }>>`select id,short_title as "shortTitle" from public.events where id=${eventId} limit 1`;
  if (!events[0]) throw new Error("没有找到这场赛事。");
  const groups = await sql<Array<{ id: string; name: string; code: string }>>`select id,name,code from public.event_groups where event_id=${eventId} and status='active' order by code`;
  if (!groups.length) throw new Error("这场赛事还没有组别。");
  const selectedGroupId = groups.some((item) => item.id === groupId) ? String(groupId) : groups[0].id;
  const entries = await loadEntries(eventId, selectedGroupId, phase);
  const required = phase === "main-one" ? 64 : 32;
  const seeds = phase === "main-one" ? entries.filter((item) => item.sourceType === "seed").length : entries.filter((item) => item.sourceType === "winner_side_qualified").length;
  const sourceReady = entries.length === required && (phase === "main-two" || seeds === 16);
  const sourceNote = sourceReady
    ? phase === "main-one" ? "64人正赛名单已就绪：48名资格赛晋级 + 16名种子。" : "正赛第一阶段32名晋级球员已确认，可以进行正赛第二阶段抽签。"
    : phase === "main-one"
      ? `当前正赛名单 ${entries.length}/64，种子 ${seeds}/16；需名单完整后才能正式抽签。`
      : `当前32强名单 ${entries.length}/32；需正赛第一阶段全部晋级结果确认后才能正式抽签。`;
  const sessions = await sql<Array<{ id: string; versionNo: number; status: string; entrantCount: number; createdAt: string; confirmedAt: string | null }>>`
    select id,version_no as "versionNo",status,entrant_count as "entrantCount",created_at as "createdAt",confirmed_at as "confirmedAt"
    from public.draw_sessions where event_id=${eventId} and group_id=${selectedGroupId} and phase_code=${phase}
    order by version_no desc limit 1
  `;
  return { viewerRole: viewer.role, event: events[0], groups, selectedGroupId, selectedPhase: phase, phaseTitle: phaseTitle(phase), sourceCount: entries.length, sourceReady, sourceNote, seedCount: seeds, latestSession: sessions[0] ?? null };
}

export async function createMainStageDraw(username: string, input: { eventId: string; groupId: string; phaseCode: MainPhaseCode }): Promise<DrawSessionDetail> {
  const viewer = await requireViewer(username, true);
  const entries = await loadEntries(input.eventId, input.groupId, input.phaseCode);
  const expected = input.phaseCode === "main-one" ? 64 : 32;
  if (entries.length !== expected) throw new Error(`${phaseTitle(input.phaseCode)}需要${expected}名球员，当前只有${entries.length}人。`);
  const seeds = entries.filter((item) => item.sourceType === "seed");
  if (input.phaseCode === "main-one" && seeds.length !== 16) throw new Error(`正赛第一阶段需要16名种子，当前只有${seeds.length}名。`);
  const sql = getSqlClient();
  const active = await sql<Array<{ status: string; versionNo: number }>>`
    select status,version_no as "versionNo" from public.draw_sessions
    where event_id=${input.eventId} and group_id=${input.groupId} and phase_code=${input.phaseCode} and status in ('draft','confirmed')
    order by version_no desc limit 1
  `;
  if (active[0]) throw new Error(`当前已有V${active[0].versionNo}${active[0].status === "confirmed" ? "正式抽签" : "抽签草稿"}，如需重抽请先作废原版本。`);
  const versions = await sql<Array<{ value: number }>>`select coalesce(max(version_no),0)::int as value from public.draw_sessions where event_id=${input.eventId} and group_id=${input.groupId} and phase_code=${input.phaseCode}`;
  const versionNo = (versions[0]?.value ?? 0) + 1;
  const sessionId = newId("draw");
  const createdAt = now();
  const randomSeed = randomBytes(32).toString("hex");
  const randomCommitment = createHash("sha256").update(randomSeed).digest("hex");
  const random = seededRandom(randomSeed);
  const bracketSize = expected;
  const divisionSize = input.phaseCode === "main-one" ? 8 : 32;
  const divisionCount = input.phaseCode === "main-one" ? 8 : 1;
  const slots = new Map<number, Entry>();

  if (input.phaseCode === "main-one") {
    const qualifierPool = shuffled(entries.filter((item) => item.sourceType !== "seed"), random);
    // 蛇形种子：1-8号种子进入1-8组第一种子位；9-16号种子反向进入8-1组第二种子位。
    const orderedSeeds = [...seeds].sort((a, b) => a.sortOrder - b.sortOrder);
    for (let index = 0; index < 8; index += 1) slots.set(index * 8 + 1, orderedSeeds[index]);
    for (let index = 0; index < 8; index += 1) slots.set((7 - index) * 8 + 8, orderedSeeds[index + 8]);
    const free = Array.from({ length: 64 }, (_, index) => index + 1).filter((slot) => !slots.has(slot));
    free.forEach((slot, index) => slots.set(slot, qualifierPool[index]));
  } else {
    const winnerSide = shuffled(entries.filter((item) => item.sourceType === "winner_side_qualified"), random);
    const loserSide = shuffled(entries.filter((item) => item.sourceType !== "winner_side_qualified"), random);
    if (winnerSide.length !== 16 || loserSide.length !== 16) throw new Error("正赛第二阶段需要16名胜部晋级和16名败部晋级球员。请先确认正赛第一阶段晋级名单。");
    for (let index = 0; index < 16; index += 1) {
      slots.set(index * 2 + 1, winnerSide[index]);
      slots.set(index * 2 + 2, loserSide[index]);
    }
  }

  const assignment = [...slots.entries()].sort((a, b) => a[0] - b[0]);
  const participantRows = assignment.map(([slot, player], index) => ({
    id: newId("dp"), session_id: sessionId, player_id: player.playerId, player_name: player.playerName, source_type: player.sourceType,
    seed_no: player.sourceType === "seed" ? Math.max(1, player.sortOrder - 48) : null, random_order: index + 1,
    assignment_type: player.sourceType === "seed" || player.sourceType === "winner_side_qualified" ? "seed" : "direct",
    display_draw_no: String(slot).padStart(2, "0"), created_at: createdAt,
  }));
  const slotRows = assignment.map(([slot, player]) => ({
    id: newId("slot"), session_id: sessionId, slot_no: slot, division_no: Math.ceil(slot / divisionSize), division_slot_no: ((slot - 1) % divisionSize) + 1,
    slot_type: player.sourceType === "seed" || player.sourceType === "winner_side_qualified" ? "seed" : "player", player_id: player.playerId, player_name: player.playerName,
    prelim_match_id: null, created_at: createdAt,
  }));
  const rules = input.phaseCode === "main-one"
    ? { format: "8_groups_double_elimination_to_32", group_size: 8, seed_count: 16, seed_rule: "snake_two_seeds_per_group", qualifiers_per_group: 4 }
    : { format: "32_single_elimination", winner_side_seed_count: 16, seed_rule: "winner_side_seed_positions_loser_side_random", third_place_match: true };

  await sql.begin(async (tx) => {
    await tx`insert into public.competition_phase_settings
      (id,event_id,group_id,phase_code,bracket_size,division_size,rate_qualifier_count,seeds_enabled,seed_target_count,seed_fill_rule,allow_playoff,allow_bye,created_at,updated_at)
      values (${`cps_${input.eventId}_${input.groupId}_${input.phaseCode}`},${input.eventId},${input.groupId},${input.phaseCode},${bracketSize},${divisionSize},0,${input.phaseCode === "main-one"},${input.phaseCode === "main-one" ? 16 : 0},'game_win_rate',false,false,${createdAt},${createdAt})
      on conflict (event_id,group_id,phase_code) do update set bracket_size=excluded.bracket_size,division_size=excluded.division_size,seeds_enabled=excluded.seeds_enabled,seed_target_count=excluded.seed_target_count,updated_at=excluded.updated_at`;
    await tx`insert into public.draw_sessions
      (id,event_id,group_id,phase_code,version_no,status,entrant_count,bracket_size,division_size,division_count,direct_qualifier_count,rate_qualifier_count,total_qualifier_count,playoff_match_count,playoff_player_count,bye_count,seeds_enabled,seed_target_count,seed_fill_rule,random_seed,random_commitment,rules_json,created_by,created_at)
      values (${sessionId},${input.eventId},${input.groupId},${input.phaseCode},${versionNo},'draft',${expected},${bracketSize},${divisionSize},${divisionCount},${input.phaseCode === "main-one" ? 32 : 1},0,${input.phaseCode === "main-one" ? 32 : 1},0,0,0,${input.phaseCode === "main-one"},${input.phaseCode === "main-one" ? 16 : 0},'game_win_rate',${randomSeed},${randomCommitment},${JSON.stringify(rules)}::jsonb,${viewer.id},${createdAt})`;
    await tx`insert into public.draw_participants (id,session_id,player_id,player_name,source_type,seed_no,random_order,assignment_type,display_draw_no,created_at)
      select x.id,x.session_id,x.player_id,x.player_name,x.source_type,x.seed_no,x.random_order,x.assignment_type,x.display_draw_no,x.created_at
      from jsonb_to_recordset(${JSON.stringify(participantRows)}::jsonb) as x(id text,session_id text,player_id text,player_name text,source_type text,seed_no int,random_order int,assignment_type text,display_draw_no text,created_at text)`;
    await tx`insert into public.draw_slots (id,session_id,slot_no,division_no,division_slot_no,slot_type,player_id,player_name,prelim_match_id,created_at)
      select x.id,x.session_id,x.slot_no,x.division_no,x.division_slot_no,x.slot_type,x.player_id,x.player_name,x.prelim_match_id,x.created_at
      from jsonb_to_recordset(${JSON.stringify(slotRows)}::jsonb) as x(id text,session_id text,slot_no int,division_no int,division_slot_no int,slot_type text,player_id text,player_name text,prelim_match_id text,created_at text)`;
    await tx`insert into public.audit_logs (id,actor_user_id,event_id,module_type,target_type,target_id,action,after_json,created_at)
      values (${newId("log")},${viewer.id},${input.eventId},'competition','draw_session',${sessionId},'create_main_draw_draft',${JSON.stringify({ phaseCode: input.phaseCode, entrantCount: expected, versionNo, rules })},${createdAt})`;
  });
  return getDrawSessionDetail(username, sessionId);
}

async function loadSession(sessionId: string): Promise<Session> {
  const sql = getSqlClient();
  const rows = await sql<Session[]>`select id,event_id as "eventId",group_id as "groupId",phase_code as "phaseCode",status,bracket_size as "bracketSize",division_size as "divisionSize",division_count as "divisionCount" from public.draw_sessions where id=${sessionId} limit 1`;
  const row = rows[0];
  if (!row || !["main-one","main-two"].includes(row.phaseCode)) throw new Error("没有找到正赛抽签版本。");
  return row;
}

function makeMatch(base: Omit<MatchRow,"id"|"created_at"|"updated_at"|"status"|"winner_player_id"|"winner_player_name"|"result_type">, createdAt: string): MatchRow {
  return { ...base, id: newId("bm"), status: "pending", winner_player_id: null, winner_player_name: null, result_type: null, created_at: createdAt, updated_at: createdAt };
}
function addLink(links: LinkRow[], bracketId: string, source: MatchRow, result: "winner"|"loser", target: MatchRow, side: "A"|"B", createdAt: string) {
  links.push({ id: newId("ml"), bracket_id: bracketId, source_match_id: source.id, source_result: result, target_match_id: target.id, target_side: side, created_at: createdAt });
}

export async function generateMainStageBracket(username: string, sessionId: string): Promise<string> {
  const viewer = await requireViewer(username, true);
  const session = await loadSession(sessionId);
  if (session.status !== "confirmed") throw new Error("请先确认正赛抽签，再生成比赛关系。");
  const sql = getSqlClient();
  const existing = await sql<Array<{ id: string }>>`select id from public.competition_brackets where draw_session_id=${sessionId} limit 1`;
  if (existing[0]) return existing[0].id;
  const slots = await sql<Array<{ slotNo: number; playerId: string; playerName: string }>>`
    select slot_no as "slotNo",player_id as "playerId",player_name as "playerName" from public.draw_slots where session_id=${sessionId} order by slot_no
  `;
  if (slots.length !== session.bracketSize) throw new Error("正赛签位数据不完整。");
  const bySlot = new Map(slots.map((item) => [item.slotNo,item]));
  const bracketId = newId("bracket");
  const createdAt = now();
  const matches: MatchRow[] = [];
  const links: LinkRow[] = [];
  let sort = 0;

  if (session.phaseCode === "main-one") {
    const letters = ["A","B","C","D","E","F","G","H"];
    for (let groupIndex = 0; groupIndex < 8; groupIndex += 1) {
      const groupNo = groupIndex + 1;
      const prefix = letters[groupIndex];
      const baseSlot = groupIndex * 8;
      const first: MatchRow[] = [];
      for (let matchNo = 1; matchNo <= 4; matchNo += 1) {
        const a = bySlot.get(baseSlot + (matchNo - 1) * 2 + 1)!;
        const b = bySlot.get(baseSlot + (matchNo - 1) * 2 + 2)!;
        const row = makeMatch({ bracket_id: bracketId,draw_session_id:session.id,event_id:session.eventId,group_id:session.groupId,phase_code:session.phaseCode,match_type:"main_double",division_no:groupNo,round_no:1,round_name:"小组第一轮",match_no:matchNo,match_code:`${prefix}${matchNo}`,player_a_id:a.playerId,player_a_name:a.playerName,player_b_id:b.playerId,player_b_name:b.playerName,source_a_type:"slot",source_a_ref:String(a.slotNo),source_b_type:"slot",source_b_ref:String(b.slotNo),sort_order:++sort },createdAt);
        first.push(row); matches.push(row);
      }
      const loserOne = makeMatch({ bracket_id:bracketId,draw_session_id:session.id,event_id:session.eventId,group_id:session.groupId,phase_code:session.phaseCode,match_type:"main_double",division_no:groupNo,round_no:2,round_name:"败部第一轮",match_no:1,match_code:`${prefix}5`,player_a_id:null,player_a_name:null,player_b_id:null,player_b_name:null,source_a_type:"loser",source_a_ref:first[0].id,source_b_type:"loser",source_b_ref:first[1].id,sort_order:++sort },createdAt);
      const loserTwo = makeMatch({ bracket_id:bracketId,draw_session_id:session.id,event_id:session.eventId,group_id:session.groupId,phase_code:session.phaseCode,match_type:"main_double",division_no:groupNo,round_no:2,round_name:"败部第一轮",match_no:2,match_code:`${prefix}6`,player_a_id:null,player_a_name:null,player_b_id:null,player_b_name:null,source_a_type:"loser",source_a_ref:first[2].id,source_b_type:"loser",source_b_ref:first[3].id,sort_order:++sort },createdAt);
      const winnerOne = makeMatch({ bracket_id:bracketId,draw_session_id:session.id,event_id:session.eventId,group_id:session.groupId,phase_code:session.phaseCode,match_type:"main_double",division_no:groupNo,round_no:2,round_name:"胜部晋级轮",match_no:1,match_code:`${prefix}7`,player_a_id:null,player_a_name:null,player_b_id:null,player_b_name:null,source_a_type:"winner",source_a_ref:first[0].id,source_b_type:"winner",source_b_ref:first[1].id,sort_order:++sort },createdAt);
      const winnerTwo = makeMatch({ bracket_id:bracketId,draw_session_id:session.id,event_id:session.eventId,group_id:session.groupId,phase_code:session.phaseCode,match_type:"main_double",division_no:groupNo,round_no:2,round_name:"胜部晋级轮",match_no:2,match_code:`${prefix}8`,player_a_id:null,player_a_name:null,player_b_id:null,player_b_name:null,source_a_type:"winner",source_a_ref:first[2].id,source_b_type:"winner",source_b_ref:first[3].id,sort_order:++sort },createdAt);
      const loserQualOne = makeMatch({ bracket_id:bracketId,draw_session_id:session.id,event_id:session.eventId,group_id:session.groupId,phase_code:session.phaseCode,match_type:"main_double",division_no:groupNo,round_no:3,round_name:"败部晋级轮",match_no:1,match_code:`${prefix}9`,player_a_id:null,player_a_name:null,player_b_id:null,player_b_name:null,source_a_type:"loser",source_a_ref:winnerOne.id,source_b_type:"winner",source_b_ref:loserOne.id,sort_order:++sort },createdAt);
      const loserQualTwo = makeMatch({ bracket_id:bracketId,draw_session_id:session.id,event_id:session.eventId,group_id:session.groupId,phase_code:session.phaseCode,match_type:"main_double",division_no:groupNo,round_no:3,round_name:"败部晋级轮",match_no:2,match_code:`${prefix}10`,player_a_id:null,player_a_name:null,player_b_id:null,player_b_name:null,source_a_type:"loser",source_a_ref:winnerTwo.id,source_b_type:"winner",source_b_ref:loserTwo.id,sort_order:++sort },createdAt);
      matches.push(loserOne,loserTwo,winnerOne,winnerTwo,loserQualOne,loserQualTwo);
      addLink(links,bracketId,first[0],"loser",loserOne,"A",createdAt); addLink(links,bracketId,first[1],"loser",loserOne,"B",createdAt);
      addLink(links,bracketId,first[2],"loser",loserTwo,"A",createdAt); addLink(links,bracketId,first[3],"loser",loserTwo,"B",createdAt);
      addLink(links,bracketId,first[0],"winner",winnerOne,"A",createdAt); addLink(links,bracketId,first[1],"winner",winnerOne,"B",createdAt);
      addLink(links,bracketId,first[2],"winner",winnerTwo,"A",createdAt); addLink(links,bracketId,first[3],"winner",winnerTwo,"B",createdAt);
      addLink(links,bracketId,winnerOne,"loser",loserQualOne,"A",createdAt); addLink(links,bracketId,loserOne,"winner",loserQualOne,"B",createdAt);
      addLink(links,bracketId,winnerTwo,"loser",loserQualTwo,"A",createdAt); addLink(links,bracketId,loserTwo,"winner",loserQualTwo,"B",createdAt);
    }
  } else {
    let previous: MatchRow[] = [];
    for (let roundNo = 1; roundNo <= 5; roundNo += 1) {
      const count = 32 / Math.pow(2, roundNo);
      const round: MatchRow[] = [];
      for (let matchNo = 1; matchNo <= count; matchNo += 1) {
        const sourceA = roundNo === 1 ? bySlot.get((matchNo - 1) * 2 + 1)! : null;
        const sourceB = roundNo === 1 ? bySlot.get((matchNo - 1) * 2 + 2)! : null;
        const prevA = roundNo > 1 ? previous[(matchNo - 1) * 2] : null;
        const prevB = roundNo > 1 ? previous[(matchNo - 1) * 2 + 1] : null;
        const before = 32 / Math.pow(2, roundNo - 1); const after = before / 2;
        const name = roundNo === 4 ? "半决赛" : roundNo === 5 ? "决赛" : `${before}进${after}`;
        const row = makeMatch({ bracket_id:bracketId,draw_session_id:session.id,event_id:session.eventId,group_id:session.groupId,phase_code:session.phaseCode,match_type:"main_single",division_no:null,round_no:roundNo,round_name:name,match_no:matchNo,match_code:`M2-R${roundNo}-M${String(matchNo).padStart(2,"0")}`,player_a_id:sourceA?.playerId ?? null,player_a_name:sourceA?.playerName ?? null,player_b_id:sourceB?.playerId ?? null,player_b_name:sourceB?.playerName ?? null,source_a_type:roundNo===1?"slot":"winner",source_a_ref:roundNo===1?String(sourceA!.slotNo):prevA!.id,source_b_type:roundNo===1?"slot":"winner",source_b_ref:roundNo===1?String(sourceB!.slotNo):prevB!.id,sort_order:++sort },createdAt);
        round.push(row); matches.push(row);
        if (prevA) addLink(links,bracketId,prevA,"winner",row,"A",createdAt);
        if (prevB) addLink(links,bracketId,prevB,"winner",row,"B",createdAt);
      }
      previous = round;
    }
    const semifinals = matches.filter((item) => item.round_no === 4);
    const third = makeMatch({ bracket_id:bracketId,draw_session_id:session.id,event_id:session.eventId,group_id:session.groupId,phase_code:session.phaseCode,match_type:"third_place",division_no:null,round_no:5,round_name:"三、四名决赛",match_no:2,match_code:"M2-3RD",player_a_id:null,player_a_name:null,player_b_id:null,player_b_name:null,source_a_type:"loser",source_a_ref:semifinals[0].id,source_b_type:"loser",source_b_ref:semifinals[1].id,sort_order:++sort },createdAt);
    matches.push(third);
    addLink(links,bracketId,semifinals[0],"loser",third,"A",createdAt); addLink(links,bracketId,semifinals[1],"loser",third,"B",createdAt);
  }

  await sql.begin(async (tx) => {
    await tx`insert into public.competition_brackets (id,draw_session_id,event_id,group_id,phase_code,status,division_count,division_size,playoff_match_count,playable_match_count,total_node_count,generated_by,generated_at,updated_at)
      values (${bracketId},${session.id},${session.eventId},${session.groupId},${session.phaseCode},'confirmed',${session.divisionCount},${session.divisionSize},0,${matches.length},${matches.length},${viewer.id},${createdAt},${createdAt})`;
    await tx`insert into public.competition_bracket_matches
      (id,bracket_id,draw_session_id,event_id,group_id,phase_code,match_type,division_no,round_no,round_name,match_no,match_code,player_a_id,player_a_name,player_b_id,player_b_name,source_a_type,source_a_ref,source_b_type,source_b_ref,status,winner_player_id,winner_player_name,result_type,sort_order,created_at,updated_at)
      select x.id,x.bracket_id,x.draw_session_id,x.event_id,x.group_id,x.phase_code,x.match_type,x.division_no,x.round_no,x.round_name,x.match_no,x.match_code,x.player_a_id,x.player_a_name,x.player_b_id,x.player_b_name,x.source_a_type,x.source_a_ref,x.source_b_type,x.source_b_ref,x.status,x.winner_player_id,x.winner_player_name,x.result_type,x.sort_order,x.created_at,x.updated_at
      from jsonb_to_recordset(${JSON.stringify(matches)}::jsonb) as x(id text,bracket_id text,draw_session_id text,event_id text,group_id text,phase_code text,match_type text,division_no int,round_no int,round_name text,match_no int,match_code text,player_a_id text,player_a_name text,player_b_id text,player_b_name text,source_a_type text,source_a_ref text,source_b_type text,source_b_ref text,status text,winner_player_id text,winner_player_name text,result_type text,sort_order int,created_at text,updated_at text)`;
    if (links.length) await tx`insert into public.competition_match_links (id,bracket_id,source_match_id,source_result,target_match_id,target_side,created_at)
      select x.id,x.bracket_id,x.source_match_id,x.source_result,x.target_match_id,x.target_side,x.created_at
      from jsonb_to_recordset(${JSON.stringify(links)}::jsonb) as x(id text,bracket_id text,source_match_id text,source_result text,target_match_id text,target_side text,created_at text)`;
    await tx`insert into public.audit_logs (id,actor_user_id,event_id,module_type,target_type,target_id,action,after_json,created_at)
      values (${newId("log")},${viewer.id},${session.eventId},'competition','competition_bracket',${bracketId},'generate_main_bracket',${JSON.stringify({ phaseCode:session.phaseCode,totalMatches:matches.length })},${createdAt})`;
  });
  return bracketId;
}

export async function maybeBuildMainTwoRoster(eventId: string, groupId: string) {
  const sql = getSqlClient();
  const rows = await sql<Array<{ id: string; matchCode: string; roundName: string; winnerPlayerId: string | null; winnerPlayerName: string | null; resultStatus: string }>>`
    select id,match_code as "matchCode",round_name as "roundName",winner_player_id as "winnerPlayerId",winner_player_name as "winnerPlayerName",result_status as "resultStatus"
    from public.competition_bracket_matches
    where event_id=${eventId} and group_id=${groupId} and phase_code='main-one' and round_name in ('胜部晋级轮','败部晋级轮')
    order by division_no,match_code
  `;
  if (rows.length !== 32 || rows.some((item) => item.resultStatus !== "confirmed" || !item.winnerPlayerId || !item.winnerPlayerName)) return { ready:false,count:rows.filter((item)=>item.resultStatus === "confirmed").length };
  const timestamp = now();
  const mapped = rows.map((item,index) => ({ id:newId("pe"),event_id:eventId,group_id:groupId,phase_code:"main-two",player_id:item.winnerPlayerId!,player_name:item.winnerPlayerName!,source_type:item.roundName === "胜部晋级轮" ? "winner_side_qualified" : "loser_side_qualified",source_ref:item.id,status:"active",sort_order:index+1,created_at:timestamp,updated_at:timestamp }));
  await sql.begin(async (tx) => {
    const active = await tx<Array<{ count:number }>>`select count(*)::int as count from public.draw_sessions where event_id=${eventId} and group_id=${groupId} and phase_code='main-two' and status in ('draft','confirmed')`;
    if ((active[0]?.count ?? 0) > 0) return;
    await tx`delete from public.competition_phase_entries where event_id=${eventId} and group_id=${groupId} and phase_code='main-two'`;
    await tx`insert into public.competition_phase_entries (id,event_id,group_id,phase_code,player_id,player_name,source_type,source_ref,status,sort_order,created_at,updated_at)
      select x.id,x.event_id,x.group_id,x.phase_code,x.player_id,x.player_name,x.source_type,x.source_ref,x.status,x.sort_order,x.created_at,x.updated_at
      from jsonb_to_recordset(${JSON.stringify(mapped)}::jsonb) as x(id text,event_id text,group_id text,phase_code text,player_id text,player_name text,source_type text,source_ref text,status text,sort_order int,created_at text,updated_at text)`;
  });
  return { ready:true,count:32 };
}

export function isMainPhase(value: DrawPhaseCode | string): value is MainPhaseCode { return value === "main-one" || value === "main-two"; }
