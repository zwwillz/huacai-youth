import { getSqlClient } from "./index";

export type PlayerDeleteEligibility = {
  canDelete: boolean;
  reason: string | null;
};

type AccountRow = { id: string; role: string };
type PlayerRow = { id: string; player_code: string | null; full_name: string };
type EligibilityRow = {
  successful_registration: boolean;
  event_data: boolean;
  merged_children: boolean;
};

async function getSystemAdmin(username: string) {
  const sql = getSqlClient();
  const rows = await sql<AccountRow[]>`
    select id, role
    from public.users
    where username = ${username} and status = 'active'
    limit 1
  `;
  const account = rows[0];
  if (!account) throw new Error("当前账号尚未获得后台权限。");
  if (account.role !== "system_admin") throw new Error("只有系统管理员可以删除球员档案。");
  return account;
}

function mapEligibility(row: EligibilityRow | undefined): PlayerDeleteEligibility {
  if (row?.successful_registration) {
    return { canDelete: false, reason: "该球员已有报名成功记录，不能删除球员档案。" };
  }
  if (row?.event_data) {
    return { canDelete: false, reason: "该球员已经产生比赛、排名、抽签或其它赛事数据，不能删除球员档案。" };
  }
  if (row?.merged_children) {
    return { canDelete: false, reason: "该球员档案已关联其它合并档案，不能直接删除。" };
  }
  return { canDelete: true, reason: null };
}

export async function getPlayerDeleteEligibility(username: string, playerId: string): Promise<PlayerDeleteEligibility> {
  await getSystemAdmin(username);
  const sql = getSqlClient();
  const player = await sql<Array<{ id: string }>>`
    select id from public.players
    where id = ${playerId} and merged_into_player_id is null
    limit 1
  `;
  if (!player[0]) return { canDelete: false, reason: "球员档案不存在或已经被合并。" };

  const rows = await sql<EligibilityRow[]>`
    select
      exists (
        select 1 from public.registrations r
        where r.player_id = ${playerId}
          and r.status not in ('pending', 'rejected', 'withdrawn', 'cancelled', 'draft')
      ) as successful_registration,
      (
        exists (select 1 from public.event_rankings x where x.player_id = ${playerId})
        or exists (select 1 from public.matches x where x.player_a_id = ${playerId} or x.player_b_id = ${playerId})
        or exists (select 1 from public.competition_bracket_matches x where x.player_a_id = ${playerId} or x.player_b_id = ${playerId} or x.winner_player_id = ${playerId})
        or exists (select 1 from public.competition_phase_entries x where x.player_id = ${playerId})
        or exists (select 1 from public.competition_qualification_entries x where x.player_id = ${playerId})
        or exists (select 1 from public.competition_seed_entries x where x.player_id = ${playerId})
        or exists (select 1 from public.draw_participants x where x.player_id = ${playerId})
        or exists (select 1 from public.draw_prelim_matches x where x.player_a_id = ${playerId} or x.player_b_id = ${playerId} or x.winner_player_id = ${playerId})
        or exists (select 1 from public.draw_slots x where x.player_id = ${playerId})
      ) as event_data,
      exists (
        select 1 from public.players p
        where p.merged_into_player_id = ${playerId}
      ) as merged_children
  `;
  return mapEligibility(rows[0]);
}

export async function deleteAdminPlayer(username: string, playerId: string) {
  const account = await getSystemAdmin(username);
  const sql = getSqlClient();

  return sql.begin(async (tx) => {
    const players = await tx<PlayerRow[]>`
      select id, player_code, full_name
      from public.players
      where id = ${playerId} and merged_into_player_id is null
      limit 1
    `;
    const player = players[0];
    if (!player) throw new Error("球员档案不存在或已经被合并。");

    const eligibilityRows = await tx<EligibilityRow[]>`
      select
        exists (
          select 1 from public.registrations r
          where r.player_id = ${playerId}
            and r.status not in ('pending', 'rejected', 'withdrawn', 'cancelled', 'draft')
        ) as successful_registration,
        (
          exists (select 1 from public.event_rankings x where x.player_id = ${playerId})
          or exists (select 1 from public.matches x where x.player_a_id = ${playerId} or x.player_b_id = ${playerId})
          or exists (select 1 from public.competition_bracket_matches x where x.player_a_id = ${playerId} or x.player_b_id = ${playerId} or x.winner_player_id = ${playerId})
          or exists (select 1 from public.competition_phase_entries x where x.player_id = ${playerId})
          or exists (select 1 from public.competition_qualification_entries x where x.player_id = ${playerId})
          or exists (select 1 from public.competition_seed_entries x where x.player_id = ${playerId})
          or exists (select 1 from public.draw_participants x where x.player_id = ${playerId})
          or exists (select 1 from public.draw_prelim_matches x where x.player_a_id = ${playerId} or x.player_b_id = ${playerId} or x.winner_player_id = ${playerId})
          or exists (select 1 from public.draw_slots x where x.player_id = ${playerId})
        ) as event_data,
        exists (
          select 1 from public.players p
          where p.merged_into_player_id = ${playerId}
        ) as merged_children
    `;
    const eligibility = mapEligibility(eligibilityRows[0]);
    if (!eligibility.canDelete) throw new Error(eligibility.reason || "该球员当前不能删除。");

    await tx`
      delete from public.registrations
      where player_id = ${playerId}
        and status in ('pending', 'rejected', 'withdrawn', 'cancelled', 'draft')
    `;
    await tx`delete from public.guardians where player_id = ${playerId}`;
    await tx`delete from public.players where id = ${playerId}`;

    const createdAt = new Date().toISOString();
    const logId = `log_${crypto.randomUUID().replaceAll("-", "")}`;
    await tx`
      insert into public.audit_logs (
        id, actor_user_id, event_id, module_type, target_type, target_id, action, before_json, created_at
      ) values (
        ${logId}, ${account.id}, null, 'players', 'player', ${playerId}, 'delete_player',
        ${JSON.stringify({ playerCode: player.player_code, fullName: player.full_name })}, ${createdAt}
      )
    `;

    return { ok: true };
  });
}
