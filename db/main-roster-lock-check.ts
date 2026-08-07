import { getSqlClient } from "./index";

export async function getMainRosterLockStatus(eventId: string, groupId: string) {
  const sql = getSqlClient();
  const rows = await sql<Array<{ id: string; versionNo: number; status: string }>>`
    select id,version_no as "versionNo",status
    from public.competition_main_roster_locks
    where event_id=${eventId} and group_id=${groupId}
    order by version_no desc limit 1
  `;
  return rows[0] ?? null;
}

export async function assertMainRosterLocked(eventId: string, groupId: string) {
  const lock = await getMainRosterLockStatus(eventId, groupId);
  if (!lock || lock.status !== "locked") throw new Error("请先在“晋级与正赛名单”中确认种子、完成递补并锁定64人正赛名单，再进行正赛第一阶段抽签。");
  return lock;
}
