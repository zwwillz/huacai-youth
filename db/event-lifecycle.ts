import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { getSqlClient } from "./index";
import { requireEventAccess, resolveAdminPrincipal, type AdminPrincipalInput } from "./permissions";

export type EventLifecycleAction = "open_registration" | "close_registration" | "start_competition" | "finish_event" | "force_finish" | "archive" | "restore";

type LifecycleRow = {
  id: string;
  shortTitle: string;
  status: string;
  fullTitle: string;
  city: string;
  venueId: string | null;
  startDate: string;
  endDate: string;
  registrationStartAt: string | null;
  registrationEndAt: string | null;
  registrationUrl: string | null;
  activeGroupCount: number | string;
  overviewStatus: string | null;
};

function newId(prefix: string) { return `${prefix}_${randomUUID().replaceAll("-", "")}`; }
function now() { return new Date().toISOString(); }
function parseChinaLocal(value: string | null) {
  if (!value) return NaN;
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)) return Date.parse(value);
  return Date.parse(`${value}:00+08:00`);
}
function validUrl(value: string | null) {
  if (!value) return false;
  try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
}

async function loadLockedEvent(tx: postgres.TransactionSql, eventId: string) {
  const rows = await tx<LifecycleRow[]>`
    select e.id,e.short_title as "shortTitle",e.status,e.full_title as "fullTitle",e.city,e.venue_id as "venueId",
      e.start_date as "startDate",e.end_date as "endDate",e.registration_start_at as "registrationStartAt",e.registration_end_at as "registrationEndAt",e.registration_url as "registrationUrl",
      (select count(*)::int from public.event_groups g where g.event_id=e.id and g.status='active') as "activeGroupCount",
      (select p.status from public.publications p where p.event_id=e.id and p.module_type='overview' limit 1) as "overviewStatus"
    from public.events e where e.id=${eventId} for update
  `;
  const row = rows[0];
  if (!row) throw new Error("没有找到这场赛事。");
  return row;
}

function assertOpenRegistrationReady(row: LifecycleRow) {
  if (row.status !== "draft") throw new Error("只有处于“筹备中”的赛事才能开放报名。");
  if (!row.fullTitle?.trim() || !row.city?.trim() || !row.startDate || !row.endDate || row.startDate > row.endDate || !row.venueId) {
    throw new Error("当前赛事还不能开放报名，请先完善赛事名称、城市、比赛日期和场馆等基础信息。");
  }
  if (Number(row.activeGroupCount || 0) < 1) throw new Error("当前赛事还不能开放报名，请至少启用一个参赛组别。");
  if (row.overviewStatus !== "published") throw new Error("当前赛事还不能开放报名，请先发布赛事概览。");
  if (!row.registrationStartAt || !row.registrationEndAt) throw new Error("当前赛事还不能开放报名，请先填写报名开始时间和报名截止时间。");
  const start = parseChinaLocal(row.registrationStartAt);
  const end = parseChinaLocal(row.registrationEndAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) throw new Error("当前赛事还不能开放报名，请检查报名开始时间和截止时间，截止时间必须晚于开始时间。");
  if (!validUrl(row.registrationUrl)) throw new Error("当前赛事还不能开放报名，请先填写有效的 http / https 报名入口。");
}

async function competitionReadyToStart(tx: postgres.TransactionSql, eventId: string) {
  const rows = await tx<Array<{ ready: boolean }>>`
    select exists(
      select 1 from public.event_groups g
      where g.event_id=${eventId} and g.status='active' and g.participant_roster_status='locked'
        and (
          exists(select 1 from public.draw_sessions ds where ds.event_id=g.event_id and ds.group_id=g.id and ds.status<>'void')
          or exists(select 1 from public.competition_brackets b where b.event_id=g.event_id and b.group_id=g.id and b.status<>'void')
        )
    ) as ready
  `;
  return Boolean(rows[0]?.ready);
}

async function unfinishedRankingGroups(tx: postgres.TransactionSql, eventId: string) {
  return tx<Array<{ groupId: string; groupName: string }>>`
    select g.id as "groupId",g.name as "groupName"
    from public.event_groups g
    where g.event_id=${eventId} and g.status='active'
      and not (
        exists(
          select 1 from public.competition_final_ranking_batches fr
          where fr.event_id=g.event_id and fr.group_id=g.id and fr.status in ('confirmed','published')
        )
        or (select count(*) from public.event_rankings er where er.event_id=g.event_id and er.group_id=g.id and er.status in ('confirmed','published')) >= 64
      )
    order by case when g.name='少年组' then 1 when g.name='青年组' then 2 else 3 end,g.name
  `;
}

export async function changeEventLifecycle(input: AdminPrincipalInput, eventId: string, action: EventLifecycleAction, reason = "") {
  const principal = await resolveAdminPrincipal(input);
  const allowedRoles = action === "restore" || action === "force_finish" ? ["system_admin"] as const : ["system_admin", "committee"] as const;
  await requireEventAccess(principal, eventId, {
    allowedRoles: [...allowedRoles],
    deniedMessage: action === "force_finish" || action === "restore" ? "只有系统管理员可以执行这个异常处理操作。" : "当前账号没有推进赛事生命周期的权限。",
  });
  const trimmedReason = String(reason || "").trim();
  if (action === "force_finish" && trimmedReason.length < 4) throw new Error("强制结束赛事必须填写明确原因（至少4个字符）。");
  const sql = getSqlClient();
  const changedAt = now();

  return sql.begin(async (tx) => {
    const current = await loadLockedEvent(tx, eventId);
    let nextStatus = current.status;
    let incomplete: Array<{ groupId: string; groupName: string }> = [];

    if (action === "open_registration") {
      assertOpenRegistrationReady(current);
      nextStatus = "registration_open";
    } else if (action === "close_registration") {
      if (current.status !== "registration_open") throw new Error("只有处于“报名中”的赛事才能确认报名截止。");
      nextStatus = "registration_closed";
    } else if (action === "start_competition") {
      if (current.status !== "registration_closed") throw new Error("只有已经“报名截止”的赛事才能正式进入比赛中。");
      if (!(await competitionReadyToStart(tx, eventId))) throw new Error("当前还不能开始比赛：至少需要一个组别的正式名单已锁定，并且已经产生正式抽签或签表数据。");
      nextStatus = "in_progress";
    } else if (action === "finish_event") {
      if (current.status !== "in_progress") throw new Error("只有处于“比赛中”的赛事才能正常结束。");
      incomplete = await unfinishedRankingGroups(tx, eventId);
      if (incomplete.length) throw new Error(`当前还不能结束赛事：${incomplete.map((item) => item.groupName).join("、")}最终排名尚未确认。`);
      nextStatus = "finished";
    } else if (action === "force_finish") {
      if (current.status === "archived") throw new Error("已归档赛事不能直接强制结束，请先撤回归档。");
      if (current.status === "finished") throw new Error("当前赛事已经结束，无需重复操作。");
      incomplete = await unfinishedRankingGroups(tx, eventId);
      nextStatus = "finished";
    } else if (action === "archive") {
      if (current.status !== "finished") throw new Error("只有已结束的赛事才能归档。请先完成赛事结束流程。");
      nextStatus = "archived";
    } else if (action === "restore") {
      if (current.status !== "archived") throw new Error("只有已归档赛事可以撤回归档。");
      nextStatus = "finished";
    }

    if (nextStatus === current.status) return { ok: true, status: current.status, incompleteGroups: incomplete };
    await tx`update public.events set status=${nextStatus},updated_by=${principal.id},updated_at=${changedAt} where id=${eventId}`;
    await tx`
      insert into public.audit_logs (id,actor_user_id,event_id,module_type,target_type,target_id,action,reason,before_json,after_json,created_at)
      values (${newId("log")},${principal.id},${eventId},'events','event',${eventId},${`lifecycle_${action}`},${trimmedReason || null},
        ${JSON.stringify({ status: current.status })},${JSON.stringify({ status: nextStatus, incompleteGroups: incomplete.map((item) => item.groupName) })},${changedAt})
    `;
    return { ok: true, status: nextStatus, incompleteGroups: incomplete };
  });
}
