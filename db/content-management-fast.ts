import { getSqlClient } from "./index";
import { assertAdminRole, resolveAdminPrincipal, type AdminPrincipalInput } from "./permissions";
import type { ContentDocument, ContentGuide, ContentManagementData, ContentPublication } from "./content-management";

const RULE_STANDARD_PREFIX = "@@rule-standard:";
const PRIZE_NOTE_PREFIX = "@@prize-note:";

type BundleRow = {
  id: string;
  shortTitle: string;
  fullTitle: string;
  city: string;
  status: string;
  publishStatus: string;
  summary: string | null;
  competitionFormat: unknown;
  drawRules: unknown;
  prizes: unknown;
  publications: ContentPublication[] | null;
  documents: Array<{ id: string; documentType: string; title: string; url: string; isPublished: boolean }> | null;
  guides: ContentGuide[] | null;
};

function asRows(value: unknown): string[][] {
  if (!Array.isArray(value)) return [];
  return value.filter(Array.isArray).map((row) => (row as unknown[]).map((item) => String(item ?? "")));
}
function asStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item ?? "")).filter(Boolean) : [];
}
function parseDrawBundle(value: unknown) {
  const rows = asStrings(value);
  return {
    ruleStandard: rows.find((item) => item.startsWith(RULE_STANDARD_PREFIX))?.slice(RULE_STANDARD_PREFIX.length) ?? "",
    prizeNote: rows.find((item) => item.startsWith(PRIZE_NOTE_PREFIX))?.slice(PRIZE_NOTE_PREFIX.length) ?? "",
    drawRules: rows.filter((item) => !item.startsWith(RULE_STANDARD_PREFIX) && !item.startsWith(PRIZE_NOTE_PREFIX)),
  };
}
function prizeMap(value: unknown) {
  const result: Record<"少年组" | "青年组", string[][]> = { 少年组: [], 青年组: [] };
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    result.少年组 = asRows(record.少年组);
    result.青年组 = asRows(record.青年组);
  }
  return result;
}

export async function getContentManagementDataFast(input: AdminPrincipalInput, eventId: string): Promise<ContentManagementData> {
  const principal = await resolveAdminPrincipal(input);
  assertAdminRole(principal, ["system_admin", "committee"], "当前账号没有编辑和发布赛事内容的权限。");
  if (!eventId) throw new Error("缺少赛事ID。");
  const sql = getSqlClient();
  const rows = await sql<BundleRow[]>`
    select e.id,e.short_title as "shortTitle",e.full_title as "fullTitle",e.city,e.status,e.publish_status as "publishStatus",e.summary,
      d.competition_format as "competitionFormat",d.draw_rules as "drawRules",d.prizes,
      coalesce((select jsonb_agg(jsonb_build_object(
        'id',p.id,'moduleType',p.module_type,'moduleTitle',p.module_title,'versionNo',p.version_no,
        'status',p.status,'publishedAt',coalesce(p.published_at,'')
      ) order by p.module_type) from public.publications p where p.event_id=e.id),'[]'::jsonb) as publications,
      coalesce((select jsonb_agg(jsonb_build_object(
        'id',doc.id,'documentType',doc.document_type,'title',doc.title,
        'url',coalesce(doc.external_url,doc.file_key,''),'isPublished',doc.is_published
      ) order by doc.document_type) from public.event_documents doc where doc.event_id=e.id),'[]'::jsonb) as documents,
      coalesce((select jsonb_agg(jsonb_build_object(
        'id',g.id,'guideType',g.guide_type,'title',g.title,'body',coalesce(g.body,''),'publishStatus',g.publish_status
      ) order by g.guide_type) from public.event_guides g where g.event_id=e.id),'[]'::jsonb) as guides
    from public.events e
    left join public.event_details d on d.event_id=e.id
    where e.id=${eventId}
      and (${principal.role}='system_admin' or exists (
        select 1 from public.event_members access_member
        where access_member.event_id=e.id and access_member.user_id=${principal.id} and access_member.status='active'
      ))
    limit 1
  `;
  const row = rows[0];
  if (!row) throw new Error("没有找到这场赛事，或当前账号未被分配到本站。");

  const documentByType = new Map((row.documents ?? []).map((item) => [item.documentType, item]));
  const normalizedDocuments: ContentDocument[] = ([
    ["regulation", "完整竞赛规程"],
    ["referee_list", "裁判员名单"],
  ] as const).map(([documentType, title]) => {
    const item = documentByType.get(documentType);
    return { id: item?.id ?? "", documentType, title: item?.title ?? title, url: item?.url ?? "", isPublished: item?.isPublished ?? false };
  });
  const guideByType = new Map((row.guides ?? []).map((item) => [item.guideType, item]));
  const normalizedGuides: ContentGuide[] = ([
    ["transport", "交通住宿攻略"],
    ["clothing", "服装要求"],
  ] as const).map(([guideType, title]) => {
    const item = guideByType.get(guideType);
    return { id: item?.id ?? "", guideType, title: item?.title ?? title, body: item?.body ?? "", publishStatus: item?.publishStatus ?? "draft" };
  });
  const drawBundle = parseDrawBundle(row.drawRules);

  return {
    event: {
      id: row.id,
      shortTitle: row.shortTitle,
      fullTitle: row.fullTitle,
      city: row.city,
      status: row.status,
      publishStatus: row.publishStatus,
      summary: row.summary ?? "",
    },
    publications: row.publications ?? [],
    details: {
      competitionFormat: asRows(row.competitionFormat),
      drawRules: drawBundle.drawRules,
      ruleStandard: drawBundle.ruleStandard,
      prizeNote: drawBundle.prizeNote,
      prizes: prizeMap(row.prizes),
    },
    documents: normalizedDocuments,
    guides: normalizedGuides,
  };
}
