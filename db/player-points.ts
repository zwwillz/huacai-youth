import { getSqlClient } from "./index";
import { assertAdminRole, resolveAdminPrincipal, type AdminPrincipalInput } from "./permissions";

export type PlayerPointsScope = "event" | "all";
export type PlayerPointsGroup = "all" | "少年组" | "青年组";

export type PlayerPointsRule = {
  year: number;
  participationPoints: number;
  prizeUnitYuan: number;
  prizePointsPerUnit: number;
};

export type PlayerPointsListItem = {
  id: string;
  rank: number;
  fullName: string;
  displayName: string;
  groupName: string | null;
  eventCount: number;
  prizeCents: number;
  points: number;
};

export type PlayerPointsPageData = {
  items: PlayerPointsListItem[];
  filteredTotal: number;
  page: number;
  pageSize: number;
  year: number;
  scope: PlayerPointsScope;
  eventId: string | null;
  rule: PlayerPointsRule;
};

export type PlayerPointsDetail = {
  id: string;
  fullName: string;
  displayName: string;
  groupName: string | null;
  eventCount: number;
  totalPrizeCents: number;
  totalPoints: number;
  bestResult: string | null;
  events: Array<{
    eventId: string;
    eventTitle: string;
    startDate: string;
    groupName: string;
    placementLabel: string | null;
    prizeCents: number;
    points: number;
  }>;
};

function now() { return new Date().toISOString(); }
function newId(prefix: string) { return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`; }

export async function updatePlayerPointsRule(inputPrincipal: AdminPrincipalInput, input: {
  year: number;
  participationPoints: number;
  prizeUnitYuan: number;
  prizePointsPerUnit: number;
}) {
  const principal = await resolveAdminPrincipal(inputPrincipal);
  assertAdminRole(principal, ["system_admin"], "只有系统管理员可以维护积分规则。");
  const year = Math.max(2000, Math.min(2100, Math.trunc(input.year)));
  const participationPoints = Math.max(0, Math.trunc(input.participationPoints));
  const prizeUnitYuan = Math.max(1, Math.trunc(input.prizeUnitYuan));
  const prizePointsPerUnit = Math.max(0, Math.trunc(input.prizePointsPerUnit));
  const timestamp = now();
  const sql = getSqlClient();

  await sql`
    insert into public.player_points_rules (
      year,participation_points,prize_unit_yuan,prize_points_per_unit,updated_by,created_at,updated_at
    ) values (
      ${year},${participationPoints},${prizeUnitYuan},${prizePointsPerUnit},${principal.id},${timestamp},${timestamp}
    )
    on conflict (year) do update set
      participation_points=excluded.participation_points,
      prize_unit_yuan=excluded.prize_unit_yuan,
      prize_points_per_unit=excluded.prize_points_per_unit,
      updated_by=excluded.updated_by,
      updated_at=excluded.updated_at
  `;
  await sql`
    insert into public.audit_logs (
      id,actor_user_id,event_id,module_type,target_type,target_id,action,after_json,created_at
    ) values (
      ${newId("log")},${principal.id},null,'points','points_rule',${String(year)},'update_points_rule',
      ${JSON.stringify({ year, participationPoints, prizeUnitYuan, prizePointsPerUnit })},${timestamp}
    )
  `;
  return { ok: true };
}
