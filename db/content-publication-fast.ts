import { randomUUID } from "node:crypto";
import { getSqlClient } from "./index";
import { assertAdminRole, resolveAdminPrincipal, type AdminPrincipalInput } from "./permissions";
import { getContentManagementDataFast } from "./content-management-fast";
import { createRegulationSnapshot } from "./regulation-snapshot-policy.mjs";

function newId(prefix: string) { return `${prefix}_${randomUUID().replaceAll("-", "")}`; }

export async function setContentPublicationStatusFast(
  inputPrincipal: AdminPrincipalInput,
  eventId: string,
  publicationId: string,
  status: "draft" | "published",
) {
  const viewer = await resolveAdminPrincipal(inputPrincipal);
  assertAdminRole(viewer, ["system_admin", "committee"], "当前账号没有编辑和发布赛事内容的权限。");
  const sql = getSqlClient();
  const rows = await sql<Array<{ id: string; moduleType: string; status: string; versionNo: number }>>`
    select p.id,p.module_type as "moduleType",p.status,p.version_no as "versionNo"
    from public.publications p
    where p.id=${publicationId} and p.event_id=${eventId}
      and (${viewer.role}='system_admin' or exists (
        select 1 from public.event_members em where em.event_id=p.event_id and em.user_id=${viewer.id} and em.status='active'
      ))
    limit 1
  `;
  const before = rows[0];
  if (!before) throw new Error("没有找到要发布的内容模块，或当前账号未被分配到本站。");
  const updatedAt = new Date().toISOString();
  const versionNo = Number(before.versionNo) + 1;
  await sql.begin(async (tx) => {
    let regulationSnapshotJson: string | null = null;
    if (before.moduleType === "regulation" && status === "published") {
      const detailRows = await tx<Array<{
        competitionFormat: unknown;
        ruleStandard: string | null;
        drawRules: unknown;
        prizeNote: string | null;
        prizes: unknown;
      }>>`
        select competition_format as "competitionFormat",rule_standard as "ruleStandard",draw_rules as "drawRules",
          prize_note as "prizeNote",prizes
        from public.event_details
        where event_id=${eventId}
        limit 1
      `;
      regulationSnapshotJson = JSON.stringify(createRegulationSnapshot(detailRows[0] ?? {}));
    }

    const updated = before.moduleType === "regulation" && status === "published"
      ? await tx<Array<{ id: string }>>`
          update public.publications
          set status=${status},version_no=${versionNo},snapshot_json=${regulationSnapshotJson},published_by=${viewer.id},
            published_at=${updatedAt},updated_at=${updatedAt}
          where id=${publicationId} and event_id=${eventId} and version_no=${before.versionNo}
          returning id
        `
      : await tx<Array<{ id: string }>>`
          update public.publications
          set status=${status},version_no=${versionNo},published_by=${status === "published" ? viewer.id : null},
            published_at=${status === "published" ? updatedAt : null},updated_at=${updatedAt}
          where id=${publicationId} and event_id=${eventId} and version_no=${before.versionNo}
          returning id
        `;
    if (!updated.length) throw new Error("发布状态已被其他人修改，请刷新后重试。");
    await tx`insert into public.audit_logs
      (id,actor_user_id,event_id,module_type,target_type,target_id,action,before_json,after_json,created_at)
      values (${newId("log")},${viewer.id},${eventId},'content','publication',${publicationId},${status === "published" ? "publish" : "unpublish"},
        ${JSON.stringify({ status: before.status, versionNo: before.versionNo })},
        ${JSON.stringify({ status, versionNo, publishedAt: status === "published" ? updatedAt : null, regulationSnapshotVersion: regulationSnapshotJson ? 1 : undefined })},${updatedAt})`;
  });
  return getContentManagementDataFast(viewer, eventId);
}
