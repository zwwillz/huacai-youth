import { randomUUID } from "node:crypto";
import { getSqlClient } from "./index";
import { parseRegistrationTime, registrationTimeState } from "./registration-time-policy.mjs";
import { requireEventAccess, type AdminPrincipalInput } from "./permissions";

export type RegistrationTimeState = "not_set" | "not_started" | "open" | "closed";
export type RegistrationPublishData = {
  eventId: string;
  eventTitle: string;
  eventStatus: string;
  registrationStartAt: string;
  registrationEndAt: string;
  registrationNote: string;
  registrationUrl: string;
  timeState: RegistrationTimeState;
  publicationStatus: "draft" | "published";
  versionNo: number;
  publishedAt: string | null;
  hasUnpublishedChanges: boolean;
};
export type PublicRegistrationInfo = {
  state: "open" | "closed";
  startAt: string;
  endAt: string;
  note: string;
  url: string;
};

type AdminRow = {
  eventId: string;
  eventTitle: string;
  eventStatus: string;
  registrationStartAt: string | null;
  registrationEndAt: string | null;
  registrationNote: string | null;
  registrationUrl: string | null;
  publicationStatus: string | null;
  versionNo: number | null;
  publishedAt: string | null;
  hasUnpublishedChanges: boolean | null;
};

function now() { return new Date().toISOString(); }
function newId(prefix: string) { return `${prefix}_${randomUUID().replaceAll("-", "")}`; }
function formatRegistrationDateTime(value: string) {
  const direct = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (direct && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)) return `${direct[1]}年${Number(direct[2])}月${Number(direct[3])}日 ${direct[4]}:${direct[5]}`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const parts = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "";
  return `${read("year")}年${Number(read("month"))}月${Number(read("day"))}日 ${read("hour")}:${read("minute")}`;
}
function validateUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
    return parsed.toString();
  } catch {
    throw new Error("报名入口需要填写有效的 http / https 链接。");
  }
}
function validateTimes(startAt: string, endAt: string) {
  if (startAt && !Number.isFinite(parseRegistrationTime(startAt))) throw new Error("报名开始时间格式不正确。");
  if (endAt && !Number.isFinite(parseRegistrationTime(endAt))) throw new Error("报名截止时间格式不正确。");
  if (startAt && endAt && parseRegistrationTime(startAt) >= parseRegistrationTime(endAt)) throw new Error("报名截止时间必须晚于报名开始时间。");
}

export async function getRegistrationPublishData(input: AdminPrincipalInput, eventId: string): Promise<RegistrationPublishData> {
  await requireEventAccess(input, eventId, {
    allowedRoles: ["system_admin", "committee"],
    deniedMessage: "当前账号没有报名发布管理权限。",
  });
  const sql = getSqlClient();
  const rows = await sql<AdminRow[]>`
    select e.id as "eventId",e.short_title as "eventTitle",e.status as "eventStatus",
      e.registration_start_at as "registrationStartAt",e.registration_end_at as "registrationEndAt",
      d.signup_note as "registrationNote",e.registration_url as "registrationUrl",
      p.status as "publicationStatus",p.version_no as "versionNo",p.published_at as "publishedAt",
      p.has_unpublished_changes as "hasUnpublishedChanges"
    from public.events e
    left join public.event_details d on d.event_id=e.id
    left join public.publications p on p.event_id=e.id and p.module_type='registration'
    where e.id=${eventId}
    limit 1
  `;
  const row = rows[0];
  if (!row) throw new Error("没有找到这场赛事。");
  const startAt = row.registrationStartAt || "";
  const endAt = row.registrationEndAt || "";
  return {
    eventId: row.eventId,
    eventTitle: row.eventTitle,
    eventStatus: row.eventStatus,
    registrationStartAt: startAt,
    registrationEndAt: endAt,
    registrationNote: row.registrationNote || "",
    registrationUrl: row.registrationUrl || "",
    timeState: registrationTimeState(startAt, endAt) as RegistrationTimeState,
    publicationStatus: row.publicationStatus === "published" ? "published" : "draft",
    versionNo: Number(row.versionNo || 0),
    publishedAt: row.publishedAt,
    hasUnpublishedChanges: Boolean(row.hasUnpublishedChanges),
  };
}

export async function saveRegistrationDraft(input: AdminPrincipalInput, eventId: string, draft: {
  registrationStartAt?: string;
  registrationEndAt?: string;
  registrationNote?: string;
  registrationUrl?: string;
}) {
  const actor = await requireEventAccess(input, eventId, {
    write: true,
    allowedRoles: ["system_admin", "committee"],
    deniedMessage: "当前账号没有报名发布管理权限。",
  });
  const startAt = String(draft.registrationStartAt || "").trim();
  const endAt = String(draft.registrationEndAt || "").trim();
  const note = String(draft.registrationNote || "").trim();
  const url = validateUrl(String(draft.registrationUrl || ""));
  validateTimes(startAt, endAt);
  const timestamp = now();
  const sql = getSqlClient();
  await sql.begin(async (tx) => {
    await tx`
      update public.events
      set registration_start_at=${startAt || null},registration_end_at=${endAt || null},registration_url=${url || null},updated_by=${actor.id},updated_at=${timestamp}
      where id=${eventId}
    `;
    await tx`
      insert into public.event_details (event_id,signup_note,created_at,updated_at)
      values (${eventId},${note || null},${timestamp},${timestamp})
      on conflict (event_id) do update set signup_note=excluded.signup_note,updated_at=excluded.updated_at
    `;
    await tx`
      insert into public.publications (id,event_id,module_type,module_title,version_no,status,has_unpublished_changes,draft_updated_at,created_at,updated_at)
      values (${`${eventId}_publication_registration`},${eventId},'registration','报名信息',1,'draft',true,${timestamp},${timestamp},${timestamp})
      on conflict (event_id,module_type) do update set has_unpublished_changes=true,draft_updated_at=excluded.draft_updated_at,updated_at=excluded.updated_at
    `;
    await tx`
      insert into public.audit_logs (id,actor_user_id,event_id,module_type,target_type,target_id,action,after_json,created_at)
      values (${newId("log")},${actor.id},${eventId},'registration','registration_publish',${eventId},'save_registration_draft',${JSON.stringify({ startAt,endAt,note,url })},${timestamp})
    `;
  });
  return getRegistrationPublishData(actor, eventId);
}

export async function setRegistrationPublicationStatus(input: AdminPrincipalInput, eventId: string, status: "draft" | "published") {
  const actor = await requireEventAccess(input, eventId, {
    write: true,
    allowedRoles: ["system_admin", "committee"],
    deniedMessage: "当前账号没有报名发布管理权限。",
  });
  const current = await getRegistrationPublishData(actor, eventId);
  if (status === "published") {
    if (current.eventStatus !== "registration_open") throw new Error("当前赛事尚未进入报名阶段，请先在赛事管理中将赛事状态调整为“报名中”。");
    if (!current.registrationStartAt || !current.registrationEndAt) throw new Error("请先填写完整的报名开始时间和报名截止时间。");
    validateTimes(current.registrationStartAt, current.registrationEndAt);
    if (parseRegistrationTime(current.registrationEndAt) <= Date.now()) throw new Error("当前报名截止时间已经过去，如需继续报名，请先调整截止时间。");
    if (!current.registrationUrl) throw new Error("报名期间必须填写有效报名入口。");
  }
  const timestamp = now();
  const snapshot = {
    startAt: current.registrationStartAt,
    endAt: current.registrationEndAt,
    note: current.registrationNote,
    url: current.registrationUrl,
  };
  const sql = getSqlClient();
  await sql.begin(async (tx) => {
    const rows = await tx<Array<{ versionNo: number }>>`
      select version_no as "versionNo" from public.publications where event_id=${eventId} and module_type='registration' for update
    `;
    const versionNo = Number(rows[0]?.versionNo || 0) + 1;
    await tx`
      insert into public.publications
        (id,event_id,module_type,module_title,version_no,snapshot_json,status,published_by,published_at,has_unpublished_changes,draft_updated_at,created_at,updated_at)
      values (${`${eventId}_publication_registration`},${eventId},'registration','报名信息',${versionNo},${status === "published" ? JSON.stringify(snapshot) : null},${status},${status === "published" ? actor.id : null},${status === "published" ? timestamp : null},false,null,${timestamp},${timestamp})
      on conflict (event_id,module_type) do update set
        version_no=excluded.version_no,
        snapshot_json=case when excluded.status='published' then excluded.snapshot_json else public.publications.snapshot_json end,
        status=excluded.status,published_by=excluded.published_by,published_at=excluded.published_at,
        has_unpublished_changes=false,draft_updated_at=null,updated_at=excluded.updated_at
    `;
    await tx`
      insert into public.audit_logs (id,actor_user_id,event_id,module_type,target_type,target_id,action,after_json,created_at)
      values (${newId("log")},${actor.id},${eventId},'registration','registration_publish',${eventId},${status === "published" ? "publish_registration" : "unpublish_registration"},${JSON.stringify({ status, snapshot: status === "published" ? snapshot : null })},${timestamp})
    `;
  });
  return getRegistrationPublishData(actor, eventId);
}

export async function getPublicRegistrationInfo(eventId: string): Promise<PublicRegistrationInfo | null> {
  const sql = getSqlClient();
  const rows = await sql<Array<{ snapshotJson: string | null }>>`
    select p.snapshot_json as "snapshotJson"
    from public.publications p
    join public.events e on e.id=p.event_id
    where p.event_id=${eventId} and p.module_type='registration' and p.status='published'
      and e.publish_status='published' and e.status='registration_open' and coalesce(e.is_hidden,false)=false
    limit 1
  `;
  const value = rows[0]?.snapshotJson;
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<{ startAt: string; endAt: string; note: string; url: string }>;
    const startAt = String(parsed.startAt || "");
    const endAt = String(parsed.endAt || "");
    const state = registrationTimeState(startAt, endAt) as RegistrationTimeState;
    if (state === "not_set" || state === "not_started") return null;
    const rawNote = String(parsed.note || "");
    const note = state === "closed"
      ? `报名已于 ${formatRegistrationDateTime(endAt)} 截止。${rawNote ? ` ${rawNote}` : ""}`
      : `报名时间：${formatRegistrationDateTime(startAt)} 至 ${formatRegistrationDateTime(endAt)}。${rawNote ? ` ${rawNote}` : ""}`;
    return {
      state,
      startAt,
      endAt,
      note,
      url: state === "open" ? String(parsed.url || "") : "",
    };
  } catch {
    return null;
  }
}
