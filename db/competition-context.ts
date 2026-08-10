import { randomUUID } from "node:crypto";
import { getSqlClient } from "./index";
import { buildCompetitionPublicationSnapshot } from "./public-competition-live";
import { assertAdminRole, requireEventAccess, resolveAdminPrincipal, type AdminPrincipalInput } from "./permissions";

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

type ContextPublicationRow = {
  id: string;
  moduleType: CompetitionPublicationModule;
  status: string;
  versionNo: number;
  publishedAt: string | null;
  hasUnpublishedChanges: boolean;
  draftUpdatedAt: string | null;
  hasSnapshot: boolean;
};
type ContextBundleRow = {
  id: string;
  shortTitle: string;
  groups: CompetitionContextGroup[] | null;
  publicationRows: ContextPublicationRow[] | null;
};

export async function getCompetitionContextData(input: AdminPrincipalInput, eventId: string): Promise<CompetitionContextData> {
  const principal = await resolveAdminPrincipal(input);
  assertAdminRole(principal, ["system_admin", "committee", "referee"], "当前账号没有竞赛执行权限。");
  if (!eventId) throw new Error("缺少赛事ID。");

  const sql = getSqlClient();
  const rows = await sql<ContextBundleRow[]>`
    with accessible_event as (
      select e.id,e.short_title
      from public.events e
      where e.id=${eventId}
        and (
          ${principal.role}='system_admin'
          or exists (
            select 1 from public.event_members em
            where em.event_id=e.id and em.user_id=${principal.id} and em.status='active'
          )
        )
      limit 1
    )
    select e.id,e.short_title as "shortTitle",
      coalesce((
        select jsonb_agg(jsonb_build_object('id',g.id,'name',g.name,'code',g.code) order by g.code)
        from public.event_groups g
        where g.event_id=e.id and g.status='active'
      ),'[]'::jsonb) as groups,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',p.id,'moduleType',p.module_type,'status',p.status,'versionNo',p.version_no,
          'publishedAt',p.published_at,'hasUnpublishedChanges',p.has_unpublished_changes,
          'draftUpdatedAt',p.draft_updated_at,'hasSnapshot',(p.snapshot_json is not null)
        ))
        from public.publications p
        where p.event_id=e.id and p.module_type in ('schedule','matches','rankings')
      ),'[]'::jsonb) as "publicationRows"
    from accessible_event e
  `;
  const row = rows[0];
  if (!row) throw new Error("没有找到这场赛事，或当前账号未被分配到本站。");

  const initial = (): CompetitionPublicationState => ({ id: null, status: "draft", versionNo: 0, publishedAt: null, hasUnpublishedChanges: false, draftUpdatedAt: null, hasSnapshot: false });
  const publications: CompetitionContextData["publications"] = { schedule: initial(), matches: initial(), rankings: initial() };
  for (const publication of row.publicationRows ?? []) {
    if (!publications[publication.moduleType]) continue;
    publications[publication.moduleType] = {
      id: publication.id,
      status: publication.status,
      versionNo: Number(publication.versionNo),
      publishedAt: publication.publishedAt,
      hasUnpublishedChanges: Boolean(publication.hasUnpublishedChanges),
      draftUpdatedAt: publication.draftUpdatedAt,
      hasSnapshot: Boolean(publication.hasSnapshot),
    };
  }
  return { event: { id: row.id, shortTitle: row.shortTitle }, groups: row.groups ?? [], publications };
}

const publicationTitles: Record<CompetitionPublicationModule, string> = { schedule: "签表与赛程", matches: "对阵与比分", rankings: "最终排名" };

export async function setCompetitionPublicationStatus(input: AdminPrincipalInput, eventId: string, moduleType: CompetitionPublicationModule, status: "draft" | "published") {
  const principal = await resolveAdminPrincipal(input);
  const viewer = await requireEventAccess(principal, eventId, {
    write: true,
    allowedRoles: ["system_admin", "committee"],
    deniedMessage: "发布到用户端需要系统管理员或组委会权限。",
  });
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
  return getCompetitionContextData(principal, eventId);
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
