import { randomUUID } from "node:crypto";
import { getSqlClient } from "./index";
import { requireEventAccess } from "./permissions";

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
  mainOneEliminationCount: number;
  batch: null | { id: string; status: string; confirmedAt: string | null; publishedAt: string | null };
  rows: FinalRankingRow[];
};

export type FinalRankingWorkspaceData = {
  viewerRole: string;
  event: { id: string; shortTitle: string };
  groups: FinalRankingWorkspaceGroup[];
};

type Viewer = { id: string; role: string };
type RankingMatch = {
  id: string;
  matchType: string;
  roundNo: number;
  roundName: string;
  sortOrder: number;
  playerAId: string | null;
  playerAName: string | null;
  playerBId: string | null;
  playerBName: string | null;
  winnerPlayerId: string | null;
  winnerPlayerName: string | null;
  resultStatus: string;
};

function now() { return new Date().toISOString(); }
function newId(prefix: string) { return `${prefix}_${randomUUID().replaceAll("-", "")}`; }

async function requireViewer(username: string, write = false): Promise<Viewer> {
  const sql = getSqlClient();
  const rows = await sql<Viewer[]>`select id,role from public.users where username=${username} and status='active' limit 1`;
  const viewer = rows[0];
  if (!viewer || !["system_admin","committee","referee"].includes(viewer.role)) throw new Error("当前账号没有查看最终排名的权限。");
  if (write && !["system_admin","committee"].includes(viewer.role)) throw new Error("最终排名确认和发布需要系统管理员或组委会权限。");
  return viewer;
}

function loserOf(match: RankingMatch) {
  if (!match.winnerPlayerId) return null;
  if (match.playerAId === match.winnerPlayerId && match.playerBId && match.playerBName) return { playerId: match.playerBId, playerName: match.playerBName };
  if (match.playerBId === match.winnerPlayerId && match.playerAId && match.playerAName) return { playerId: match.playerAId, playerName: match.playerAName };
  return null;
}

function parsePrizeAmount(value: string) {
  const digits = value.replace(/[^0-9]/g, "");
  return digits ? Number(digits) * 100 : 0;
}

async function latestConfirmedSession(eventId: string, groupId: string, phaseCode: "main-one" | "main-two") {
  const sql = getSqlClient();
  const rows = await sql<Array<{ id: string }>>`
    select id from public.draw_sessions
    where event_id=${eventId} and group_id=${groupId} and phase_code=${phaseCode} and status='confirmed'
    order by version_no desc limit 1
  `;
  return rows[0]?.id ?? null;
}

async function loadMainTwoMatches(sessionId: string) {
  const sql = getSqlClient();
  return sql<RankingMatch[]>`
    select id,match_type as "matchType",round_no as "roundNo",round_name as "roundName",sort_order as "sortOrder",
      player_a_id as "playerAId",player_a_name as "playerAName",player_b_id as "playerBId",player_b_name as "playerBName",
      winner_player_id as "winnerPlayerId",winner_player_name as "winnerPlayerName",result_status as "resultStatus"
    from public.competition_bracket_matches
    where draw_session_id=${sessionId} and match_type in ('main_single','third_place')
    order by sort_order
  `;
}

async function loadMainOneEliminations(sessionId: string) {
  const sql = getSqlClient();
  return sql<RankingMatch[]>`
    select id,match_type as "matchType",round_no as "roundNo",round_name as "roundName",sort_order as "sortOrder",
      player_a_id as "playerAId",player_a_name as "playerAName",player_b_id as "playerBId",player_b_name as "playerBName",
      winner_player_id as "winnerPlayerId",winner_player_name as "winnerPlayerName",result_status as "resultStatus"
    from public.competition_bracket_matches
    where draw_session_id=${sessionId} and round_name in ('败部第一轮','败部晋级轮')
    order by sort_order
  `;
}

export async function prepareFinalRankingDraft(eventId: string, groupId: string) {
  const sql = getSqlClient();
  const [mainOneSessionId, mainTwoSessionId] = await Promise.all([
    latestConfirmedSession(eventId, groupId, "main-one"),
    latestConfirmedSession(eventId, groupId, "main-two"),
  ]);
  if (!mainOneSessionId || !mainTwoSessionId) return { ready: false, count: 0 };

  const [mainTwoMatches, mainOneEliminationMatches] = await Promise.all([
    loadMainTwoMatches(mainTwoSessionId),
    loadMainOneEliminations(mainOneSessionId),
  ]);
  const mainTwoCompleted = mainTwoMatches.filter((match) => match.resultStatus === "confirmed").length;
  const mainOneCompleted = mainOneEliminationMatches.filter((match) => match.resultStatus === "confirmed").length;
  if (mainTwoMatches.length !== 32 || mainTwoCompleted !== 32 || mainOneEliminationMatches.length !== 32 || mainOneCompleted !== 32) {
    return { ready: false, count: mainTwoCompleted, mainOneEliminationCount: mainOneCompleted };
  }

  const existing = await sql<Array<{ id: string; status: string }>>`
    select id,status from public.competition_final_ranking_batches where source_draw_session_id=${mainTwoSessionId} limit 1
  `;
  if (existing[0]) return { ready: true, count: 64, batchId: existing[0].id, status: existing[0].status };

  const groupRows = await sql<Array<{ groupName: string }>>`select name as "groupName" from public.event_groups where id=${groupId} limit 1`;
  const groupName = groupRows[0]?.groupName;
  if (!groupName) throw new Error("没有找到组别。");
  const detailRows = await sql<Array<{ prizes: unknown }>>`select prizes from public.event_details where event_id=${eventId} limit 1`;
  const prizeObject = detailRows[0]?.prizes && typeof detailRows[0].prizes === "object" ? detailRows[0].prizes as Record<string, unknown> : {};
  const prizeList = Array.isArray(prizeObject[groupName]) ? prizeObject[groupName] as Array<[string,string]> : [];
  const prizeMap = new Map(prizeList.map(([label, amount]) => [String(label), String(amount)]));

  const final = mainTwoMatches.find((match) => match.matchType === "main_single" && match.roundNo === 5 && match.roundName === "决赛");
  const third = mainTwoMatches.find((match) => match.matchType === "third_place");
  if (!final?.winnerPlayerId || !final.winnerPlayerName || !third?.winnerPlayerId || !third.winnerPlayerName) throw new Error("决赛或三、四名决赛结果不完整。");
  const runner = loserOf(final);
  const fourth = loserOf(third);
  if (!runner || !fourth) throw new Error("无法识别亚军或殿军。");

  const losersAtRound = (roundNo: number) => mainTwoMatches
    .filter((match) => match.matchType === "main_single" && match.roundNo === roundNo)
    .map((match) => ({ match, loser: loserOf(match) }))
    .filter((item) => item.loser !== null)
    .map((item) => ({ match: item.match, loser: item.loser! }))
    .sort((a, b) => a.match.sortOrder - b.match.sortOrder);
  const quarterfinalLosers = losersAtRound(3);
  const round16Losers = losersAtRound(2);
  const round32Losers = losersAtRound(1);
  const mainOneLosers = mainOneEliminationMatches
    .map((match) => ({ match, loser: loserOf(match) }))
    .filter((item) => item.loser !== null)
    .map((item) => ({ match: item.match, loser: item.loser! }))
    .sort((a, b) => a.match.sortOrder - b.match.sortOrder);
  if (quarterfinalLosers.length !== 4 || round16Losers.length !== 8 || round32Losers.length !== 16 || mainOneLosers.length !== 32) {
    throw new Error("淘汰轮次结果不完整，无法生成64强最终排名。");
  }

  const make = (displayOrder: number, placementLabel: string, player: { playerId: string; playerName: string }, isExactPlace: boolean): FinalRankingRow => ({
    displayOrder,
    placementLabel,
    playerId: player.playerId,
    playerName: player.playerName,
    prizeDisplay: prizeMap.get(placementLabel) || "",
    isExactPlace,
  });
  const ranking: FinalRankingRow[] = [
    make(1, "冠军", { playerId: final.winnerPlayerId, playerName: final.winnerPlayerName }, true),
    make(2, "亚军", runner, true),
    make(3, "季军", { playerId: third.winnerPlayerId, playerName: third.winnerPlayerName }, true),
    make(4, "殿军", fourth, true),
    ...quarterfinalLosers.map((item, index) => make(5 + index, "8强", item.loser, false)),
    ...round16Losers.map((item, index) => make(9 + index, "16强", item.loser, false)),
    ...round32Losers.map((item, index) => make(17 + index, "32强", item.loser, false)),
    ...mainOneLosers.map((item, index) => make(33 + index, "64强", item.loser, false)),
  ];
  if (ranking.length !== 64 || new Set(ranking.map((item) => item.playerId)).size !== 64) throw new Error("最终排名存在重复或缺失球员，请检查正赛赛果流转。");

  const timestamp = now();
  const batchId = newId("rankbatch");
  const dbRows = ranking.map((item) => ({
    id: newId("rank"), event_id: eventId, group_id: groupId, player_id: item.playerId, player_name: item.playerName,
    display_order: item.displayOrder, placement_label: item.placementLabel, prize_amount_cents: parsePrizeAmount(item.prizeDisplay),
    prize_display: item.prizeDisplay, is_exact_place: item.isExactPlace,
    ranking_basis: item.isExactPlace ? "competition_exact_place" : item.displayOrder <= 32 ? "competition_elimination_tier" : "main_one_eliminated_display_order",
    source: "competition_engine", note: item.isExactPlace ? null : item.displayOrder <= 32 ? "同档位按正赛第二阶段签表顺序展示" : "正赛第一阶段未晋级，同档位按签表比赛顺序展示",
    status: "draft", created_at: timestamp, updated_at: timestamp,
  }));

  await sql.begin(async (tx) => {
    const published = await tx<Array<{ count: number }>>`select count(*)::int as count from public.event_rankings where event_id=${eventId} and group_id=${groupId} and status='published'`;
    if ((published[0]?.count ?? 0) > 0) throw new Error("该组别已经发布正式排名，如需更正请走排名更正流程。");
    await tx`delete from public.event_rankings where event_id=${eventId} and group_id=${groupId} and status<>'published'`;
    await tx`insert into public.event_rankings
      (id,event_id,group_id,player_id,player_name,display_order,placement_label,prize_amount_cents,prize_display,is_exact_place,ranking_basis,source,note,status,created_at,updated_at)
      select x.id,x.event_id,x.group_id,x.player_id,x.player_name,x.display_order,x.placement_label,x.prize_amount_cents,x.prize_display,x.is_exact_place,x.ranking_basis,x.source,x.note,x.status,x.created_at,x.updated_at
      from jsonb_to_recordset(${JSON.stringify(dbRows)}::jsonb)
      as x(id text,event_id text,group_id text,player_id text,player_name text,display_order int,placement_label text,prize_amount_cents int,prize_display text,is_exact_place boolean,ranking_basis text,source text,note text,status text,created_at text,updated_at text)`;
    await tx`insert into public.competition_final_ranking_batches
      (id,event_id,group_id,source_draw_session_id,status,ranking_json,created_at,updated_at)
      values (${batchId},${eventId},${groupId},${mainTwoSessionId},'draft',${JSON.stringify(ranking)}::jsonb,${timestamp},${timestamp})`;
  });
  return { ready: true, count: 64, batchId, status: "draft" };
}

export async function ensureFinalRankingDrafts(eventId: string) {
  const sql = getSqlClient();
  const groups = await sql<Array<{ id: string }>>`select id from public.event_groups where event_id=${eventId} and status='active'`;
  for (const group of groups) {
    try { await prepareFinalRankingDraft(eventId, group.id); } catch { /* 尚未满足条件时页面仍可展示等待状态 */ }
  }
}

export async function getFinalRankingWorkspaceData(username: string, eventId: string): Promise<FinalRankingWorkspaceData> {
  const viewer = await requireViewer(username);
  await requireEventAccess(username, eventId);
  await ensureFinalRankingDrafts(eventId);
  const sql = getSqlClient();
  const events = await sql<Array<{ id: string; shortTitle: string }>>`select id,short_title as "shortTitle" from public.events where id=${eventId} limit 1`;
  if (!events[0]) throw new Error("没有找到这场赛事。");
  const groups = await sql<Array<{ groupId: string; groupName: string }>>`select id as "groupId",name as "groupName" from public.event_groups where event_id=${eventId} and status='active' order by code`;
  const output: FinalRankingWorkspaceGroup[] = [];
  for (const group of groups) {
    const [mainOneSessionId, mainTwoSessionId] = await Promise.all([
      latestConfirmedSession(eventId, group.groupId, "main-one"),
      latestConfirmedSession(eventId, group.groupId, "main-two"),
    ]);
    const mainTwoCounts = mainTwoSessionId ? await sql<Array<{ total: number; completed: number }>>`
      select count(*)::int as total,count(*) filter(where result_status='confirmed')::int as completed
      from public.competition_bracket_matches where draw_session_id=${mainTwoSessionId} and match_type in ('main_single','third_place')
    ` : [];
    const mainOneCounts = mainOneSessionId ? await sql<Array<{ total: number; completed: number }>>`
      select count(*)::int as total,count(*) filter(where result_status='confirmed')::int as completed
      from public.competition_bracket_matches where draw_session_id=${mainOneSessionId} and round_name in ('败部第一轮','败部晋级轮')
    ` : [];
    const batches = await sql<Array<{ id: string; status: string; confirmedAt: string | null; publishedAt: string | null }>>`
      select id,status,confirmed_at as "confirmedAt",published_at as "publishedAt"
      from public.competition_final_ranking_batches where event_id=${eventId} and group_id=${group.groupId} order by created_at desc limit 1
    `;
    const rows = await sql<FinalRankingRow[]>`
      select display_order as "displayOrder",placement_label as "placementLabel",player_id as "playerId",player_name as "playerName",prize_display as "prizeDisplay",is_exact_place as "isExactPlace"
      from public.event_rankings where event_id=${eventId} and group_id=${group.groupId} and status in ('draft','confirmed','published') order by display_order
    `;
    const mainTwoReady = (mainTwoCounts[0]?.total ?? 0) === 32 && (mainTwoCounts[0]?.completed ?? 0) === 32;
    const mainOneReady = (mainOneCounts[0]?.total ?? 0) === 32 && (mainOneCounts[0]?.completed ?? 0) === 32;
    output.push({
      groupId: group.groupId,
      groupName: group.groupName,
      sourceReady: mainTwoReady && mainOneReady,
      completedMatchCount: mainTwoCounts[0]?.completed ?? 0,
      requiredMatchCount: 32,
      mainOneEliminationCount: mainOneCounts[0]?.completed ?? 0,
      batch: batches[0] ?? null,
      rows,
    });
  }
  return { viewerRole: viewer.role, event: events[0], groups: output };
}

export async function confirmFinalRanking(username: string, batchId: string) {
  const viewer = await requireViewer(username, true);
  const sql = getSqlClient();
  const rows = await sql<Array<{ eventId: string; groupId: string; status: string }>>`
    select event_id as "eventId",group_id as "groupId",status from public.competition_final_ranking_batches where id=${batchId} limit 1
  `;
  const batch = rows[0];
  if (!batch) throw new Error("没有找到最终排名批次。");
  await requireEventAccess(username, batch.eventId, { write: true });
  if (batch.status === "published" || batch.status === "confirmed") return { ok: true };
  const timestamp = now();
  await sql.begin(async (tx) => {
    await tx`update public.event_rankings set status='confirmed',updated_at=${timestamp} where event_id=${batch.eventId} and group_id=${batch.groupId} and status='draft'`;
    await tx`update public.competition_final_ranking_batches set status='confirmed',confirmed_by=${viewer.id},confirmed_at=${timestamp},updated_at=${timestamp} where id=${batchId}`;
    await tx`insert into public.audit_logs (id,actor_user_id,event_id,module_type,target_type,target_id,action,created_at)
      values (${newId("log")},${viewer.id},${batch.eventId},'competition','final_ranking',${batchId},'confirm_final_ranking',${timestamp})`;
  });
  return { ok: true };
}

export async function publishFinalRanking(username: string, batchId: string) {
  const viewer = await requireViewer(username, true);
  const sql = getSqlClient();
  const rows = await sql<Array<{ eventId: string; groupId: string; status: string }>>`
    select event_id as "eventId",group_id as "groupId",status from public.competition_final_ranking_batches where id=${batchId} limit 1
  `;
  const batch = rows[0];
  if (!batch) throw new Error("没有找到最终排名批次。");
  await requireEventAccess(username, batch.eventId, { write: true });
  if (batch.status !== "confirmed" && batch.status !== "published") throw new Error("请先确认最终排名，再进行发布。");
  if (batch.status === "published") return { ok: true };
  const timestamp = now();
  await sql.begin(async (tx) => {
    await tx`update public.event_rankings set status='published',updated_at=${timestamp} where event_id=${batch.eventId} and group_id=${batch.groupId} and status='confirmed'`;
    await tx`update public.competition_final_ranking_batches set status='published',published_by=${viewer.id},published_at=${timestamp},updated_at=${timestamp} where id=${batchId}`;
    await tx`update public.publications set status='published',published_by=${viewer.id},published_at=coalesce(published_at,${timestamp}),updated_at=${timestamp} where event_id=${batch.eventId} and module_type='rankings'`;
    await tx`insert into public.audit_logs (id,actor_user_id,event_id,module_type,target_type,target_id,action,created_at)
      values (${newId("log")},${viewer.id},${batch.eventId},'competition','final_ranking',${batchId},'publish_final_ranking',${timestamp})`;
  });
  const groups = await sql<Array<{ id: string }>>`select id from public.event_groups where event_id=${batch.eventId} and status='active'`;
  const published = await sql<Array<{ groupId: string; count: number }>>`
    select group_id as "groupId",count(*)::int as count from public.event_rankings where event_id=${batch.eventId} and status='published' group by group_id
  `;
  const map = new Map(published.map((item) => [item.groupId, item.count]));
  if (groups.length > 0 && groups.every((group) => (map.get(group.id) ?? 0) >= 64)) {
    await sql`update public.events set status='finished',updated_at=${timestamp},updated_by=${viewer.id} where id=${batch.eventId}`;
  }
  return { ok: true };
}
