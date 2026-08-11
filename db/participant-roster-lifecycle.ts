import { getSqlClient } from "./index";
import {
  confirmParticipantRoster as confirmParticipantRosterBase,
  lockParticipantRoster as lockParticipantRosterBase,
} from "./participant-roster";
import { hasGroupFormalCompetitionData } from "./formal-competition";
import { participantRosterLifecycleDecision } from "./formal-competition-policy.mjs";
import { requireEventAccess, type AdminPrincipalInput } from "./permissions";

async function eventLifecycle(input: AdminPrincipalInput, eventId: string) {
  await requireEventAccess(input, eventId, { write: true, allowedRoles: ["system_admin", "committee"], deniedMessage: "当前账号没有参赛人员管理权限。" });
  const sql = getSqlClient();
  const rows = await sql<Array<{ status: string }>>`select status from public.events where id=${eventId} limit 1`;
  if (!rows[0]) throw new Error("没有找到这场赛事。");
  return rows[0].status;
}

async function assertRosterLifecycle(action: "confirm" | "lock", input: AdminPrincipalInput, eventId: string, groupId: string) {
  const status = await eventLifecycle(input, eventId);
  const groupFormalStarted = status === "in_progress" ? await hasGroupFormalCompetitionData(eventId, groupId) : false;
  const decision = participantRosterLifecycleDecision(action, status, groupFormalStarted);
  if (!decision.allowed) throw new Error(decision.message);
}

/** Group-level roster confirmation remains legal after another group has started, until this group has formal competition data. */
export async function confirmParticipantRoster(input: AdminPrincipalInput, eventId: string, groupId: string) {
  await assertRosterLifecycle("confirm", input, eventId, groupId);
  return confirmParticipantRosterBase(input, eventId, groupId);
}

/** Group-level roster locking follows the same independent-progress boundary as confirmation. */
export async function lockParticipantRoster(input: AdminPrincipalInput, eventId: string, groupId: string) {
  await assertRosterLifecycle("lock", input, eventId, groupId);
  return lockParticipantRosterBase(input, eventId, groupId);
}
