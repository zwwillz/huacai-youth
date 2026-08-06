import { and, asc, eq } from "drizzle-orm";
import { getDb } from "./index";
import {
  auditLogs,
  eventDetails,
  eventGroups,
  eventMembers,
  eventOrganizations,
  eventSponsors,
  events,
  publications,
  users,
  venues,
} from "./schema";

const EVENT_STATUSES = ["draft", "registration_open", "registration_closed", "in_progress", "finished", "archived"] as const;
const PUBLISH_STATUSES = ["draft", "published"] as const;
const ORGANIZATION_TYPES = ["host", "support", "operator", "cooperator"] as const;

type EventStatus = (typeof EVENT_STATUSES)[number];
type PublishStatus = (typeof PUBLISH_STATUSES)[number];
type OrganizationType = (typeof ORGANIZATION_TYPES)[number];

export type ManagedEventGroup = {
  id: string;
  name: string;
  code: string;
  birthDateFrom: string;
  birthDateTo: string;
  minimumAge: number | null;
  registrationFeeYuan: number;
  registrationLimit: number | null;
  mainDrawSize: number | null;
  status: string;
  ageRuleText: string;
};

export type ManagedEventSponsor = {
  id: string;
  name: string;
  sponsorType: string;
  logoKey: string;
  websiteUrl: string;
  sortOrder: number;
  isPublished: boolean;
};

export type EventManagementData = {
  viewerRole: string;
  publicationStatuses: Record<string, string>;
  event: {
    id: string;
    year: number;
    stationNo: number;
    fullTitle: string;
    shortTitle: string;
    slug: string;
    city: string;
    startDate: string;
    endDate: string;
    registrationStartAt: string;
    registrationEndAt: string;
    coverImageKey: string;
    summary: string;
    status: string;
    publishStatus: string;
    venue: {
      id: string | null;
      name: string;
      province: string;
      city: string;
      district: string;
      address: string;
      tableCount: number;
    };
    details: {
      sponsorLabel: string;
      durationLabel: string;
      qualifierDateLabel: string;
      mainDateLabel: string;
      totalPrizeLabel: string;
      mainSizeLabel: string;
      minimumAgeNote: string;
      signupNote: string;
    };
    sponsors: ManagedEventSponsor[];
    organizations: Record<OrganizationType, string>;
    groups: ManagedEventGroup[];
    memberIds: string[];
  };
  assignableAccounts: Array<{
    id: string;
    username: string;
    displayName: string;
    role: string;
    status: string;
  }>;
};

export type EventManagementInput = {
  eventId: string;
  year: number;
  stationNo: number;
  fullTitle: string;
  shortTitle: string;
  city: string;
  startDate: string;
  endDate: string;
  registrationStartAt?: string;
  registrationEndAt?: string;
  coverImageKey?: string;
  summary?: string;
  status: EventStatus;
  publishStatus: PublishStatus;
  venue: {
    name: string;
    province?: string;
    city?: string;
    district?: string;
    address?: string;
    tableCount?: number;
  };
  details: {
    sponsorLabel?: string;
    durationLabel?: string;
    qualifierDateLabel?: string;
    mainDateLabel?: string;
    totalPrizeLabel?: string;
    mainSizeLabel?: string;
    minimumAgeNote?: string;
    signupNote?: string;
  };
  sponsors?: Array<{
    id?: string;
    name: string;
    sponsorType: string;
    logoKey?: string;
    websiteUrl?: string;
    sortOrder?: number;
    isPublished: boolean;
  }>;
  organizations: Record<OrganizationType, string>;
  groups: Array<{
    id: string;
    name: string;
    code: string;
    birthDateFrom?: string;
    birthDateTo?: string;
    minimumAge?: number | null;
    registrationFeeYuan: number;
    registrationLimit?: number | null;
    mainDrawSize?: number | null;
    status: string;
    ageRuleText?: string;
  }>;
  memberIds?: string[];
};

function now() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return prefix + "_" + crypto.randomUUID().replaceAll("-", "");
}

function clean(value: string | null | undefined) {
  const next = value?.trim();
  return next ? next : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function requireEventEditor(username: string) {
  const db = getDb();
  const [account] = await db.select().from(users).where(and(eq(users.username, username), eq(users.status, "active"))).limit(1);
  if (!account || !["system_admin", "committee"].includes(account.role)) {
    throw new Error("当前账号没有编辑赛事资料的权限。");
  }
  return account;
}

export async function getEventManagementData(username: string, eventId: string): Promise<EventManagementData> {
  const db = getDb();
  const account = await requireEventEditor(username);
  const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!event) throw new Error("没有找到这场赛事。");

  const [venue, details, groups, organizations, members, sponsors, publicationRows, accounts] = await Promise.all([
    event.venueId ? db.select().from(venues).where(eq(venues.id, event.venueId)).limit(1).then((rows) => rows[0] ?? null) : Promise.resolve(null),
    db.select().from(eventDetails).where(eq(eventDetails.eventId, eventId)).limit(1).then((rows) => rows[0] ?? null),
    db.select().from(eventGroups).where(eq(eventGroups.eventId, eventId)).orderBy(asc(eventGroups.code)),
    db.select().from(eventOrganizations).where(eq(eventOrganizations.eventId, eventId)).orderBy(asc(eventOrganizations.sortOrder)),
    db.select().from(eventMembers).where(eq(eventMembers.eventId, eventId)),
    db.select().from(eventSponsors).where(eq(eventSponsors.eventId, eventId)).orderBy(asc(eventSponsors.sortOrder)),
    db.select({ moduleType: publications.moduleType, status: publications.status }).from(publications).where(eq(publications.eventId, eventId)),
    account.role === "system_admin"
      ? db.select({ id: users.id, username: users.username, displayName: users.displayName, role: users.role, status: users.status }).from(users).orderBy(asc(users.displayName))
      : Promise.resolve([]),
  ]);

  const ageRules = asRecord(details?.ageRules);
  const organizationMap: Record<OrganizationType, string> = { host: "", support: "", operator: "", cooperator: "" };
  for (const row of organizations) {
    if (ORGANIZATION_TYPES.includes(row.organizationType as OrganizationType)) {
      organizationMap[row.organizationType as OrganizationType] = row.organizationName;
    }
  }

  return {
    viewerRole: account.role,
    publicationStatuses: Object.fromEntries(publicationRows.map((row) => [row.moduleType, row.status])),
    event: {
      id: event.id,
      year: event.year,
      stationNo: event.stationNo,
      fullTitle: event.fullTitle,
      shortTitle: event.shortTitle,
      slug: event.slug,
      city: event.city,
      startDate: event.startDate,
      endDate: event.endDate,
      registrationStartAt: event.registrationStartAt ?? "",
      registrationEndAt: event.registrationEndAt ?? "",
      coverImageKey: event.coverImageKey ?? "",
      summary: event.summary ?? "",
      status: event.status,
      publishStatus: event.publishStatus,
      venue: {
        id: venue?.id ?? null,
        name: venue?.name ?? "",
        province: venue?.province ?? "",
        city: venue?.city ?? "",
        district: venue?.district ?? "",
        address: venue?.address ?? "",
        tableCount: venue?.tableCount ?? 0,
      },
      details: {
        sponsorLabel: details?.sponsorLabel ?? "",
        durationLabel: details?.durationLabel ?? "",
        qualifierDateLabel: details?.qualifierDateLabel ?? "",
        mainDateLabel: details?.mainDateLabel ?? "",
        totalPrizeLabel: details?.totalPrizeLabel ?? "",
        mainSizeLabel: details?.mainSizeLabel ?? "",
        minimumAgeNote: details?.minimumAgeNote ?? "",
        signupNote: details?.signupNote ?? "",
      },
      sponsors: sponsors.map((sponsor) => ({
        id: sponsor.id,
        name: sponsor.name,
        sponsorType: sponsor.sponsorType,
        logoKey: sponsor.logoKey ?? "",
        websiteUrl: sponsor.websiteUrl ?? "",
        sortOrder: sponsor.sortOrder,
        isPublished: sponsor.isPublished,
      })),
      organizations: organizationMap,
      groups: groups.map((group) => ({
        id: group.id,
        name: group.name,
        code: group.code,
        birthDateFrom: group.birthDateFrom ?? "",
        birthDateTo: group.birthDateTo ?? "",
        minimumAge: group.minimumAge,
        registrationFeeYuan: group.registrationFeeCents / 100,
        registrationLimit: group.registrationLimit,
        mainDrawSize: group.mainDrawSize,
        status: group.status,
        ageRuleText: typeof ageRules[group.name] === "string" ? String(ageRules[group.name]) : "",
      })),
      memberIds: members.filter((member) => member.status === "active").map((member) => member.userId),
    },
    assignableAccounts: accounts.filter((row) => row.role === "committee" || row.role === "referee"),
  };
}

function validateInput(input: EventManagementInput) {
  if (!input.eventId) throw new Error("缺少赛事ID。");
  if (!input.fullTitle?.trim() || !input.shortTitle?.trim() || !input.city?.trim()) throw new Error("请填写赛事名称和城市。");
  if (!input.startDate || !input.endDate) throw new Error("请填写比赛开始和结束日期。");
  if (input.startDate > input.endDate) throw new Error("比赛结束日期不能早于开始日期。");
  if (input.registrationStartAt && input.registrationEndAt && input.registrationStartAt > input.registrationEndAt) throw new Error("报名截止时间不能早于报名开始时间。");
  if (!EVENT_STATUSES.includes(input.status)) throw new Error("赛事状态不正确。");
  if (!PUBLISH_STATUSES.includes(input.publishStatus)) throw new Error("前端发布状态不正确。");
  if (!Number.isInteger(Number(input.year)) || Number(input.year) < 2025 || Number(input.year) > 2100) throw new Error("赛季年份不正确。");
  if (!Number.isInteger(Number(input.stationNo)) || Number(input.stationNo) < 1) throw new Error("分站序号不正确。");
  if (!input.venue?.name?.trim()) throw new Error("请填写比赛场馆名称。");
  for (const group of input.groups ?? []) {
    if (!group.id || !group.name?.trim() || !group.code?.trim()) throw new Error("组别资料不完整。");
    if (Number(group.registrationFeeYuan) < 0) throw new Error("报名费不能小于0。");
    if (group.mainDrawSize != null && Number(group.mainDrawSize) < 1) throw new Error("正赛人数必须大于0。");
    if (group.registrationLimit != null && Number(group.registrationLimit) < 1) throw new Error("报名人数上限必须大于0。");
  }
  for (const sponsor of input.sponsors ?? []) {
    if (sponsor.logoKey?.trim() && !sponsor.name?.trim()) throw new Error("填写赞助商Logo时，请同时填写赞助商名称。");
    if (sponsor.isPublished && sponsor.name?.trim() && !sponsor.logoKey?.trim()) throw new Error(`“${sponsor.name.trim()}”已设为前端展示，请补充Logo图片地址。`);
  }
}

export async function saveEventManagementData(username: string, input: EventManagementInput) {
  validateInput(input);
  const db = getDb();
  const account = await requireEventEditor(username);
  const [beforeEvent] = await db.select().from(events).where(eq(events.id, input.eventId)).limit(1);
  if (!beforeEvent) throw new Error("没有找到要修改的赛事。");

  const updatedAt = now();
  let venueId = beforeEvent.venueId;

  await db.transaction(async (tx) => {
    if (venueId) {
      await tx.update(venues).set({
        name: input.venue.name.trim(),
        province: clean(input.venue.province),
        city: clean(input.venue.city) ?? input.city.trim(),
        district: clean(input.venue.district),
        address: clean(input.venue.address),
        tableCount: Math.max(0, Number(input.venue.tableCount ?? 0)),
        updatedAt,
      }).where(eq(venues.id, venueId));
    } else {
      venueId = id("venue");
      await tx.insert(venues).values({
        id: venueId,
        name: input.venue.name.trim(),
        province: clean(input.venue.province),
        city: clean(input.venue.city) ?? input.city.trim(),
        district: clean(input.venue.district),
        address: clean(input.venue.address),
        tableCount: Math.max(0, Number(input.venue.tableCount ?? 0)),
        createdAt: updatedAt,
        updatedAt,
      });
    }

    await tx.update(events).set({
      year: Number(input.year),
      stationNo: Number(input.stationNo),
      fullTitle: input.fullTitle.trim(),
      shortTitle: input.shortTitle.trim(),
      city: input.city.trim(),
      venueId,
      startDate: input.startDate,
      endDate: input.endDate,
      registrationStartAt: clean(input.registrationStartAt),
      registrationEndAt: clean(input.registrationEndAt),
      coverImageKey: clean(input.coverImageKey),
      summary: clean(input.summary),
      status: input.status,
      publishStatus: input.publishStatus,
      publishedAt: input.publishStatus === "published" ? beforeEvent.publishedAt ?? updatedAt : null,
      updatedBy: account.id,
      updatedAt,
    }).where(eq(events.id, input.eventId));

    const ageRules = Object.fromEntries((input.groups ?? []).map((group) => [group.name.trim(), group.ageRuleText?.trim() ?? ""]));
    await tx.insert(eventDetails).values({
      eventId: input.eventId,
      sponsorLabel: clean(input.details.sponsorLabel),
      durationLabel: clean(input.details.durationLabel),
      qualifierDateLabel: clean(input.details.qualifierDateLabel),
      mainDateLabel: clean(input.details.mainDateLabel),
      totalPrizeLabel: clean(input.details.totalPrizeLabel),
      mainSizeLabel: clean(input.details.mainSizeLabel),
      minimumAgeNote: clean(input.details.minimumAgeNote),
      signupNote: clean(input.details.signupNote),
      ageRules,
      competitionFormat: [],
      drawRules: [],
      prizes: {},
      createdAt: updatedAt,
      updatedAt,
    }).onConflictDoUpdate({
      target: eventDetails.eventId,
      set: {
        sponsorLabel: clean(input.details.sponsorLabel),
        durationLabel: clean(input.details.durationLabel),
        qualifierDateLabel: clean(input.details.qualifierDateLabel),
        mainDateLabel: clean(input.details.mainDateLabel),
        totalPrizeLabel: clean(input.details.totalPrizeLabel),
        mainSizeLabel: clean(input.details.mainSizeLabel),
        minimumAgeNote: clean(input.details.minimumAgeNote),
        signupNote: clean(input.details.signupNote),
        ageRules,
        updatedAt,
      },
    });

    for (const group of input.groups ?? []) {
      await tx.update(eventGroups).set({
        name: group.name.trim(),
        code: group.code.trim(),
        birthDateFrom: clean(group.birthDateFrom),
        birthDateTo: clean(group.birthDateTo),
        minimumAge: group.minimumAge == null || Number.isNaN(Number(group.minimumAge)) ? null : Number(group.minimumAge),
        registrationFeeCents: Math.round(Number(group.registrationFeeYuan || 0) * 100),
        registrationLimit: group.registrationLimit == null || Number.isNaN(Number(group.registrationLimit)) ? null : Number(group.registrationLimit),
        mainDrawSize: group.mainDrawSize == null || Number.isNaN(Number(group.mainDrawSize)) ? null : Number(group.mainDrawSize),
        status: group.status || "active",
        updatedAt,
      }).where(and(eq(eventGroups.id, group.id), eq(eventGroups.eventId, input.eventId)));
    }

    await tx.delete(eventOrganizations).where(eq(eventOrganizations.eventId, input.eventId));
    const organizationRows = ORGANIZATION_TYPES
      .map((type, index) => ({ type, value: input.organizations?.[type]?.trim() ?? "", index }))
      .filter((row) => row.value);
    if (organizationRows.length) {
      await tx.insert(eventOrganizations).values(organizationRows.map((row) => ({
        id: id("org"),
        eventId: input.eventId,
        organizationType: row.type,
        organizationName: row.value,
        sortOrder: row.index + 1,
        createdAt: updatedAt,
        updatedAt,
      })));
    }

    await tx.delete(eventSponsors).where(eq(eventSponsors.eventId, input.eventId));
    const sponsorRows = (input.sponsors ?? [])
      .map((sponsor, index) => ({ ...sponsor, name: sponsor.name?.trim() ?? "", index }))
      .filter((sponsor) => sponsor.name);
    if (sponsorRows.length) {
      await tx.insert(eventSponsors).values(sponsorRows.map((sponsor) => ({
        id: id("sponsor"),
        eventId: input.eventId,
        name: sponsor.name,
        sponsorType: sponsor.sponsorType?.trim() || "sponsor",
        logoKey: clean(sponsor.logoKey),
        websiteUrl: clean(sponsor.websiteUrl),
        sortOrder: sponsor.index + 1,
        isPublished: Boolean(sponsor.isPublished),
        createdAt: updatedAt,
        updatedAt,
      })));
    }

    if (account.role === "system_admin") {
      const requestedIds = [...new Set((input.memberIds ?? []).filter(Boolean))];
      await tx.delete(eventMembers).where(eq(eventMembers.eventId, input.eventId));
      if (requestedIds.length) {
        const eligibleAccounts = await tx.select({ id: users.id, role: users.role, status: users.status }).from(users);
        const allowed = new Map(eligibleAccounts.filter((row) => row.status === "active" && (row.role === "committee" || row.role === "referee")).map((row) => [row.id, row.role]));
        const rows = requestedIds.filter((userId) => allowed.has(userId)).map((userId) => ({
          id: id("member"),
          eventId: input.eventId,
          userId,
          role: allowed.get(userId) ?? "committee",
          status: "active",
          createdAt: updatedAt,
          updatedAt,
        }));
        if (rows.length) await tx.insert(eventMembers).values(rows);
      }
    }

    await tx.insert(auditLogs).values({
      id: id("log"),
      actorUserId: account.id,
      eventId: input.eventId,
      moduleType: "events",
      targetType: "event_management",
      targetId: input.eventId,
      action: "update",
      beforeJson: JSON.stringify({ fullTitle: beforeEvent.fullTitle, status: beforeEvent.status, publishStatus: beforeEvent.publishStatus, coverImageKey: beforeEvent.coverImageKey }),
      afterJson: JSON.stringify({ fullTitle: input.fullTitle.trim(), status: input.status, publishStatus: input.publishStatus, coverImageKey: clean(input.coverImageKey), sponsorCount: sponsorRows.length }),
      createdAt: updatedAt,
    });
  });

  return getEventManagementData(username, input.eventId);
}
