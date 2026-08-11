import { getSqlClient } from "./index";
import {
  confirmParticipantRoster as confirmParticipantRosterBase,
  lockParticipantRoster as lockParticipantRosterBase,
} from "./participant-roster";
import { requireEventAccess, type AdminPrincipalInput } from "./permissions";

async function eventLifecycle(input: AdminPrincipalInput, eventId: string) {
  await requireEventAccess(input, eventId, { write: true, allowedRoles: ["system_admin", "committee"], deniedMessage: "当前账号没有参赛人员管理权限。" });
  const sql = getSqlClient();
  const rows = await sql<Array<{ status: string }>>`select status from public.events where id=${eventId} limit 1`;
  if (!rows[0]) throw new Error("没有找到这场赛事。");
  return rows[0].status;
}

/** Formal roster confirmation is only legal after registration has officially closed. */
export async function confirmParticipantRoster(input: AdminPrincipalInput, eventId: string, groupId: string) {
  const status = await eventLifecycle(input, eventId);
  if (status !== "registration_closed") {
    if (status === "registration_open") throw new Error("当前赛事仍在报名中，不能确认正式参赛名单。请先执行“结束报名”。");
    throw new Error("只有赛事进入“报名截止”阶段后，才能确认正式参赛名单。");
  }
  return confirmParticipantRosterBase(input, eventId, groupId);
}

/** Locking stays legal after the event has formally moved into competition, but never before registration closes. */
export async function lockParticipantRoster(input: AdminPrincipalInput, eventId: string, groupId: string) {
  const status = await eventLifecycle(input, eventId);
  if (status !== "registration_closed" && status !== "in_progress") {
    if (status === "registration_open") throw new Error("当前赛事仍在报名中，不能锁定正式参赛名单。请先执行“结束报名”。");
    throw new Error("只有赛事处于“报名截止”或合法“比赛中”阶段，才能锁定正式参赛名单。");
  }
  return lockParticipantRosterBase(input, eventId, groupId);
}
