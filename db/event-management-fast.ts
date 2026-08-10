import { getSqlClient } from "./index";
import { assertAdminRole, resolveAdminPrincipal, type AdminPrincipalInput } from "./permissions";
import type { EventManagementData, ManagedEventGroup, ManagedEventSponsor } from "./event-management";

type FastGroup = Omit<ManagedEventGroup, "registrationFeeYuan" | "ageRuleText"> & { registrationFeeCents: number };
type FastOrganization = { organizationType: "host" | "support" | "operator" | "cooperator"; organizationName: string };
type FastPublication = { moduleType: string; status: string };
type FastAccount = { id: string; username: string; displayName: string; role: string; status: string };
type FastSponsor = ManagedEventSponsor;
type BundleRow = {
  id: string;
  year: number;
  stationNo: number;
  fullTitle: string;
  shortTitle: string;
  slug: string;
  city: string;
  startDate: string;
  endDate: string;
  registrationStartAt: string | null;
  registrationEndAt: string | null;
  coverImageKey: string | null;
  summary: string | null;
  status: string;
  publishStatus: string;
  venueId: string | null;
  venueName: string | null;
  venueProvince: string | null;
  venueCity: string | null;
  venueDistrict: string | null;
  venueAddress: string | null;
  venueTableCount: number | null;
  sponsorLabel: string | null;
  durationLabel: string | null;
  qualifierDateLabel: string | null;
  mainDateLabel: string | null;
  totalPrizeLabel: string | null;
  mainSizeLabel: string | null;
  minimumAgeNote: string | null;
  signupNote: string | null;
  ageRules: unknown;
  groups: FastGroup[] | null;
  organizations: FastOrganization[] | null;
  memberIds: string[] | null;
  sponsors: FastSponsor[] | null;
  publications: FastPublication[] | null;
  accounts: FastAccount[] | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  let normalized = value;
  if (typeof normalized === "string") {
    try { normalized = JSON.parse(normalized); } catch { return {}; }
  }
  return normalized && typeof normalized === "object" && !Array.isArray(normalized) ? normalized as Record<string, unknown> : {};
}

/** One bridge request for the complete event-settings editor after session authentication. */
export async function getEventManagementDataFast(input: AdminPrincipalInput, eventId: string): Promise<EventManagementData> {
  const principal = await resolveAdminPrincipal(input);
  assertAdminRole(principal, ["system_admin", "committee"], "当前账号没有编辑赛事资料的权限。");
  if (!eventId) throw new Error("缺少赛事ID。");
  const sql = getSqlClient();
  const rows = await sql<BundleRow[]>`
    select e.id,e.year,e.station_no as "stationNo",e.full_title as "fullTitle",e.short_title as "shortTitle",e.slug,e.city,
      e.start_date as "startDate",e.end_date as "endDate",e.registration_start_at as "registrationStartAt",
      e.registration_end_at as "registrationEndAt",e.cover_image_key as "coverImageKey",e.summary,e.status,e.publish_status as "publishStatus",
      v.id as "venueId",v.name as "venueName",v.province as "venueProvince",v.city as "venueCity",v.district as "venueDistrict",
      v.address as "venueAddress",v.table_count as "venueTableCount",
      d.sponsor_label as "sponsorLabel",d.duration_label as "durationLabel",d.qualifier_date_label as "qualifierDateLabel",
      d.main_date_label as "mainDateLabel",d.total_prize_label as "totalPrizeLabel",d.main_size_label as "mainSizeLabel",
      d.minimum_age_note as "minimumAgeNote",d.signup_note as "signupNote",d.age_rules as "ageRules",
      coalesce((select jsonb_agg(jsonb_build_object(
        'id',g.id,'name',g.name,'code',g.code,'birthDateFrom',g.birth_date_from,'birthDateTo',g.birth_date_to,
        'minimumAge',g.minimum_age,'registrationFeeCents',g.registration_fee_cents,'registrationLimit',g.registration_limit,
        'mainDrawSize',g.main_draw_size,'status',g.status
      ) order by g.code) from public.event_groups g where g.event_id=e.id),'[]'::jsonb) as groups,
      coalesce((select jsonb_agg(jsonb_build_object('organizationType',o.organization_type,'organizationName',o.organization_name) order by o.sort_order)
        from public.event_organizations o where o.event_id=e.id),'[]'::jsonb) as organizations,
      coalesce((select jsonb_agg(em.user_id) from public.event_members em where em.event_id=e.id and em.status='active'),'[]'::jsonb) as "memberIds",
      coalesce((select jsonb_agg(jsonb_build_object(
        'id',s.id,'name',s.name,'sponsorType',s.sponsor_type,'logoKey',coalesce(s.logo_key,''),'websiteUrl',coalesce(s.website_url,''),
        'sortOrder',s.sort_order,'isPublished',s.is_published
      ) order by s.sort_order) from public.event_sponsors s where s.event_id=e.id),'[]'::jsonb) as sponsors,
      coalesce((select jsonb_agg(jsonb_build_object('moduleType',p.module_type,'status',p.status)) from public.publications p where p.event_id=e.id),'[]'::jsonb) as publications,
      case when ${principal.role}='system_admin' then coalesce((select jsonb_agg(jsonb_build_object(
        'id',u.id,'username',u.username,'displayName',u.display_name,'role',u.role,'status',u.status
      ) order by u.display_name) from public.users u where u.status='active' and u.role in ('committee','referee')),'[]'::jsonb) else '[]'::jsonb end as accounts
    from public.events e
    left join public.venues v on v.id=e.venue_id
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
  const ageRules = asRecord(row.ageRules);
  const organizations: EventManagementData["event"]["organizations"] = { host: "", support: "", operator: "", cooperator: "" };
  for (const item of row.organizations ?? []) organizations[item.organizationType] = item.organizationName;
  return {
    viewerRole: principal.role,
    publicationStatuses: Object.fromEntries((row.publications ?? []).map((item) => [item.moduleType, item.status])),
    event: {
      id: row.id,
      year: Number(row.year),
      stationNo: Number(row.stationNo),
      fullTitle: row.fullTitle,
      shortTitle: row.shortTitle,
      slug: row.slug,
      city: row.city,
      startDate: row.startDate,
      endDate: row.endDate,
      registrationStartAt: row.registrationStartAt ?? "",
      registrationEndAt: row.registrationEndAt ?? "",
      coverImageKey: row.coverImageKey ?? "",
      summary: row.summary ?? "",
      status: row.status,
      publishStatus: row.publishStatus,
      venue: {
        id: row.venueId,
        name: row.venueName ?? "",
        province: row.venueProvince ?? "",
        city: row.venueCity ?? "",
        district: row.venueDistrict ?? "",
        address: row.venueAddress ?? "",
        tableCount: Number(row.venueTableCount ?? 0),
      },
      details: {
        sponsorLabel: row.sponsorLabel ?? "",
        durationLabel: row.durationLabel ?? "",
        qualifierDateLabel: row.qualifierDateLabel ?? "",
        mainDateLabel: row.mainDateLabel ?? "",
        totalPrizeLabel: row.totalPrizeLabel ?? "",
        mainSizeLabel: row.mainSizeLabel ?? "",
        minimumAgeNote: row.minimumAgeNote ?? "",
        signupNote: row.signupNote ?? "",
      },
      sponsors: row.sponsors ?? [],
      organizations,
      groups: (row.groups ?? []).map((group) => ({
        id: group.id,
        name: group.name,
        code: group.code,
        birthDateFrom: group.birthDateFrom ?? "",
        birthDateTo: group.birthDateTo ?? "",
        minimumAge: group.minimumAge,
        registrationFeeYuan: Number(group.registrationFeeCents ?? 0) / 100,
        registrationLimit: group.registrationLimit,
        mainDrawSize: group.mainDrawSize,
        status: group.status,
        ageRuleText: typeof ageRules[group.name] === "string" ? String(ageRules[group.name]) : "",
      })),
      memberIds: row.memberIds ?? [],
    },
    assignableAccounts: row.accounts ?? [],
  };
}
