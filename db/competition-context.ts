import { getSqlClient } from "./index";

export type CompetitionContextGroup = { id: string; name: string; code: string };
export type CompetitionPublicationModule = "schedule" | "matches" | "rankings";

export type CompetitionContextData = {
  event: { id: string; shortTitle: string };
  groups: CompetitionContextGroup[];
  publications: Record<CompetitionPublicationModule, { id: string | null; status: string; versionNo: number; publishedAt: string | null }>;
};

type Viewer = { id: string; role: string };

async function requireViewer(username: string, write = false): Promise<Viewer> {
  const sql = getSqlClient();
  const rows = await sql<Viewer[]>`select id,role from public.users where username=${username} and status='active' limit 1`;
  const viewer = rows[0];
  if (!viewer || !["system_admin","committee","referee"].includes(viewer.role)) throw new Error("当前账号没有竞赛执行权限。");
  if (write && !["system_admin","committee"].includes(viewer.role)) throw new Error("发布到用户端需要系统管理员或组委会权限。");
  return viewer;
}

export async function getCompetitionContextData(username: string, eventId: string): Promise<CompetitionContextData> {
  await requireViewer(username);
  const sql = getSqlClient();
  const [events, groups, rows] = await Promise.all([
    sql<Array<{ id: string; shortTitle: string }>>`select id,short_title as "shortTitle" from public.events where id=${eventId} limit 1`,
    sql<CompetitionContextGroup[]>`select id,name,code from public.event_groups where event_id=${eventId} and status='active' order by code`,
    sql<Array<{ id: string; moduleType: CompetitionPublicationModule; status: string; versionNo: number; publishedAt: string | null }>>`
      select id,module_type as "moduleType",status,version_no as "versionNo",published_at as "publishedAt"
      from public.publications where event_id=${eventId} and module_type in ('schedule','matches','rankings')
    `,
  ]);
  if (!events[0]) throw new Error("没有找到这场赛事。");
  const publications = {
    schedule: { id: null, status: "draft", versionNo: 0, publishedAt: null },
    matches: { id: null, status: "draft", versionNo: 0, publishedAt: null },
    rankings: { id: null, status: "draft", versionNo: 0, publishedAt: null },
  } satisfies CompetitionContextData["publications"];
  for (const row of rows) publications[row.moduleType] = { id: row.id, status: row.status, versionNo: row.versionNo, publishedAt: row.publishedAt };
  return { event: events[0], groups, publications };
}

const publicationTitles: Record<CompetitionPublicationModule, string> = {
  schedule: "赛程",
  matches: "对阵与比分",
  rankings: "排名",
};

export async function setCompetitionPublicationStatus(username: string, eventId: string, moduleType: CompetitionPublicationModule, status: "draft" | "published") {
  const viewer = await requireViewer(username, true);
  const sql = getSqlClient();
  const timestamp = new Date().toISOString();
  const rows = await sql<Array<{ id: string; versionNo: number; status: string }>>`
    select id,version_no as "versionNo",status from public.publications where event_id=${eventId} and module_type=${moduleType} limit 1
  `;
  const current = rows[0];
  const publicationId = current?.id ?? `${eventId}_publication_${moduleType}`;
  const versionNo = (current?.versionNo ?? 0) + 1;
  await sql.begin(async (tx) => {
    await tx`
      insert into public.publications
        (id,event_id,module_type,module_title,version_no,status,published_by,published_at,created_at,updated_at)
      values (${publicationId},${eventId},${moduleType},${publicationTitles[moduleType]},${versionNo},${status},${status === "published" ? viewer.id : null},${status === "published" ? timestamp : null},${timestamp},${timestamp})
      on conflict (id) do update set version_no=excluded.version_no,status=excluded.status,published_by=excluded.published_by,published_at=excluded.published_at,updated_at=excluded.updated_at
    `;
    await tx`insert into public.audit_logs (id,actor_user_id,event_id,module_type,target_type,target_id,action,before_json,after_json,created_at)
      values (${`log_${crypto.randomUUID().replaceAll("-","")}`},${viewer.id},${eventId},'competition','publication',${publicationId},${status === "published" ? "publish_competition_module" : "unpublish_competition_module"},${JSON.stringify(current ?? null)},${JSON.stringify({ moduleType,status,versionNo })},${timestamp})`;
  });
  return getCompetitionContextData(username, eventId);
}

export async function markCompetitionModuleDirty(eventId: string, moduleType: CompetitionPublicationModule) {
  const sql = getSqlClient();
  const timestamp = new Date().toISOString();
  await sql`
    update public.publications
    set status='draft',published_by=null,published_at=null,updated_at=${timestamp}
    where event_id=${eventId} and module_type=${moduleType} and status='published'
  `;
}
