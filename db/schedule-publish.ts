import { randomUUID } from "node:crypto";
import { getSqlClient } from "./index";
import { requireEventAccess, resolveAdminPrincipal, type AdminPrincipalInput } from "./permissions";

export const MASTER_SCHEDULE_MODULE = "master_schedule";
export const SCHEDULE_GROUPS = ["少年组", "青年组"] as const;
export type ScheduleGroup = (typeof SCHEDULE_GROUPS)[number];
export const MASTER_SCHEDULE_CODES = ["qualifier-one", "qualifier-two", "main-one", "main-two"] as const;
export type MasterScheduleCode = (typeof MASTER_SCHEDULE_CODES)[number];

export type MasterScheduleStage = {
  code: MasterScheduleCode;
  phaseNumber: string;
  title: string;
  dateLabel: string;
  advancementText: string;
  tags: string[];
  raceLabel: string;
  qualificationNote: string;
};

export type MasterScheduleGroupSnapshot = {
  published: boolean;
  publishedAt: string | null;
  stages: MasterScheduleStage[];
};

export type MasterScheduleSnapshot = {
  version: 2;
  groups: Record<ScheduleGroup, MasterScheduleGroupSnapshot>;
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
  groups: Record<ScheduleGroup, {
    status: "draft" | "published";
    publishedAt: string | null;
    stages: MasterScheduleStage[];
  }>;
  detailedSchedule: {
    status: "draft" | "published";
    hasSnapshot: boolean;
  };
};

export type SchedulePublishInput = {
  eventId: string;
  group: ScheduleGroup;
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

type LegacyStage = Partial<MasterScheduleStage> & {
  u16RaceLabel?: string;
  u20RaceLabel?: string;
};

const sharedDefaults: Record<MasterScheduleCode, Omit<MasterScheduleStage, "code" | "raceLabel">> = {
  "qualifier-one": {
    phaseNumber: "01",
    title: "资格赛第一场",
    dateLabel: "",
    advancementText: "N人 → 晋级24人",
    tags: ["一次抽签到底", "16区", "单败"],
    qualificationNote: "16名分区冠军直接晋级；其余决胜负者按局胜率取前8，共晋级24人。",
  },
  "qualifier-two": {
    phaseNumber: "02",
    title: "资格赛第二场",
    dateLabel: "",
    advancementText: "N人 → 晋级24人",
    tags: ["一次抽签到底", "16区", "单败"],
    qualificationNote: "16名分区冠军直接晋级；其余决胜负者按局胜率取前8，共晋级24人。",
  },
  "main-one": {
    phaseNumber: "03",
    title: "正赛第一阶段",
    dateLabel: "",
    advancementText: "64进32",
    tags: ["8组", "双败"],
    qualificationNote: "64人分为8组，每组8人采用双败赛制，每组晋级4人，共32人进入第二阶段。",
  },
  "main-two": {
    phaseNumber: "04",
    title: "正赛第二阶段",
    dateLabel: "",
    advancementText: "32进1",
    tags: ["重新抽签", "32强", "单败"],
    qualificationNote: "32强重新抽签，采用单败淘汰赛制直至产生冠军。",
  },
};

const raceDefaults: Record<ScheduleGroup, Record<MasterScheduleCode, string>> = {
  少年组: {
    "qualifier-one": "9局5胜",
    "qualifier-two": "9局5胜",
    "main-one": "13局7胜",
    "main-two": "17局9胜",
  },
  青年组: {
    "qualifier-one": "13局7胜",
    "qualifier-two": "13局7胜",
    "main-one": "17局9胜",
    "main-two": "21局11胜",
  },
};

function newId(prefix: string) {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}

function isCode(value: string): value is MasterScheduleCode {
  return MASTER_SCHEDULE_CODES.includes(value as MasterScheduleCode);
}

function isGroup(value: string): value is ScheduleGroup {
  return SCHEDULE_GROUPS.includes(value as ScheduleGroup);
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

function defaultStage(code: MasterScheduleCode, group: ScheduleGroup, phase?: PhaseRow): MasterScheduleStage {
  const fallback = sharedDefaults[code];
  return {
    code,
    phaseNumber: phase?.phaseNumber || fallback.phaseNumber,
    title: phase?.title || fallback.title,
    dateLabel: phase?.dateLabel || fallback.dateLabel,
    advancementText: fallback.advancementText,
    tags: [...fallback.tags],
    raceLabel: raceDefaults[group][code],
    qualificationNote: fallback.qualificationNote,
  };
}

function parseStage(raw: unknown, group: ScheduleGroup): MasterScheduleStage | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as LegacyStage;
  if (!row.code || !isCode(String(row.code))) return null;
  const code = row.code as MasterScheduleCode;
  const fallback = sharedDefaults[code];
  const legacyRace = group === "少年组" ? row.u16RaceLabel : row.u20RaceLabel;
  return {
    code,
    phaseNumber: String(row.phaseNumber || fallback.phaseNumber),
    title: String(row.title || fallback.title),
    dateLabel: String(row.dateLabel || ""),
    advancementText: String(row.advancementText || fallback.advancementText),
    tags: cleanTags(row.tags).length ? cleanTags(row.tags) : [...fallback.tags],
    raceLabel: String(row.raceLabel || legacyRace || raceDefaults[group][code]),
    qualificationNote: String(row.qualificationNote || fallback.qualificationNote),
  };
}

function normalizeStages(value: unknown, group: ScheduleGroup, phases: PhaseRow[] = []): MasterScheduleStage[] {
  const source = Array.isArray(value) ? value : [];
  const parsed = source.map((item) => parseStage(item, group)).filter((item): item is MasterScheduleStage => Boolean(item));
  return MASTER_SCHEDULE_CODES.map((code) => parsed.find((item) => item.code === code) ?? defaultStage(code, group, phases.find((phase) => phase.code === code)));
}

export function parseMasterScheduleSnapshot(value: string | null, legacyPublished = false, phases: PhaseRow[] = []): MasterScheduleSnapshot | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const root = parsed as Record<string, unknown>;
    const candidate = "masterSchedule" in root && root.masterSchedule && typeof root.masterSchedule === "object"
      ? root.masterSchedule as Record<string, unknown>
      : root;

    if (candidate.groups && typeof candidate.groups === "object") {
      const rawGroups = candidate.groups as Record<string, unknown>;
      const groups = {} as MasterScheduleSnapshot["groups"];
      for (const group of SCHEDULE_GROUPS) {
        const raw = rawGroups[group];
        const record = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
        groups[group] = {
          published: Boolean(record.published),
          publishedAt: typeof record.publishedAt === "string" ? record.publishedAt : null,
          stages: normalizeStages(record.stages, group, phases),
        };
      }
      return { version: 2, groups };
    }

    if (Array.isArray(candidate.stages)) {
      const publishedAt = typeof candidate.publishedAt === "string" ? candidate.publishedAt : null;
      return {
        version: 2,
        groups: {
          少年组: { published: legacyPublished, publishedAt, stages: normalizeStages(candidate.stages, "少年组", phases) },
          青年组: { published: legacyPublished, publishedAt, stages: normalizeStages(candidate.stages, "青年组", phases) },
        },
      };
    }
    return null;
  } catch {
    return null;
  }
}

function makeDefaultSnapshot(phases: PhaseRow[]): MasterScheduleSnapshot {
  return {
    version: 2,
    groups: {
      少年组: { published: false, publishedAt: null, stages: normalizeStages([], "少年组", phases) },
      青年组: { published: false, publishedAt: null, stages: normalizeStages([], "青年组", phases) },
    },
  };
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
    if (!stage.raceLabel.trim()) throw new Error(`请填写“${stage.title}”的局数标签后再发布。`);
  }
}

function overallStatus(snapshot: MasterScheduleSnapshot): "draft" | "published" {
  return SCHEDULE_GROUPS.some((group) => snapshot.groups[group].published) ? "published" : "draft";
}

async function bundle(inputPrincipal: AdminPrincipalInput, eventId: string) {
  const principal = await resolveAdminPrincipal(inputPrincipal);
  const viewer = await requireEventAccess(principal, eventId, {
    allowedRoles: ["system_admin", "committee"],
    deniedMessage: "当前账号没有维护本站主赛程的权限。",
  });
  const sql = getSqlClient();
  const [eventRows, phases, publicationRows] = await Promise.all([
    sql<EventRow[]>`select id,full_title as "fullTitle",short_title as "shortTitle",city,station_no as "stationNo",status from public.events where id=${eventId} limit 1`,
    sql<PhaseRow[]>`select id,code,phase_number as "phaseNumber",title,date_label as "dateLabel",status,sort_order as "sortOrder" from public.event_phases where event_id=${eventId} order by sort_order,code`,
    sql<PublicationRow[]>`select id,module_type as "moduleType",status,version_no as "versionNo",published_at as "publishedAt",snapshot_json as "snapshotJson",(snapshot_json is not null) as "hasSnapshot" from public.publications where event_id=${eventId} and module_type = any(${[MASTER_SCHEDULE_MODULE, "schedule"]}::text[])`,
  ]);
  const event = eventRows[0];
  if (!event) throw new Error("没有找到这场赛事。");
  const masterPublication = publicationRows.find((row) => row.moduleType === MASTER_SCHEDULE_MODULE);
  const detailedPublication = publicationRows.find((row) => row.moduleType === "schedule");
  const snapshot = parseMasterScheduleSnapshot(masterPublication?.snapshotJson ?? null, masterPublication?.status === "published", phases) ?? makeDefaultSnapshot(phases);
  return { principal, viewer, event, phases, masterPublication, detailedPublication, snapshot };
}

function toData(viewerRole: string, event: EventRow, detailedPublication: PublicationRow | undefined, snapshot: MasterScheduleSnapshot): SchedulePublishData {
  return {
    viewerRole,
    event,
    groups: {
      少年组: {
        status: snapshot.groups.少年组.published ? "published" : "draft",
        publishedAt: snapshot.groups.少年组.publishedAt,
        stages: snapshot.groups.少年组.stages,
      },
      青年组: {
        status: snapshot.groups.青年组.published ? "published" : "draft",
        publishedAt: snapshot.groups.青年组.publishedAt,
        stages: snapshot.groups.青年组.stages,
      },
    },
    detailedSchedule: {
      status: detailedPublication?.status === "published" ? "published" : "draft",
      hasSnapshot: Boolean(detailedPublication?.hasSnapshot),
    },
  };
}

export async function getSchedulePublishData(inputPrincipal: AdminPrincipalInput, eventId: string): Promise<SchedulePublishData> {
  const data = await bundle(inputPrincipal, eventId);
  return toData(data.viewer.role, data.event, data.detailedPublication, data.snapshot);
}

export async function saveSchedulePublishData(inputPrincipal: AdminPrincipalInput, input: SchedulePublishInput): Promise<SchedulePublishData> {
  if (!isGroup(input.group)) throw new Error("赛程组别不正确。");
  const stages = input.stages.map((stage) => ({
    ...stage,
    phaseNumber: stage.phaseNumber.trim().slice(0, 8),
    title: stage.title.trim().slice(0, 80),
    dateLabel: stage.dateLabel.trim().slice(0, 80),
    advancementText: stage.advancementText.trim().slice(0, 120),
    tags: cleanTags(stage.tags),
    raceLabel: stage.raceLabel.trim().slice(0, 40),
    qualificationNote: stage.qualificationNote.trim().slice(0, 500),
  }));
  validateStructure(stages);
  const data = await bundle(inputPrincipal, input.eventId);
  if (data.event.status === "archived") throw new Error("已归档赛事为历史只读状态，不能继续修改主赛程。");
  if (data.snapshot.groups[input.group].published) validatePublishReady(stages);

  const nextSnapshot: MasterScheduleSnapshot = {
    ...data.snapshot,
    groups: {
      ...data.snapshot.groups,
      [input.group]: { ...data.snapshot.groups[input.group], stages },
    },
  };
  const sql = getSqlClient();
  const timestamp = new Date().toISOString();
  const publicationId = data.masterPublication?.id ?? `${input.eventId}_publication_${MASTER_SCHEDULE_MODULE}`;
  const versionNo = Number(data.masterPublication?.versionNo ?? 0) + 1;
  const status = overallStatus(nextSnapshot);
  const publishedAt = SCHEDULE_GROUPS.map((group) => nextSnapshot.groups[group].publishedAt).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;

  await sql.begin(async (tx) => {
    await tx`
      insert into public.publications (id,event_id,module_type,module_title,version_no,snapshot_json,status,published_by,published_at,created_at,updated_at)
      values (${publicationId},${input.eventId},${MASTER_SCHEDULE_MODULE},'赛事主赛程',${versionNo},${JSON.stringify(nextSnapshot)},${status},${status === "published" ? data.viewer.id : null},${publishedAt},${timestamp},${timestamp})
      on conflict (event_id,module_type) do update set module_title=excluded.module_title,version_no=excluded.version_no,snapshot_json=excluded.snapshot_json,status=excluded.status,published_by=excluded.published_by,published_at=excluded.published_at,updated_at=excluded.updated_at
    `;
    await tx`insert into public.audit_logs (id,actor_user_id,event_id,module_type,target_type,target_id,action,after_json,created_at)
      values (${newId("log")},${data.viewer.id},${input.eventId},'schedule_publish','master_schedule',${publicationId},'save_master_schedule_group',${JSON.stringify({ group: input.group, versionNo, stages: stages.length })},${timestamp})`;
  });
  return getSchedulePublishData(data.principal, input.eventId);
}

export async function setSchedulePublishStatus(inputPrincipal: AdminPrincipalInput, eventId: string, group: ScheduleGroup, status: "draft" | "published"): Promise<SchedulePublishData> {
  if (!isGroup(group)) throw new Error("赛程组别不正确。");
  const data = await bundle(inputPrincipal, eventId);
  if (data.event.status === "archived") throw new Error("已归档赛事为历史只读状态，不能修改发布状态。");
  if (status === "published") validatePublishReady(data.snapshot.groups[group].stages);

  const timestamp = new Date().toISOString();
  const nextSnapshot: MasterScheduleSnapshot = {
    ...data.snapshot,
    groups: {
      ...data.snapshot.groups,
      [group]: {
        ...data.snapshot.groups[group],
        published: status === "published",
        publishedAt: status === "published" ? timestamp : null,
      },
    },
  };
  const overall = overallStatus(nextSnapshot);
  const overallPublishedAt = SCHEDULE_GROUPS.map((item) => nextSnapshot.groups[item].publishedAt).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
  const sql = getSqlClient();
  const publicationId = data.masterPublication?.id ?? `${eventId}_publication_${MASTER_SCHEDULE_MODULE}`;
  const versionNo = Number(data.masterPublication?.versionNo ?? 0) + 1;

  await sql.begin(async (tx) => {
    await tx`
      insert into public.publications (id,event_id,module_type,module_title,version_no,snapshot_json,status,published_by,published_at,created_at,updated_at)
      values (${publicationId},${eventId},${MASTER_SCHEDULE_MODULE},'赛事主赛程',${versionNo},${JSON.stringify(nextSnapshot)},${overall},${overall === "published" ? data.viewer.id : null},${overallPublishedAt},${timestamp},${timestamp})
      on conflict (event_id,module_type) do update set module_title=excluded.module_title,version_no=excluded.version_no,snapshot_json=excluded.snapshot_json,status=excluded.status,published_by=excluded.published_by,published_at=excluded.published_at,updated_at=excluded.updated_at
    `;
    await tx`insert into public.audit_logs (id,actor_user_id,event_id,module_type,target_type,target_id,action,before_json,after_json,created_at)
      values (${newId("log")},${data.viewer.id},${eventId},'schedule_publish','publication',${publicationId},${status === "published" ? "publish_master_schedule_group" : "unpublish_master_schedule_group"},${JSON.stringify({ group, status: data.snapshot.groups[group].published ? "published" : "draft" })},${JSON.stringify({ group, status, versionNo })},${timestamp})`;
  });
  return getSchedulePublishData(data.principal, eventId);
}
