import { and, asc, desc, eq, inArray, sql as drizzleSql } from "drizzle-orm";
import { getDb, getSqlClient } from "./index";
import {
  eventDetails,
  eventDocuments,
  eventGroups,
  eventOrganizations,
  eventPhases,
  eventSponsors,
  events,
  venues,
} from "./schema";
import type { EventData, Group, Phase, PhaseId, PrizeMap, Station } from "@/app/public-types";

const GROUPS: Group[] = ["少年组", "青年组"];
const PHASE_IDS: PhaseId[] = ["qualifier-one", "qualifier-two", "main-one", "main-two"];

const EVENT_STATUS: Record<string, string> = {
  draft: "筹备中",
  registration_open: "报名中",
  registration_closed: "报名结束",
  upcoming: "即将开始",
  in_progress: "进行中",
  finished: "已结束",
  archived: "已结束",
  cancelled: "已取消",
};

const PHASE_STATUS: Record<string, Phase["status"]> = {
  pending: "待开始",
  upcoming: "待开始",
  in_progress: "进行中",
  finished: "已结束",
};

const ORG_LABELS: Record<string, string> = {
  host: "主办单位",
  support: "支持单位",
  operator: "承办单位",
  cooperator: "协办单位",
};

function visualId(eventId: string) {
  return eventId.replace(/^event_/, "").replace(/_\d{4}$/, "");
}

function chineseNumber(value: number) {
  const digits = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
  if (value < 10) return digits[value] ?? String(value);
  if (value === 10) return "十";
  if (value < 20) return `十${digits[value - 10]}`;
  if (value < 100) {
    const tens = Math.floor(value / 10);
    const ones = value % 10;
    return `${digits[tens]}十${ones ? digits[ones] : ""}`;
  }
  return String(value);
}

function shortCity(value: string) {
  const result = value
    .replace(/^(北京市|天津市|上海市|重庆市)/, "")
    .replace(/^(河北|山西|山东|河南|辽宁|吉林|黑龙江|江苏|浙江|安徽|福建|江西|湖北|湖南|广东|海南|四川|贵州|云南|陕西|甘肃|青海|台湾|内蒙古|广西|西藏|宁夏|新疆|香港|澳门)/, "")
    .replace(/市$/, "");
  return result || value.replace(/市$/, "");
}

function formatRange(start: string, end: string) {
  const [sy, sm, sd] = start.split("-");
  const [ey, em, ed] = end.split("-");
  if (!sy || !sm || !sd || !ey || !em || !ed) return [start, end].filter(Boolean).join("—");
  return sy === ey ? `${sy}.${sm}.${sd}—${em}.${ed}` : `${sy}.${sm}.${sd}—${ey}.${em}.${ed}`;
}

function locationPrefix(parts: Array<string | null | undefined>) {
  const values = parts.map((item) => item?.trim()).filter((item): item is string => Boolean(item));
  return [...new Set(values)].join("");
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && !item.startsWith("@@rule-standard:") && !item.startsWith("@@prize-note:"))
    : [];
}

function asStringRows(value: unknown): string[][] {
  return Array.isArray(value)
    ? value.map((row) => Array.isArray(row) ? row.map((item) => String(item)) : []).filter((row) => row.length > 0)
    : [];
}

function asPrizeMap(value: unknown): PrizeMap {
  const empty: PrizeMap = { 少年组: [], 青年组: [] };
  if (!value || typeof value !== "object" || Array.isArray(value)) return empty;
  const record = value as Record<string, unknown>;
  for (const group of GROUPS) empty[group] = asStringRows(record[group]);
  return empty;
}

function phaseId(value: string): PhaseId | null {
  return PHASE_IDS.includes(value as PhaseId) ? value as PhaseId : null;
}

export async function getPublishedEventIds(): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.publishStatus, "published"), drizzleSql`coalesce(is_hidden, false) = false`))
    .orderBy(desc(events.year), desc(events.stationNo));
  return rows.map((row) => row.id);
}

export async function getPublicSiteData(): Promise<EventData> {
  const db = getDb();
  const sql = getSqlClient();

  const eventRows = await db
    .select({
      id: events.id,
      year: events.year,
      stationNo: events.stationNo,
      title: events.fullTitle,
      shortTitle: events.shortTitle,
      city: events.city,
      startDate: events.startDate,
      endDate: events.endDate,
      coverImage: events.coverImageKey,
      summary: events.summary,
      status: events.status,
      venueName: venues.name,
      venueProvince: venues.province,
      venueCity: venues.city,
      venueDistrict: venues.district,
      venueAddress: venues.address,
      sponsorLabel: eventDetails.sponsorLabel,
      durationLabel: eventDetails.durationLabel,
      qualifierDateLabel: eventDetails.qualifierDateLabel,
      mainDateLabel: eventDetails.mainDateLabel,
      totalPrizeLabel: eventDetails.totalPrizeLabel,
      mainSizeLabel: eventDetails.mainSizeLabel,
      minimumAgeNote: eventDetails.minimumAgeNote,
      signupNote: eventDetails.signupNote,
      ageRules: eventDetails.ageRules,
      competitionFormat: eventDetails.competitionFormat,
      drawRules: eventDetails.drawRules,
      prizes: eventDetails.prizes,
    })
    .from(events)
    .leftJoin(venues, eq(events.venueId, venues.id))
    .leftJoin(eventDetails, eq(events.id, eventDetails.eventId))
    .where(and(eq(events.publishStatus, "published"), drizzleSql`coalesce(is_hidden, false) = false`))
    .orderBy(desc(events.year), desc(events.stationNo));

  if (!eventRows.length) return { stations: [], matches: [], players: [] };
  const eventIds = eventRows.map((row) => row.id);
  const legacyEventId = eventRows.find((row) => visualId(row.id) === "langfang")?.id ?? eventIds[0];

  const [orgRows, sponsorRows, documentRows, phaseRows, groupRows, [publicCounts]] = await Promise.all([
    db.select().from(eventOrganizations).where(inArray(eventOrganizations.eventId, eventIds)).orderBy(asc(eventOrganizations.sortOrder)),
    db.select().from(eventSponsors).where(inArray(eventSponsors.eventId, eventIds)).orderBy(asc(eventSponsors.sortOrder)),
    db.select().from(eventDocuments).where(inArray(eventDocuments.eventId, eventIds)),
    db.select().from(eventPhases).where(inArray(eventPhases.eventId, eventIds)).orderBy(asc(eventPhases.sortOrder)),
    db.select({
      eventId: eventGroups.eventId,
      name: eventGroups.name,
      mainDrawSize: eventGroups.mainDrawSize,
      registrationFeeCents: eventGroups.registrationFeeCents,
      status: eventGroups.status,
    }).from(eventGroups).where(inArray(eventGroups.eventId, eventIds)),
    sql<Array<{ playerCount: number; matchCount: number }>>`
      select
        (select count(distinct r.player_id)::int
         from public.registrations r
         join public.event_groups g on g.id = r.group_id
         where r.event_id = ${legacyEventId} and g.name = '少年组' and r.status <> 'withdrawn') as "playerCount",
        (select count(*)::int
         from public.matches m
         join public.event_groups g on g.id = m.group_id
         where m.event_id = ${legacyEventId} and g.name = '少年组') as "matchCount"
    `,
  ]);

  const phasesByEvent = new Map<string, Phase[]>();
  for (const row of phaseRows) {
    const id = phaseId(row.code);
    if (!id) continue;
    const current = phasesByEvent.get(row.eventId) ?? [];
    current.push({ id, number: row.phaseNumber ?? String(current.length + 1).padStart(2, "0"), title: row.title, date: row.dateLabel ?? "待公布", status: PHASE_STATUS[row.status] ?? "待开始" });
    phasesByEvent.set(row.eventId, current);
  }

  const organizationsByEvent = new Map<string, string[][]>();
  for (const row of orgRows) {
    const current = organizationsByEvent.get(row.eventId) ?? [];
    current.push([ORG_LABELS[row.organizationType] ?? row.organizationType, row.organizationName]);
    organizationsByEvent.set(row.eventId, current);
  }

  const sponsorsByEvent = new Map<string, NonNullable<Station["partners"]>>();
  for (const row of sponsorRows) {
    if (!row.isPublished) continue;
    const current = sponsorsByEvent.get(row.eventId) ?? [];
    current.push({
      name: row.name,
      type: row.sponsorType,
      logo: row.logoKey ?? "",
      website: row.websiteUrl ?? "",
    });
    sponsorsByEvent.set(row.eventId, current);
  }

  const groupDetailsByEvent = new Map<string, NonNullable<Station["groupDetails"]>>();
  for (const row of groupRows) {
    if (row.status !== "active" || !GROUPS.includes(row.name as Group)) continue;
    const current = groupDetailsByEvent.get(row.eventId) ?? {};
    current[row.name as Group] = {
      mainDrawSize: row.mainDrawSize ?? null,
      registrationFeeCents: row.registrationFeeCents ?? null,
    };
    groupDetailsByEvent.set(row.eventId, current);
  }

  const docsByEvent = new Map<string, Record<string, string>>();
  for (const row of documentRows) {
    if (!row.isPublished) continue;
    const current = docsByEvent.get(row.eventId) ?? {};
    current[row.documentType] = row.externalUrl || row.fileKey || "";
    docsByEvent.set(row.eventId, current);
  }

  const stations: Station[] = eventRows.map((row, index) => {
    const id = visualId(row.id);
    const docs = docsByEvent.get(row.id) ?? {};
    const ageRecord = row.ageRules && typeof row.ageRules === "object" && !Array.isArray(row.ageRules) ? row.ageRules as Record<string, unknown> : {};
    const prefix = locationPrefix([row.venueProvince, row.venueCity, row.venueDistrict]);
    const venuePrefix = row.venueDistrict?.includes("/") ? row.city : prefix;
    const format = asStringRows(row.competitionFormat);
    const prizes = asPrizeMap(row.prizes);
    const partners = sponsorsByEvent.get(row.id) ?? [];
    if (!format.length) format.push(["待公布", "待公布", "待公布", "待公布"]);
    for (const group of GROUPS) if (!prizes[group].length) prizes[group] = [["冠军", "待公布"]];
    return {
      eventId: row.id,
      year: row.year,
      id,
      stop: `第${chineseNumber(row.stationNo)}站`,
      city: `${row.city}站`,
      shortCity: shortCity(row.city),
      status: EVENT_STATUS[row.status] ?? "状态待确认",
      active: index === 0,
      title: row.title,
      sponsor: row.sponsorLabel || partners.map((item) => item.name).join(" · ") || "赛事信息待公布",
      coverImage: row.coverImage || "",
      date: formatRange(row.startDate, row.endDate),
      duration: row.durationLabel || "待公布",
      venue: [venuePrefix, row.venueName].filter(Boolean).join(" · "),
      venueDetail: row.venueAddress || [prefix, row.venueName].filter(Boolean).join(" · "),
      rulesPdf: docs.regulation || "#",
      refereesPdf: docs.referee_list || "#",
      qualDate: row.qualifierDateLabel || "待公布",
      mainDate: row.mainDateLabel || "待公布",
      totalPrize: row.totalPrizeLabel || "待公布",
      mainSize: row.mainSizeLabel || "待公布",
      intro: row.summary || "赛事信息待组委会更新。",
      organizers: organizationsByEvent.get(row.id) ?? [],
      age: {
        少年组: typeof ageRecord.少年组 === "string" ? ageRecord.少年组 : "待公布",
        青年组: typeof ageRecord.青年组 === "string" ? ageRecord.青年组 : "待公布",
      },
      minimumAge: row.minimumAgeNote || "参赛资格以组委会正式规程为准。",
      format,
      draw: asStringArray(row.drawRules),
      signup: row.signupNote || "报名信息待组委会发布。",
      prizes,
      phases: phasesByEvent.get(row.id) ?? [],
      groupDetails: groupDetailsByEvent.get(row.id),
      partners,
      publicPlayerCount: id === "langfang" ? Number(publicCounts?.playerCount) || 0 : undefined,
      publicMatchCount: id === "langfang" ? Number(publicCounts?.matchCount) || 0 : undefined,
    };
  });

  // The full player and match collections are loaded from their dedicated,
  // cacheable public endpoints. Keeping them out of the initial RSC payload
  // prevents thousands of records from blocking first-page hydration.
  return { stations, matches: [], players: [] };
}
