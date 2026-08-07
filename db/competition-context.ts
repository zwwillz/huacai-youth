import { randomUUID } from "node:crypto";
import { getSqlClient } from "./index";
import { buildCompetitionPublicationSnapshot } from "./public-competition-live";

export type CompetitionContextGroup = { id: string; name: string; code: string };
export type CompetitionPublicationModule = "schedule" | "matches" | "rankings";
export type CompetitionPublicationState = {
  id: string | null;
  status: string;
  versionNo: number;
  publishedAt: string | null;
  hasUnpublishedChanges: boolean;
  draftUpdatedAt: string | null;
  hasSnapshot: boolean;
};

export type CompetitionContextData = {
  event: { id: string; shortTitle: string };
  groups: CompetitionContextGroup[];
  publications: Record<CompetitionPublicationModule, CompetitionPublicationState>;
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
    sql<Array<{ id: string; moduleType: CompetitionPublicationModule; status: string; versionNo: number; publishedAt: string | null; hasUnpublishedChanges: boolean; draftUpdatedAt: string | null; hasSnapshot: boolean }>>`
      select id,module_type as "moduleType",status,version_no as "versionNo",published_at as "publishedAt",
        has_unpublished_changes as "hasUnpublishedChanges",draft_updated_at as "draftUpdatedAt",(snapshot_json is not null) as "hasSnapshot"
      from public.publications where event_id=${eventId} and module_type in ('schedule','matches','rankings')
    `,
  ]);
  if (!events[0]) throw new Error("没有找到这场赛事。");
  const initial = (): CompetitionPublicationState => ({ id: null, status: "draft", versionNo: 0, publishedAt: null, hasUnpublishedChanges: false, draftUpdatedAt: null, hasSnapshot: false });
  const publications: CompetitionContextData["publications"] = { schedule: initial(), matches: initial(), rankings: initial() };
  for (const row of rows) publications[row.moduleType] = { id: row.id, status: row.status, versionNo: row.versionNo, publishedAt: row.publishedAt, hasUnpublishedChanges: row.hasUnpublishedChanges, draftUpdatedAt: row.draftUpdatedAt, hasSnapshot: row.hasSnapshot };
  return { event: events[0], groups, publications };
}

const publicationTitles: Record<CompetitionPublicationModule, string> = { schedule: "签表与赛程", matches: "对阵与比分", rankings: "最终排名" };

export async function setCompetitionPublicationStatus(username: string, eventId: string, moduleType: CompetitionPublicationModule, status: "draft" | "published") {
  const viewer = await requireViewer(username, true);
  const sql = getSqlClient();
  const timestamp = new Date().toISOString();
  const rows = await sql<Array<{ id: string; versionNo: number; status: string; hasUnpublishedChanges: boolean; hasSnapshot: boolean }>>`
    select id,version_no as "versionNo",status,has_unpublished_changes as "hasUnpublishedChanges",(snapshot_json is not null) as "hasSnapshot"
    from public.publications where event_id=${eventId} and module_type=${moduleType} limit 1
  `;
  const current = rows[0];
  const publicationId = current?.id ?? `${eventId}_publication_${moduleType}`;
  const versionNo = (current?.versionNo ?? 0) + 1;
  const snapshot = status === "published" && (moduleType === "schedule" || moduleType === "matches")
    ? JSON.stringify(await buildCompetitionPublicationSnapshot(eventId, moduleType))
    : null;

  await sql.begin(async (tx) => {
    await tx`
      insert into public.publications
        (id,event_id,module_type,module_title,version_no,snapshot_json,status,published_by,published_at,has_unpublished_changes,draft_updated_at,created_at,updated_at)
      values (${publicationId},${eventId},${moduleType},${publicationTitles[moduleType]},${versionNo},${snapshot},${status},${status === "published" ? viewer.id : null},${status === "published" ? timestamp : null},false,null,${timestamp},${timestamp})
      on conflict (event_id,module_type) do update set
        module_title=excluded.module_title,
        version_no=excluded.version_no,
        snapshot_json=case when excluded.status='published' and excluded.snapshot_json is not null then excluded.snapshot_json else public.publications.snapshot_json end,
        status=excluded.status,
        published_by=excluded.published_by,
        published_at=excluded.published_at,
        has_unpublished_changes=false,
        draft_updated_at=null,
        updated_at=excluded.updated_at
    `;
    await tx`insert into public.audit_logs (id,actor_user_id,event_id,module_type,target_type,target_id,action,before_json,after_json,created_at)
      values (${`log_${randomUUID().replaceAll("-","")}`},${viewer.id},${eventId},'competition','publication',${publicationId},${status === "published" ? "publish_competition_module" : "unpublish_competition_module"},${JSON.stringify(current ?? null)},${JSON.stringify({ moduleType,status,versionNo,snapshotUpdated:Boolean(snapshot) })},${timestamp})`;
  });
  return getCompetitionContextData(username, eventId);
}

/** Mark backend data as newer than the public snapshot without changing what users currently see. */
export async function markCompetitionModuleDirty(eventId: string, moduleType: CompetitionPublicationModule) {
  const sql = getSqlClient();
  const timestamp = new Date().toISOString();
  const publicationId = `${eventId}_publication_${moduleType}`;
  await sql`
    insert into public.publications
      (id,event_id,module_type,module_title,version_no,status,has_unpublished_changes,draft_updated_at,created_at,updated_at)
    values (${publicationId},${eventId},${moduleType},${publicationTitles[moduleType]},1,'draft',true,${timestamp},${timestamp},${timestamp})
    on conflict (event_id,module_type) do update set
      has_unpublished_changes=true,
      draft_updated_at=excluded.draft_updated_at,
      updated_at=excluded.updated_at
  `;
}
