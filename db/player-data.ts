import { getSqlClient } from "./index";

export type PublicPlayerSummary = {
  id: string;
  name: string;
  nationalityCode: string;
  avatarKey: string | null;
  group: "少年组" | "青年组";
  groupCode: "U16" | "U20";
  stationCount: number;
  bestResult: string;
};

export type PublicPlayerEvent = {
  eventId: string;
  year: number;
  title: string;
  city: string;
  group: "少年组" | "青年组";
  groupCode: "U16" | "U20";
  bestResult: string;
  resultRank: number;
  matchCount: number;
  racks: number;
  wonRacks: number;
  points: number;
  prizeYuan: number;
};

export type PublicPlayerDetail = {
  id: string;
  name: string;
  nationalityCode: string;
  gender: string | null;
  avatarKey: string | null;
  currentGroup: "少年组" | "青年组";
  currentGroupCode: "U16" | "U20";
  events: PublicPlayerEvent[];
};

type SummaryRow = {
  id: string;
  full_name: string;
  nationality_code: string | null;
  avatar_key: string | null;
  group_name: string;
  group_code: string;
  station_count: number | string;
  placement_label: string | null;
  qualifier_round: number | string | null;
};

type PlayerRow = {
  id: string;
  full_name: string;
  nationality_code: string | null;
  gender: string | null;
  avatar_key: string | null;
  group_name: string;
  group_code: string;
};

type EventRow = {
  event_id: string;
  year: number | string;
  title: string;
  city: string;
  group_name: string;
  group_code: string;
  registration_fee_cents: number | string;
  display_order: number | string | null;
  placement_label: string | null;
  prize_amount_cents: number | string | null;
};

type MatchRow = {
  event_id: string;
  player_a_id: string | null;
  player_b_id: string | null;
  score_a: string | null;
  score_b: string | null;
  phase_code: string | null;
  round_name: string | null;
};

function asGroup(value: string): "少年组" | "青年组" {
  return value === "青年组" ? "青年组" : "少年组";
}

function asGroupCode(value: string): "U16" | "U20" {
  return value.toUpperCase() === "U20" ? "U20" : "U16";
}

function qualifierRoundNumber(roundName: string | null | undefined) {
  const value = roundName ?? "";
  if (value.includes("第六轮")) return 6;
  if (value.includes("第五轮")) return 5;
  if (value.includes("第四轮")) return 4;
  if (value.includes("第三轮")) return 3;
  if (value.includes("第二轮")) return 2;
  if (value.includes("第一轮")) return 1;
  return 0;
}

function chineseRound(round: number) {
  return ["", "一", "二", "三", "四", "五", "六"][round] ?? String(round);
}

function qualifierLabel(round: number) {
  return round > 0 ? `资格赛第${chineseRound(round)}轮` : "已报名";
}

function scoreForStats(value: string | null) {
  if (value == null || value === "") return null;
  if (value.trim().toUpperCase() === "X") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * 当前华彩系列赛按用户确认的中台协 E 级赛事规则计算：
 * 1) 名次积分 = 获得奖金金额（元） / 100 × 1.0；
 * 2) 参赛积分 = 参赛费金额（元） / 100，低于 100 元不计。
 * 积分由数据库中的奖金、报名费动态计算，不写死到球员档案。
 */
function participationPoints(registrationFeeCents: number) {
  return registrationFeeCents >= 10_000 ? registrationFeeCents / 10_000 : 0;
}

function prizePoints(prizeAmountCents: number) {
  return prizeAmountCents > 0 ? prizeAmountCents / 10_000 : 0;
}

export async function getPublicPlayerSummaries(): Promise<PublicPlayerSummary[]> {
  const sql = getSqlClient();
  const result = await sql`
    with active_reg as (
      select r.player_id, r.event_id, e.start_date, e.publish_status,
             eg.name as group_name, eg.code as group_code
      from registrations r
      join events e on e.id = r.event_id
      join event_groups eg on eg.id = r.group_id
      where r.status <> 'withdrawn' and e.publish_status = 'published'
    ),
    latest_reg as (
      select distinct on (player_id)
             player_id, group_name, group_code
      from active_reg
      order by player_id, start_date desc, event_id desc
    ),
    station_count as (
      select player_id, count(distinct event_id)::int as station_count
      from active_reg
      group by player_id
    ),
    best_rank as (
      select distinct on (er.player_id)
             er.player_id, er.placement_label
      from event_rankings er
      join events e on e.id = er.event_id
      where er.player_id is not null
        and er.status = 'published'
        and e.publish_status = 'published'
      order by er.player_id, er.display_order asc, er.event_id desc
    ),
    qualifier_rows as (
      select m.player_a_id as player_id, m.round_name
      from matches m
      join events e on e.id = m.event_id
      join event_phases ep on ep.id = m.phase_id
      where m.player_a_id is not null and e.publish_status = 'published' and ep.code like 'qualifier-%'
      union all
      select m.player_b_id as player_id, m.round_name
      from matches m
      join events e on e.id = m.event_id
      join event_phases ep on ep.id = m.phase_id
      where m.player_b_id is not null and e.publish_status = 'published' and ep.code like 'qualifier-%'
    ),
    qualifier_best as (
      select player_id,
             max(case
               when round_name like '%第六轮%' then 6
               when round_name like '%第五轮%' then 5
               when round_name like '%第四轮%' then 4
               when round_name like '%第三轮%' then 3
               when round_name like '%第二轮%' then 2
               when round_name like '%第一轮%' then 1
               else 0
             end)::int as qualifier_round
      from qualifier_rows
      group by player_id
    )
    select p.id, p.full_name, p.nationality_code, p.avatar_key,
           lr.group_name, lr.group_code, sc.station_count,
           br.placement_label, qb.qualifier_round
    from players p
    join latest_reg lr on lr.player_id = p.id
    join station_count sc on sc.player_id = p.id
    left join best_rank br on br.player_id = p.id
    left join qualifier_best qb on qb.player_id = p.id
    where p.merged_into_player_id is null
    order by p.full_name asc, p.id asc
  `;

  const rows = result as unknown as SummaryRow[];
  return rows.map((row) => ({
    id: row.id,
    name: row.full_name,
    nationalityCode: row.nationality_code || "CN",
    avatarKey: row.avatar_key,
    group: asGroup(row.group_name),
    groupCode: asGroupCode(row.group_code),
    stationCount: Number(row.station_count) || 0,
    bestResult: row.placement_label || qualifierLabel(Number(row.qualifier_round) || 0),
  }));
}

export async function getPublicPlayerDetail(playerId: string): Promise<PublicPlayerDetail | null> {
  const sql = getSqlClient();

  const playerResult = await sql`
    with latest_reg as (
      select r.player_id, eg.name as group_name, eg.code as group_code
      from registrations r
      join events e on e.id = r.event_id
      join event_groups eg on eg.id = r.group_id
      where r.player_id = ${playerId}
        and r.status <> 'withdrawn'
        and e.publish_status = 'published'
      order by e.start_date desc, r.event_id desc
      limit 1
    )
    select p.id, p.full_name, p.nationality_code, p.gender, p.avatar_key,
           lr.group_name, lr.group_code
    from players p
    join latest_reg lr on lr.player_id = p.id
    where p.id = ${playerId} and p.merged_into_player_id is null
    limit 1
  `;
  const player = (playerResult as unknown as PlayerRow[])[0];
  if (!player) return null;

  const eventResult = await sql`
    select r.event_id, e.year, e.short_title as title, e.city,
           eg.name as group_name, eg.code as group_code,
           eg.registration_fee_cents,
           er.display_order, er.placement_label, er.prize_amount_cents
    from registrations r
    join events e on e.id = r.event_id
    join event_groups eg on eg.id = r.group_id
    left join event_rankings er
      on er.event_id = r.event_id
     and er.group_id = r.group_id
     and er.player_id = r.player_id
     and er.status = 'published'
    where r.player_id = ${playerId}
      and r.status <> 'withdrawn'
      and e.publish_status = 'published'
    order by e.year desc, e.start_date desc, r.event_id desc
  `;

  const matchResult = await sql`
    select m.event_id, m.player_a_id, m.player_b_id,
           m.score_a, m.score_b, ep.code as phase_code, m.round_name
    from matches m
    join events e on e.id = m.event_id
    left join event_phases ep on ep.id = m.phase_id
    where (m.player_a_id = ${playerId} or m.player_b_id = ${playerId})
      and e.publish_status = 'published'
    order by m.match_date asc, m.match_time asc, m.order_no asc, m.id asc
  `;

  const eventRows = eventResult as unknown as EventRow[];
  const matchRows = matchResult as unknown as MatchRow[];

  const events: PublicPlayerEvent[] = eventRows.map((row) => {
    const matches = matchRows.filter((match) => match.event_id === row.event_id);
    let racks = 0;
    let wonRacks = 0;
    let qualifierRound = 0;

    for (const match of matches) {
      if ((match.phase_code ?? "").startsWith("qualifier")) {
        qualifierRound = Math.max(qualifierRound, qualifierRoundNumber(match.round_name));
      }
      const scoreA = scoreForStats(match.score_a);
      const scoreB = scoreForStats(match.score_b);
      if (scoreA == null || scoreB == null) continue;
      racks += scoreA + scoreB;
      wonRacks += match.player_a_id === playerId ? scoreA : scoreB;
    }

    const prizeAmountCents = Number(row.prize_amount_cents) || 0;
    const feeCents = Number(row.registration_fee_cents) || 0;
    const placementOrder = row.display_order == null ? null : Number(row.display_order);
    const bestResult = row.placement_label || qualifierLabel(qualifierRound);

    return {
      eventId: row.event_id,
      year: Number(row.year),
      title: row.title,
      city: row.city,
      group: asGroup(row.group_name),
      groupCode: asGroupCode(row.group_code),
      bestResult,
      resultRank: placementOrder ?? (qualifierRound > 0 ? 200 - qualifierRound : 999),
      matchCount: matches.length,
      racks,
      wonRacks,
      points: participationPoints(feeCents) + prizePoints(prizeAmountCents),
      prizeYuan: prizeAmountCents / 100,
    };
  });

  return {
    id: player.id,
    name: player.full_name,
    nationalityCode: player.nationality_code || "CN",
    gender: player.gender,
    avatarKey: player.avatar_key,
    currentGroup: asGroup(player.group_name),
    currentGroupCode: asGroupCode(player.group_code),
    events,
  };
}
