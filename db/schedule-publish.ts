import { randomUUID } from "node:crypto";
import { getSqlClient } from "./index";
import { requireEventAccess, resolveAdminPrincipal, type AdminPrincipalInput } from "./permissions";

export const MASTER_SCHEDULE_MODULE = "master_schedule";
export const MASTER_SCHEDULE_CODES = ["qualifier-one", "qualifier-two", "main-one", "main-two"] as const;
export type MasterScheduleCode = (typeof MASTER_SCHEDULE_CODES)[number];

export type MasterScheduleStage = {
  code: MasterScheduleCode;
  phaseNumber: string;
  title: string;
  dateLabel: string;
  advancementText: string;
  tags: string[];
  u16RaceLabel: string;
  u20RaceLabel: string;
  qualificationNote: string;
};

export type MasterScheduleSnapshot = {
  version: 1;
  stages: MasterScheduleStage[];
};

export type SchedulePublishData = {
  viewerRole: string;
  event: {
    id: string;
    fullTitle: string;
    shortTitle: string;
    city: string;
    stationNo: number;
    status: string;
  };
  publication: {
    id: string | null;
    status: "draft" | "published";
    versionNo: number;
    publishedAt: string | null;
  };
  detailedSchedule: {
    status: "draft" | "published";
    hasSnapshot: boolean;
    hasContent: boolean;
  };
  stages: MasterScheduleStage[];
};

export type SchedulePublishInput = {
  eventId: string;
  stages: MasterScheduleStage[];
};

type PublicationRow = {
  id: string;
  moduleType: string;
  status: string;
  versionNo: number;
  publishedAt: string | null;
  snapshotJson: string | null;
  hasSnapshot: boolean;
};

type EventRow = {
  id: string;
  fullTitle: string;
  shortTitle: string;
  city: string;
  stationNo: number;
  status: string;
};

type PhaseRow = {
  id: string;
  code: string;
  phaseNumber: string | null;
  title: string;
  dateLabel: string | null;
  status: string;
  sortOrder: number;
};

const defaultByCode: Record<MasterScheduleCode, Omit<MasterScheduleStage, "code">> = {
  "qualifier-one": {
    phaseNumber: "01",
    title: "资格赛第一场",
    dateLabel: "",
    advancementText: "N人 → 晋级24人",
    tags: ["一次抽签到底", "16区", "单败"],
    u16RaceLabel: "9局5胜",
    u20RaceLabel: "13局7胜",
    qualificationNote: "16名分区冠军直接晋级；其余决胜负者按局胜率取前8，共晋级24人。",
  },
  "qualifier-two": {
    phaseNumber: "02",
    title: "资格赛第二场",
    dateLabel: "",
    advancementText: "N人 → 晋级24人",
    tags: ["一次抽签到底", "16区", "单败"],
    u16RaceLabel: "9局5胜",
    u20RaceLabel: "13局7胜",
    qualificationNote: "16名分区冠军直接晋级；其余决胜负者按局胜率取前8，共晋级24人。",
  },
  "main-one": {
    phaseNumber: "03",
    title: "正赛第一阶段",
    dateLabel: "",
    advancementText: "64进32",
    tags: ["8组", "双败"],
    u16RaceLabel: "13局7胜",
    u20RaceLabel: "17局9胜",
    qualificationNote: "64人分为8组，每组8人采用双败赛制，每组晋级4人，共32人进入第二阶段。",
  },
  "main-two": {
    phaseNumber: "04",
    title: "正赛第二阶段",
    dateLabel: "",
    advancementText: "32进1",
    tags: ["重新抽签", "32强", "单败"],
    u16RaceLabel: "17局9胜",
    u20RaceLabel: "21局11胜",
    qualificationNote: "32强重新抽签，采用单败淘汰赛制直至产生冠军。",
  },
};

function newId(prefix: string) {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}

function isCode(value: string): value is MasterScheduleCode {
  return MASTER_SCHEDULE_CODES.includes(value as MasterScheduleCode);
}

function cleanTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const unique = new Set<string>();
  for (const item of value) {
    const text = typeof item === "string" ? item.trim() : "";
    if (text) unique.add(text.slice(0, 30));
  }
  return [...unique].slice(0, 8);
}

function detailedSnapshotHasContent(value: string | null) {
  if (!value) return false;
  try {
    const snapshot = JSON.parse(value) as { matches?: unknown[] };
    return Array.isArray(snapshot.matches) && snapshot.matches.length > 0;
  } catch {
    return false;
  }
}

export function parseMasterScheduleSnapshot(value: string | null): MasterScheduleSnapshot | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as { masterSchedule?: Partial<MasterScheduleSnapshot> } | Partial<MasterScheduleSnapshot>;
    const master = "masterSchedule" in parsed ? parsed.masterSchedule : parsed;
    if (!master || !Array.isArray(master.stages)) return null;
    const stages = master.stages.flatMap((raw) => {
      if (!raw || typeof raw !== "object") return [];
      const row = raw as Partial<MasterScheduleStage>;
      if (!row.code || !isCode(String(row.code))) return [];
      const fallback = defaultByCode[row.code as MasterScheduleCode];
      return [{
        code: row.code as MasterScheduleCode,
        phaseNumber: String(row.phaseNumber || fallback.phaseNumber),
        title: String(row.title || fallback.title),
        dateLabel: String(row.dateLabel || ""),
        advancementText: String(row.advancementText || fallback.advancementText),
        tags: cleanTags(row.tags),
        u16RaceLabel: String(row.u16RaceLabel || fallback.u16RaceLabel),
        u20RaceLabel: String(row.u20RaceLabel || fallback.u20RaceLabel),
        qualificationNote: String(row.qualificationNote || fallback.qualificationNote),
      }];
    });
    return stages.length ? { version: 1, stages } : null;
  } catch {
    return null;
  }
}

function mergeFallbackStages(phases: PhaseRow[], competitionFormat: unknown): MasterScheduleStage[] {
  const formatRows = Array.isArray(competitionFormat) ? competitionFormat : [];
  return MASTER_SCHEDULE_CODES.map((code, index) => {
    const fallback = defaultByCode[code];
    const phase = phases.find((item) => item.code === code);
    const format = Array.isArray(formatRows[index]) ? formatRows[index] as unknown[] : [];
    return {
      code,
      phaseNumber: phase?.phaseNumber || fallback.phaseNumber,
      title: phase?.title || (typeof format[0] === "string" && format[0].trim() ? String(format[0]) : fallback.title),
      dateLabel: phase?.dateLabel || "",
      advancementText: typeof format[1] === "string" && format[1].trim() ? String(format[1]) : fallback.advancementText,
      tags: [...fallback.tags],
      u16RaceLabel: typeof format[2] === "string" && format[2].trim() ? String(format[2]) : fallback.u16RaceLabel,
      u20RaceLabel: typeof format[3] === "string" && format[3].trim() ? String(format[3]) : fallback.u20RaceLabel,
      qualificationNote: fallback.qualificationNote,
    };
  });
}

function validateStructure(stages: MasterScheduleStage[]) {
  if (stages.length !== MASTER_SCHEDULE_CODES.length) throw new Error("主赛程需要保留资格赛两场和正赛两个阶段。");
  const seen = new Set<string>();
  for (const stage of stages) {
    if (!isCode(stage.code) || seen.has(stage.code)) throw new Error("赛程阶段结构不正确，请刷新后重试。");
    seen.add(stage.code);
    if (!stage.title.trim()) throw new Error("请填写每个阶段的名称后再保存。");
  }
}

function validatePublishReady(stages: MasterScheduleStage[]) {
  validateStructure(stages);
  for (const stage of stages) {
    if (!stage.dateLabel.trim()) throw new Error(`请填写“${stage.title}”的比赛时间后再发布。`);
    if (!stage.advancementText.trim()) throw new Error(`请填写“${stage.title}”的晋级人数说明后再发布。`);
    if (!stage.u16RaceLabel.trim() || !stage.u20RaceLabel.trim()) throw new Error(`请填写“${stage.title}”少年组和青年组的局数标签后再发布。`);
  }
}

async function bundle(inputPrincipal: AdminPrincipalInput, eventId: string) {
  const principal = await resolveAdminPrincipal(inputPrincipal);
  const viewer = await requireEventAccess(principal, eventId, {
    allowedRoles: ["system_admin", "committee"],
    deniedMessage: "当前账号没有维护本站主赛程的权限。",
  });
  const sql = getSqlClient();
  const [eventRows, phases, publicationRows, detailRows] = await Promise.all([
    sql<EventRow[]>`select id,full_title as "fullTitle",short_title as "shortTitle",city,station_no as "stationNo",status from public.events where id=${eventId} limit 1`,
    sql<PhaseRow[]>`select id,code,phase_number as "phaseNumber",title,date_label as "dateLabel",status,sort_order as "sortOrder" from public.event_phases where event_id=${eventId} order by sort_order,code`,
    sql<PublicationRow[]>`select id,module_type as "moduleType",status,version_no as "versionNo",published_at as "publishedAt",snapshot_json as "snapshotJson",(snapshot_json is not null) as "hasSnapshot" from public.publications where event_id=${eventId} and module_type = any(${[MASTER_SCHEDULE_MODULE, "schedule"]}::text[])`,
    sql<Array<{ competitionFormat: unknown }>>`select competition_format as "competitionFormat" from public.event_details where event_id=${eventId} limit 1`,
  ]);
  const event = eventRows[0];
  if (!event) throw new Error("没有找到这场赛事。");
  const masterPublication = publicationRows.find((row) => row.moduleType === MASTER_SCHEDULE_MODULE);
  const detailedPublication = publicationRows.find((row) => row.moduleType === "schedule");
  const saved = parseMasterScheduleSnapshot(masterPublication?.snapshotJson ?? null);
  const stages = saved?.stages ?? mergeFallbackStages(phases, detailRows[0]?.competitionFormat);
  return { principal, viewer, event, phases, masterPublication, detailedPublication, stages };
}

export async function getSchedulePublishData(inputPrincipal: AdminPrincipalInput, eventId: string): Promise<SchedulePublishData> {
  const data = await bundle(inputPrincipal, eventId);
  return {
    viewerRole: data.viewer.role,
    event: data.event,
    publication: {
      id: data.masterPublication?.id ?? null,
      status: data.masterPublication?.status === "published" ? "published" : "draft",
      versionNo: Number(data.masterPublication?.versionNo ?? 0),
      publishedAt: data.masterPublication?.publishedAt ?? null,
    },
    detailedSchedule: {
      status: data.detailedPublication?.status === "published" ? "published" : "draft",
      hasSnapshot: Boolean(data.detailedPublication?.hasSnapshot),
      hasContent: detailedSnapshotHasContent(data.detailedPublication?.snapshotJson ?? null),
    },
    stages: data.stages,
  };
}

export async function saveSchedulePublishData(inputPrincipal: AdminPrincipalInput, input: SchedulePublishInput): Promise<SchedulePublishData> {
  const stages = input.stages.map((stage) => ({
    ...stage,
    phaseNumber: stage.phaseNumber.trim().slice(0, 8),
    title: stage.title.trim().slice(0, 80),
    dateLabel: stage.dateLabel.trim().slice(0, 80),
    advancementText: stage.advancementText.trim().slice(0, 120),
    tags: cleanTags(stage.tags),
    u16RaceLabel: stage.u16RaceLabel.trim().slice(0, 40),
    u20RaceLabel: stage.u20RaceLabel.trim().slice(0, 40),
    qualificationNote: stage.qualificationNote.trim().slice(0, 500),
  }));
  validateStructure(stages);
  const data = await bundle(inputPrincipal, input.eventId);
  if (data.event.status === "archived") throw new Error("已归档赛事为历史只读状态，不能继续修改主赛程。");
  if (data.masterPublication?.status === "published") validatePublishReady(stages);
  const sql = getSqlClient();
  const timestamp = new Date().toISOString();
  const publicationId = data.masterPublication?.id ?? `${input.eventId}_publication_${MASTER_SCHEDULE_MODULE}`;
  const versionNo = Number(data.masterPublication?.versionNo ?? 0) + 1;
  const snapshot: MasterScheduleSnapshot = { version: 1, stages };

  await sql.begin(async (tx) => {
    for (const [index, stage] of stages.entries()) {
      const existing = data.phases.find((phase) => phase.code === stage.code);
      const phaseId = existing?.id ?? `${input.eventId}_phase_${stage.code.replaceAll("-", "_")}`;
      await tx`
        insert into public.event_phases (id,event_id,code,phase_number,title,date_label,status,sort_order,created_at,updated_at)
        values (${phaseId},${input.eventId},${stage.code},${stage.phaseNumber},${stage.title},${stage.dateLabel},${existing?.status ?? "pending"},${index + 1},${timestamp},${timestamp})
        on conflict (event_id,code) do update set phase_number=excluded.phase_number,title=excluded.title,date_label=excluded.date_label,sort_order=excluded.sort_order,updated_at=excluded.updated_at
      `;
    }
    await tx`
      insert into public.publications (id,event_id,module_type,module_title,version_no,snapshot_json,status,published_by,published_at,created_at,updated_at)
      values (${publicationId},${input.eventId},${MASTER_SCHEDULE_MODULE},'赛事主赛程',${versionNo},${JSON.stringify(snapshot)},${data.masterPublication?.status === "published" ? "published" : "draft"},${data.masterPublication?.status === "published" ? data.viewer.id : null},${data.masterPublication?.status === "published" ? (data.masterPublication.publishedAt ?? timestamp) : null},${timestamp},${timestamp})
      on conflict (event_id,module_type) do update set module_title=excluded.module_title,version_no=excluded.version_no,snapshot_json=excluded.snapshot_json,updated_at=excluded.updated_at
    `;
    await tx`insert into public.audit_logs (id,actor_user_id,event_id,module_type,target_type,target_id,action,after_json,created_at)
      values (${newId("log")},${data.viewer.id},${input.eventId},'schedule_publish','master_schedule',${publicationId},'save_master_schedule',${JSON.stringify({ versionNo, stages: stages.length })},${timestamp})`;
  });
  return getSchedulePublishData(data.principal, input.eventId);
}

export async function setSchedulePublishStatus(inputPrincipal: AdminPrincipalInput, eventId: string, status: "draft" | "published"): Promise<SchedulePublishData> {
  const data = await bundle(inputPrincipal, eventId);
  if (data.event.status === "archived") throw new Error("已归档赛事为历史只读状态，不能修改发布状态。");
  if (status === "published") validatePublishReady(data.stages);
  const sql = getSqlClient();
  const timestamp = new Date().toISOString();
  const publicationId = data.masterPublication?.id ?? `${eventId}_publication_${MASTER_SCHEDULE_MODULE}`;
  const versionNo = Number(data.masterPublication?.versionNo ?? 0) + 1;
  const snapshot: MasterScheduleSnapshot = { version: 1, stages: data.stages };
  await sql.begin(async (tx) => {
    await tx`
      insert into public.publications (id,event_id,module_type,module_title,version_no,snapshot_json,status,published_by,published_at,created_at,updated_at)
      values (${publicationId},${eventId},${MASTER_SCHEDULE_MODULE},'赛事主赛程',${versionNo},${JSON.stringify(snapshot)},${status},${status === "published" ? data.viewer.id : null},${status === "published" ? timestamp : null},${timestamp},${timestamp})
      on conflict (event_id,module_type) do update set module_title=excluded.module_title,version_no=excluded.version_no,snapshot_json=excluded.snapshot_json,status=excluded.status,published_by=excluded.published_by,published_at=excluded.published_at,updated_at=excluded.updated_at
    `;
    await tx`insert into public.audit_logs (id,actor_user_id,event_id,module_type,target_type,target_id,action,before_json,after_json,created_at)
      values (${newId("log")},${data.viewer.id},${eventId},'schedule_publish','publication',${publicationId},${status === "published" ? "publish_master_schedule" : "unpublish_master_schedule"},${JSON.stringify({ status: data.masterPublication?.status ?? "draft" })},${JSON.stringify({ status, versionNo })},${timestamp})`;
  });
  return getSchedulePublishData(data.principal, eventId);
}
