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
  totalPoints: number;
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
  scoredMatchCount: number;
  racks: number;
  wonRacks: number;
  points: number;
  prizeYuan: number;
};

export type PublicPlayerDetail = {
  id: string;
  name: string;
  nationalityCode: string;
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
  total_points: number | string;
};

type PlayerRow = {
  id: string;
  full_name: string;
  nationality_code: string | null;
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
};

const CURRENT_QUALIFIER_FALLBACK = "资格赛256-512";

function asGroup(value: string): "少年组" | "青年组" {
  return value === "青年组" ? "青年组" : "少年组";
}

function asGroupCode(value: string): "U16" | "U20" {
  return value.toUpperCase() === "U20" ? "U20" : "U16";
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
      select r.player_id, r.event_id, r.group_id, e.start_date,
             eg.name as group_name, eg.code as group_code,
             eg.registration_fee_cents
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
    points_total as (
      select ar.player_id,
             sum(
               case when ar.registration_fee_cents >= 10000 then ar.registration_fee_cents::numeric / 10000 else 0 end
               + coalesce(er.prize_amount_cents, 0)::numeric / 10000
             ) as total_points
      from active_reg ar
      left join event_rankings er
        on er.event_id = ar.event_id
       and er.group_id = ar.group_id
       and er.player_id = ar.player_id
       and er.status = 'published'
      group by ar.player_id
    )
    select p.id, p.full_name, p.nationality_code, p.avatar_key,
           lr.group_name, lr.group_code, sc.station_count,
           br.placement_label, coalesce(pt.total_points, 0) as total_points
    from players p
    join latest_reg lr on lr.player_id = p.id
    join station_count sc on sc.player_id = p.id
    left join best_rank br on br.player_id = p.id
    left join points_total pt on pt.player_id = p.id
    where p.merged_into_player_id is null
    order by coalesce(pt.total_points, 0) desc,
             case when br.placement_label is null then 1 else 0 end asc,
             p.full_name asc,
             p.id asc
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
    bestResult: row.placement_label || CURRENT_QUALIFIER_FALLBACK,
    totalPoints: Number(row.total_points) || 0,
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
    select p.id, p.full_name, p.nationality_code, p.avatar_key,
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
    select m.event_id, m.player_a_id, m.player_b_id, m.score_a, m.score_b
    from matches m
    join events e on e.id = m.event_id
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
    let scoredMatchCount = 0;

    for (const match of matches) {
      const scoreA = scoreForStats(match.score_a);
      const scoreB = scoreForStats(match.score_b);
      if (scoreA == null || scoreB == null) continue;
      scoredMatchCount += 1;
      racks += scoreA + scoreB;
      wonRacks += match.player_a_id === playerId ? scoreA : scoreB;
    }

    const prizeAmountCents = Number(row.prize_amount_cents) || 0;
    const feeCents = Number(row.registration_fee_cents) || 0;
    const placementOrder = row.display_order == null ? null : Number(row.display_order);

    return {
      eventId: row.event_id,
      year: Number(row.year),
      title: row.title,
      city: row.city,
      group: asGroup(row.group_name),
      groupCode: asGroupCode(row.group_code),
      bestResult: row.placement_label || CURRENT_QUALIFIER_FALLBACK,
      resultRank: placementOrder ?? 999,
      matchCount: matches.length,
      scoredMatchCount,
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
    avatarKey: player.avatar_key,
    currentGroup: asGroup(player.group_name),
    currentGroupCode: asGroupCode(player.group_code),
    events,
  };
}
