import { randomUUID } from "node:crypto";
import { getSqlClient } from "./index";
import { requireEventAccess } from "./permissions";

type Viewer = { id: string; role: string };
type DrawSessionRow = {
  id: string;
  eventId: string;
  groupId: string;
  phaseCode: string;
  status: string;
  bracketSize: number;
  divisionSize: number;
  divisionCount: number;
  playoffMatchCount: number;
  eventTitle: string;
  groupName: string;
  phaseTitle: string;
};
type DrawSlotRow = {
  slotNo: number;
  divisionNo: number;
  divisionSlotNo: number;
  slotType: string;
  playerId: string | null;
  playerName: string | null;
  prelimMatchId: string | null;
};
type DrawPrelimRow = {
  id: string;
  matchNo: number;
  playerAId: string | null;
  playerAName: string;
  playerBId: string | null;
  playerBName: string;
  targetSlotNo: number;
};

type Source = {
  type: "player" | "bye" | "winner";
  ref: string | null;
  playerId: string | null;
  playerName: string | null;
};

type MatchInsert = {
  id: string;
  bracket_id: string;
  draw_session_id: string;
  event_id: string;
  group_id: string;
  phase_code: string;
  match_type: string;
  division_no: number | null;
  round_no: number;
  round_name: string;
  match_no: number;
  match_code: string;
  player_a_id: string | null;
  player_a_name: string | null;
  player_b_id: string | null;
  player_b_name: string | null;
  source_a_type: string;
  source_a_ref: string | null;
  source_b_type: string;
  source_b_ref: string | null;
  status: string;
  winner_player_id: string | null;
  winner_player_name: string | null;
  result_type: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type LinkInsert = {
  id: string;
  bracket_id: string;
  source_match_id: string;
  source_result: string;
  target_match_id: string;
  target_side: string;
  created_at: string;
};

export type BracketMatch = {
  id: string;
  matchType: string;
  divisionNo: number | null;
  roundNo: number;
  roundName: string;
  matchNo: number;
  matchCode: string;
  playerAId: string | null;
  playerAName: string | null;
  playerBId: string | null;
  playerBName: string | null;
  sourceAType: string;
  sourceARef: string | null;
  sourceBType: string;
  sourceBRef: string | null;
  status: string;
  winnerPlayerId: string | null;
  winnerPlayerName: string | null;
  resultType: string | null;
  sortOrder: number;
};

export type BracketDetail = {
  bracket: {
    id: string;
    drawSessionId: string;
    eventId: string;
    groupId: string;
    phaseCode: string;
    status: string;
    divisionCount: number;
    divisionSize: number;
    playoffMatchCount: number;
    playableMatchCount: number;
    totalNodeCount: number;
    generatedAt: string;
    eventTitle: string;
    groupName: string;
    phaseTitle: string;
  };
  matches: BracketMatch[];
  links: Array<{ sourceMatchId: string; sourceResult: string; targetMatchId: string; targetSide: string }>;
};

function now() { return new Date().toISOString(); }
function newId(prefix: string) { return `${prefix}_${randomUUID().replaceAll("-", "")}`; }
function pad(value: number, width = 2) { return String(value).padStart(width, "0"); }

async function requireViewer(username: string, write = false): Promise<Viewer> {
  const sql = getSqlClient();
  const rows = await sql<Viewer[]>`select id,role from public.users where username=${username} and status='active' limit 1`;
  const viewer = rows[0];
  if (!viewer || !["system_admin", "committee", "referee"].includes(viewer.role)) throw new Error("当前账号没有竞赛执行权限。");
  if (write && !["system_admin", "committee", "referee"].includes(viewer.role)) throw new Error("当前账号没有生成签表的权限。");
  return viewer;
}

async function loadDrawSession(sessionId: string): Promise<DrawSessionRow> {
  const sql = getSqlClient();
  const rows = await sql<DrawSessionRow[]>`
    select ds.id,
      ds.event_id as "eventId", ds.group_id as "groupId", ds.phase_code as "phaseCode", ds.status,
      ds.bracket_size as "bracketSize", ds.division_size as "divisionSize", ds.division_count as "divisionCount",
      ds.playoff_match_count as "playoffMatchCount", e.short_title as "eventTitle", eg.name as "groupName",
      coalesce(ep.title, ds.phase_code) as "phaseTitle"
    from public.draw_sessions ds
    join public.events e on e.id=ds.event_id
    join public.event_groups eg on eg.id=ds.group_id
    left join public.event_phases ep on ep.event_id=ds.event_id and ep.code=ds.phase_code
    where ds.id=${sessionId}
    limit 1
  `;
  if (!rows[0]) throw new Error("没有找到这次抽签。");
  return rows[0];
}

function phasePrefix(code: string) {
  if (code === "qualifier-one") return "Q1";
  if (code === "qualifier-two") return "Q2";
  if (code === "main-one") return "M1";
  if (code === "main-two") return "M2";
  return "PH";
}

function roundName(divisionSize: number, roundNo: number) {
  const before = divisionSize / Math.pow(2, roundNo - 1);
  const after = before / 2;
  if (after === 1) return "分区决胜";
  return `${before}进${after}`;
}

function resolvedSourceFromMatch(match: MatchInsert): Source {
  return {
    type: "winner",
    ref: match.id,
    playerId: match.winner_player_id,
    playerName: match.winner_player_name,
  };
}

function sourceFromSlot(slot: DrawSlotRow, prelimMatchMap: Map<string, string>): Source {
  if (slot.slotType === "bye") return { type: "bye", ref: null, playerId: null, playerName: "BYE" };
  if (slot.slotType === "playoff_winner") {
    const ref = slot.prelimMatchId ? prelimMatchMap.get(slot.prelimMatchId) ?? null : null;
    if (!ref) throw new Error(`签位${slot.slotNo}缺少附加赛映射。`);
    return { type: "winner", ref, playerId: null, playerName: null };
  }
  if (!slot.playerId || !slot.playerName) throw new Error(`签位${slot.slotNo}没有球员数据。`);
  return { type: "player", ref: slot.playerId, playerId: slot.playerId, playerName: slot.playerName };
}

function makeDivisionMatch(input: {
  bracketId: string;
  session: DrawSessionRow;
  divisionNo: number;
  roundNo: number;
  matchNo: number;
  sourceA: Source;
  sourceB: Source;
  sortOrder: number;
  createdAt: string;
}): MatchInsert {
  const prefix = phasePrefix(input.session.phaseCode);
  const id = newId("bm");
  let status = "pending";
  let winnerPlayerId: string | null = null;
  let winnerPlayerName: string | null = null;
  let resultType: string | null = null;

  const aKnown = Boolean(input.sourceA.playerId && input.sourceA.playerName);
  const bKnown = Boolean(input.sourceB.playerId && input.sourceB.playerName);
  if (input.sourceA.type === "bye" && bKnown) {
    status = "auto_advanced";
    winnerPlayerId = input.sourceB.playerId;
    winnerPlayerName = input.sourceB.playerName;
    resultType = "bye";
  } else if (input.sourceB.type === "bye" && aKnown) {
    status = "auto_advanced";
    winnerPlayerId = input.sourceA.playerId;
    winnerPlayerName = input.sourceA.playerName;
    resultType = "bye";
  } else if (input.sourceA.type === "bye" && input.sourceB.type === "bye") {
    status = "void";
    resultType = "double_bye";
  }

  return {
    id,
    bracket_id: input.bracketId,
    draw_session_id: input.session.id,
    event_id: input.session.eventId,
    group_id: input.session.groupId,
    phase_code: input.session.phaseCode,
    match_type: "division",
    division_no: input.divisionNo,
    round_no: input.roundNo,
    round_name: roundName(input.session.divisionSize, input.roundNo),
    match_no: input.matchNo,
    match_code: `${prefix}-D${pad(input.divisionNo)}-R${input.roundNo}-M${pad(input.matchNo)}`,
    player_a_id: input.sourceA.playerId,
    player_a_name: input.sourceA.playerName,
    player_b_id: input.sourceB.playerId,
    player_b_name: input.sourceB.playerName,
    source_a_type: input.sourceA.type,
    source_a_ref: input.sourceA.ref,
    source_b_type: input.sourceB.type,
    source_b_ref: input.sourceB.ref,
    status,
    winner_player_id: winnerPlayerId,
    winner_player_name: winnerPlayerName,
    result_type: resultType,
    sort_order: input.sortOrder,
    created_at: input.createdAt,
    updated_at: input.createdAt,
  };
}

export async function generateBracketFromConfirmedDraw(username: string, sessionId: string): Promise<BracketDetail> {
  const viewer = await requireViewer(username, true);
  const session = await loadDrawSession(sessionId);
  await requireEventAccess(username, session.eventId, { write: true });
  if (session.status !== "confirmed") throw new Error("请先确认正式抽签，再生成完整签表和比赛关系。");
  const existing = await getBracketDetail(username, sessionId, true);
  if (existing) return existing;

  const sql = getSqlClient();
  const [slots, prelims] = await Promise.all([
    sql<DrawSlotRow[]>`
      select slot_no as "slotNo",division_no as "divisionNo",division_slot_no as "divisionSlotNo",slot_type as "slotType",
        player_id as "playerId",player_name as "playerName",prelim_match_id as "prelimMatchId"
      from public.draw_slots where session_id=${sessionId} order by slot_no
    `,
    sql<DrawPrelimRow[]>`
      select id,match_no as "matchNo",player_a_id as "playerAId",player_a_name as "playerAName",
        player_b_id as "playerBId",player_b_name as "playerBName",target_slot_no as "targetSlotNo"
      from public.draw_prelim_matches where session_id=${sessionId} order by match_no
    `,
  ]);
  if (slots.length !== session.bracketSize) throw new Error(`抽签签位数量异常：应有${session.bracketSize}个签位，当前只有${slots.length}个。`);

  const bracketId = newId("bracket");
  const createdAt = now();
  const matches: MatchInsert[] = [];
  const links: LinkInsert[] = [];
  const prelimMatchMap = new Map<string, string>();
  let sortOrder = 0;
  const prefix = phasePrefix(session.phaseCode);

  for (const prelim of prelims) {
    const divisionNo = Math.ceil(prelim.targetSlotNo / session.divisionSize);
    const matchId = newId("bm");
    prelimMatchMap.set(prelim.id, matchId);
    matches.push({
      id: matchId,
      bracket_id: bracketId,
      draw_session_id: session.id,
      event_id: session.eventId,
      group_id: session.groupId,
      phase_code: session.phaseCode,
      match_type: "playoff",
      division_no: divisionNo,
      round_no: 0,
      round_name: "附加赛",
      match_no: prelim.matchNo,
      match_code: `${prefix}-P${String(prelim.matchNo).padStart(3, "0")}`,
      player_a_id: prelim.playerAId,
      player_a_name: prelim.playerAName,
      player_b_id: prelim.playerBId,
      player_b_name: prelim.playerBName,
      source_a_type: "player",
      source_a_ref: prelim.playerAId,
      source_b_type: "player",
      source_b_ref: prelim.playerBId,
      status: "pending",
      winner_player_id: null,
      winner_player_name: null,
      result_type: null,
      sort_order: ++sortOrder,
      created_at: createdAt,
      updated_at: createdAt,
    });
  }

  const slotsByDivision = new Map<number, DrawSlotRow[]>();
  for (const slot of slots) {
    const list = slotsByDivision.get(slot.divisionNo) ?? [];
    list.push(slot);
    slotsByDivision.set(slot.divisionNo, list);
  }

  for (let divisionNo = 1; divisionNo <= session.divisionCount; divisionNo += 1) {
    const divisionSlots = (slotsByDivision.get(divisionNo) ?? []).sort((a, b) => a.divisionSlotNo - b.divisionSlotNo);
    if (divisionSlots.length !== session.divisionSize) throw new Error(`第${divisionNo}区签位数量不完整。`);
    let previousRound: MatchInsert[] = [];
    const totalRounds = Math.log2(session.divisionSize);

    for (let roundNo = 1; roundNo <= totalRounds; roundNo += 1) {
      const matchCount = session.divisionSize / Math.pow(2, roundNo);
      const currentRound: MatchInsert[] = [];
      for (let matchNo = 1; matchNo <= matchCount; matchNo += 1) {
        let sourceA: Source;
        let sourceB: Source;
        if (roundNo === 1) {
          sourceA = sourceFromSlot(divisionSlots[(matchNo - 1) * 2], prelimMatchMap);
          sourceB = sourceFromSlot(divisionSlots[(matchNo - 1) * 2 + 1], prelimMatchMap);
        } else {
          sourceA = resolvedSourceFromMatch(previousRound[(matchNo - 1) * 2]);
          sourceB = resolvedSourceFromMatch(previousRound[(matchNo - 1) * 2 + 1]);
        }
        const row = makeDivisionMatch({ bracketId, session, divisionNo, roundNo, matchNo, sourceA, sourceB, sortOrder: ++sortOrder, createdAt });
        currentRound.push(row);
        matches.push(row);

        if (sourceA.type === "winner" && sourceA.ref) links.push({ id: newId("ml"), bracket_id: bracketId, source_match_id: sourceA.ref, source_result: "winner", target_match_id: row.id, target_side: "A", created_at: createdAt });
        if (sourceB.type === "winner" && sourceB.ref) links.push({ id: newId("ml"), bracket_id: bracketId, source_match_id: sourceB.ref, source_result: "winner", target_match_id: row.id, target_side: "B", created_at: createdAt });
      }
      previousRound = currentRound;
    }
  }

  const playableMatchCount = matches.filter((match) => match.status === "pending").length;
  await sql.begin(async (tx) => {
    await tx`
      insert into public.competition_brackets
        (id,draw_session_id,event_id,group_id,phase_code,status,division_count,division_size,playoff_match_count,playable_match_count,total_node_count,generated_by,generated_at,updated_at)
      values
        (${bracketId},${session.id},${session.eventId},${session.groupId},${session.phaseCode},'draft',${session.divisionCount},${session.divisionSize},${session.playoffMatchCount},${playableMatchCount},${matches.length},${viewer.id},${createdAt},${createdAt})
    `;
    await tx`
      insert into public.competition_bracket_matches
        (id,bracket_id,draw_session_id,event_id,group_id,phase_code,match_type,division_no,round_no,round_name,match_no,match_code,player_a_id,player_a_name,player_b_id,player_b_name,source_a_type,source_a_ref,source_b_type,source_b_ref,status,winner_player_id,winner_player_name,result_type,sort_order,created_at,updated_at)
      select x.id,x.bracket_id,x.draw_session_id,x.event_id,x.group_id,x.phase_code,x.match_type,x.division_no,x.round_no,x.round_name,x.match_no,x.match_code,x.player_a_id,x.player_a_name,x.player_b_id,x.player_b_name,x.source_a_type,x.source_a_ref,x.source_b_type,x.source_b_ref,x.status,x.winner_player_id,x.winner_player_name,x.result_type,x.sort_order,x.created_at,x.updated_at
      from jsonb_to_recordset(${JSON.stringify(matches)}::jsonb) as x(
        id text,bracket_id text,draw_session_id text,event_id text,group_id text,phase_code text,match_type text,division_no int,round_no int,round_name text,match_no int,match_code text,player_a_id text,player_a_name text,player_b_id text,player_b_name text,source_a_type text,source_a_ref text,source_b_type text,source_b_ref text,status text,winner_player_id text,winner_player_name text,result_type text,sort_order int,created_at text,updated_at text
      )
    `;
    if (links.length) await tx`
      insert into public.competition_match_links (id,bracket_id,source_match_id,source_result,target_match_id,target_side,created_at)
      select x.id,x.bracket_id,x.source_match_id,x.source_result,x.target_match_id,x.target_side,x.created_at
      from jsonb_to_recordset(${JSON.stringify(links)}::jsonb) as x(id text,bracket_id text,source_match_id text,source_result text,target_match_id text,target_side text,created_at text)
    `;
    await tx`
      insert into public.audit_logs (id,actor_user_id,event_id,module_type,target_type,target_id,action,after_json,created_at)
      values (${newId("log")},${viewer.id},${session.eventId},'competition','competition_bracket',${bracketId},'generate_bracket',${JSON.stringify({ drawSessionId: session.id, divisionCount: session.divisionCount, divisionSize: session.divisionSize, playoffMatchCount: session.playoffMatchCount, playableMatchCount, totalNodeCount: matches.length })},${createdAt})
    `;
  });

  const detail = await getBracketDetail(username, sessionId);
  if (!detail) throw new Error("签表已经生成，但重新读取失败。");
  return detail;
}

export async function getBracketDetail(username: string, sessionId: string, allowMissing = false): Promise<BracketDetail | null> {
  await requireViewer(username);
  const sql = getSqlClient();
  const bracketRows = await sql<Array<BracketDetail["bracket"]>>`
    select b.id,b.draw_session_id as "drawSessionId",b.event_id as "eventId",b.group_id as "groupId",b.phase_code as "phaseCode",b.status,
      b.division_count as "divisionCount",b.division_size as "divisionSize",b.playoff_match_count as "playoffMatchCount",
      b.playable_match_count as "playableMatchCount",b.total_node_count as "totalNodeCount",b.generated_at as "generatedAt",
      e.short_title as "eventTitle",eg.name as "groupName",coalesce(ep.title,b.phase_code) as "phaseTitle"
    from public.competition_brackets b
    join public.events e on e.id=b.event_id
    join public.event_groups eg on eg.id=b.group_id
    left join public.event_phases ep on ep.event_id=b.event_id and ep.code=b.phase_code
    where b.draw_session_id=${sessionId}
    limit 1
  `;
  const bracket = bracketRows[0];
  if (!bracket) {
    if (allowMissing) return null;
    throw new Error("这次抽签还没有生成完整分区签表。");
  }
  await requireEventAccess(username, bracket.eventId);
  const [matchRows, linkRows] = await Promise.all([
    sql<BracketMatch[]>`
      select id,match_type as "matchType",division_no as "divisionNo",round_no as "roundNo",round_name as "roundName",match_no as "matchNo",match_code as "matchCode",
        player_a_id as "playerAId",player_a_name as "playerAName",player_b_id as "playerBId",player_b_name as "playerBName",
        source_a_type as "sourceAType",source_a_ref as "sourceARef",source_b_type as "sourceBType",source_b_ref as "sourceBRef",
        status,winner_player_id as "winnerPlayerId",winner_player_name as "winnerPlayerName",result_type as "resultType",sort_order as "sortOrder"
      from public.competition_bracket_matches where bracket_id=${bracket.id} order by sort_order
    `,
    sql<Array<{ sourceMatchId: string; sourceResult: string; targetMatchId: string; targetSide: string }>>`
      select source_match_id as "sourceMatchId",source_result as "sourceResult",target_match_id as "targetMatchId",target_side as "targetSide"
      from public.competition_match_links where bracket_id=${bracket.id}
    `,
  ]);
  return { bracket, matches: matchRows, links: linkRows };
}
