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

export async function assertMainRosterMutable(eventId: string, groupId: string) {
  const sql = getSqlClient();
  const draws = await sql<Array<{ count: number }>>`
    select count(*)::int as count from public.draw_sessions
    where event_id=${eventId} and group_id=${groupId} and phase_code='main-one' and status in ('draft','confirmed')
  `;
  if ((draws[0]?.count ?? 0) > 0) throw new Error("正赛第一阶段已经生成抽签，种子和64人名单已进入竞赛流程。如需调整，请先作废该阶段抽签。");
  const lock = await getMainRosterLockStatus(eventId, groupId);
  if (lock?.status === "locked") throw new Error("64人正赛名单已经锁定。若要调整种子或递补，请先点击“解锁名单”并填写调整原因。");
}

export async function assertSeedEntryMutable(seedEntryId: string) {
  const sql = getSqlClient();
  const rows = await sql<Array<{ eventId: string; groupId: string; attendanceStatus: string }>>`
    select event_id as "eventId",group_id as "groupId",attendance_status as "attendanceStatus"
    from public.competition_seed_entries where id=${seedEntryId} limit 1
  `;
  if (!rows[0]) throw new Error("没有找到种子席位。");
  await assertMainRosterMutable(rows[0].eventId, rows[0].groupId);
  return rows[0];
}

export async function assertSeedReplacementAllowed(seedEntryId: string) {
  const seed = await assertSeedEntryMutable(seedEntryId);
  if (!["not_attending", "ineligible", "removed"].includes(seed.attendanceStatus)) {
    throw new Error("请先把原种子标记为“不参赛”“资格不符”或“取消资格”，形成明确空缺后再选择局胜率递补球员。");
  }
  return seed;
}
