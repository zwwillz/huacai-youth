import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "./index";
import {
  eventDetails,
  eventDocuments,
  eventGroups,
  eventGuides,
  eventOrganizations,
  eventPhases,
  eventSponsors,
  events,
  matches,
  players,
  registrations,
  venues,
} from "./schema";
import type {
  GroupName,
  PrizeMap,
  PublicGuide,
  PublicMatch,
  PublicParticipant,
  PublicPhase,
  PublicSiteData,
  PublicStation,
} from "@/app/public-types";

const STATUS_LABELS: Record<string, string> = {
  registration_open: "报名中",
  registration_closed: "报名结束",
  upcoming: "即将开始",
  published: "已公布",
  in_progress: "进行中",
  finished: "已结束",
  cancelled: "已取消",
};

const PHASE_STATUS_LABELS: Record<string, PublicPhase["status"]> = {
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

function chineseNumber(value: number) {
  const digits = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
  if (value < 10) return digits[value] ?? String(value);
  if (value === 10) return "十";
  if (value < 20) return `十${digits[value - 10]}`;
  const tens = Math.floor(value / 10);
  const ones = value % 10;
  if (value < 100) return `${digits[tens]}十${ones ? digits[ones] : ""}`;
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

function locationLabel(parts: Array<string | null | undefined>) {
  const values = parts.map((item) => item?.trim()).filter((item): item is string => Boolean(item));
  return [...new Set(values)].join("");
}

function rows(value: unknown): string[][] {
  if (!Array.isArray(value)) return [];
  return value.filter(Array.isArray).map((row) => row.map((cell) => String(cell ?? "")));
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function ageRules(value: unknown): Record<GroupName, string> {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    少年组: typeof source.少年组 === "string" ? source.少年组 : "待组委会更新",
    青年组: typeof source.青年组 === "string" ? source.青年组 : "待组委会更新",
  };
}

function prizeRules(value: unknown): PrizeMap {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return { 少年组: rows(source.少年组), 青年组: rows(source.青年组) };
}

function visualKey(slug: string, city: string) {
  for (const key of ["langfang", "taiyuan", "miyun"]) if (slug.includes(key)) return key;
  return shortCity(city).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-") || "generic";
}

export async function getPublicSiteData(): Promise<PublicSiteData> {
  const db = getDb();
  const eventRows = await db
    .select({
      id: events.id,
      slug: events.slug,
      year: events.year,
      stationNo: events.stationNo,
      fullTitle: events.fullTitle,
      city: events.city,
      startDate: events.startDate,
      endDate: events.endDate,
      summary: events.summary,
      status: events.status,
      venueName: venues.name,
      venueProvince: venues.province,
      venueCity: venues.city,
      venueDistrict: venues.district,
      venueAddress: venues.address,
    })
    .from(events)
    .leftJoin(venues, eq(events.venueId, venues.id))
    .where(eq(events.publishStatus, "published"))
    .orderBy(desc(events.year), desc(events.stationNo));

  const eventIds = eventRows.map((event) => event.id);
  if (!eventIds.length) return { stations: [], matches: [], participants: [], players: [] };

  const [detailRows, organizationRows, sponsorRows, documentRows, guideRows, groupRows, phaseRows, matchRows, participantRows] = await Promise.all([
    db.select().from(eventDetails).where(inArray(eventDetails.eventId, eventIds)),
    db.select().from(eventOrganizations).where(inArray(eventOrganizations.eventId, eventIds)).orderBy(asc(eventOrganizations.eventId), asc(eventOrganizations.sortOrder)),
    db.select().from(eventSponsors).where(and(inArray(eventSponsors.eventId, eventIds), eq(eventSponsors.isPublished, true))).orderBy(asc(eventSponsors.eventId), asc(eventSponsors.sortOrder)),
    db.select().from(eventDocuments).where(and(inArray(eventDocuments.eventId, eventIds), eq(eventDocuments.isPublished, true))),
    db.select().from(eventGuides).where(and(inArray(eventGuides.eventId, eventIds), eq(eventGuides.publishStatus, "published"))),
    db.select().from(eventGroups).where(and(inArray(eventGroups.eventId, eventIds), eq(eventGroups.status, "active"))).orderBy(asc(eventGroups.eventId), asc(eventGroups.code)),
    db.select().from(eventPhases).where(inArray(eventPhases.eventId, eventIds)).orderBy(asc(eventPhases.eventId), asc(eventPhases.sortOrder)),
    db.select({
      id: matches.id,
      eventId: matches.eventId,
      groupId: matches.groupId,
      phaseId: sql<string | null>`phase_id`,
      matchDate: matches.matchDate,
      matchTime: matches.matchTime,
      roundName: matches.roundName,
      progress: matches.progress,
      raceTo: matches.raceTo,
      orderNo: matches.orderNo,
      playerAName: matches.playerAName,
      playerBName: matches.playerBName,
      tableName: matches.tableName,
      isTv: matches.isTv,
      status: matches.status,
    }).from(matches).where(inArray(matches.eventId, eventIds)).orderBy(asc(matches.eventId), asc(matches.matchDate), asc(matches.matchTime), asc(matches.orderNo)),
    db.select({ eventId: registrations.eventId, groupId: registrations.groupId, playerId: players.id, playerName: players.fullName })
      .from(registrations)
      .innerJoin(players, eq(registrations.playerId, players.id))
      .where(and(inArray(registrations.eventId, eventIds), eq(registrations.status, "approved")))
      .orderBy(asc(players.fullName)),
  ]);

  const detailByEvent = new Map(detailRows.map((row) => [row.eventId, row]));
  const groupById = new Map(groupRows.map((row) => [row.id, row]));
  const phaseById = new Map(phaseRows.map((row) => [row.id, row]));

  const groupsByEvent = new Map<string, typeof groupRows>();
  for (const row of groupRows) groupsByEvent.set(row.eventId, [...(groupsByEvent.get(row.eventId) ?? []), row]);

  const phasesByEvent = new Map<string, typeof phaseRows>();
  for (const row of phaseRows) phasesByEvent.set(row.eventId, [...(phasesByEvent.get(row.eventId) ?? []), row]);

  const organizationsByEvent = new Map<string, string[][]>();
  for (const row of organizationRows) {
    const label = ORG_LABELS[row.organizationType] ?? row.organizationType;
    organizationsByEvent.set(row.eventId, [...(organizationsByEvent.get(row.eventId) ?? []), [label, row.organizationName]]);
  }

  const sponsorsByEvent = new Map<string, typeof sponsorRows>();
  for (const row of sponsorRows) sponsorsByEvent.set(row.eventId, [...(sponsorsByEvent.get(row.eventId) ?? []), row]);

  const documentsByEvent = new Map<string, typeof documentRows>();
  for (const row of documentRows) documentsByEvent.set(row.eventId, [...(documentsByEvent.get(row.eventId) ?? []), row]);

  const guidesByEvent = new Map<string, Partial<Record<"transport" | "clothing", PublicGuide>>>();
  for (const row of guideRows) {
    if (row.guideType !== "transport" && row.guideType !== "clothing") continue;
    const current = guidesByEvent.get(row.eventId) ?? {};
    current[row.guideType] = { title: row.title, body: row.body, fileUrl: row.fileKey, externalUrl: row.externalUrl };
    guidesByEvent.set(row.eventId, current);
  }

  const stations: PublicStation[] = eventRows.map((event) => {
    const detail = detailByEvent.get(event.id);
    const stationGroups = groupsByEvent.get(event.id) ?? [];
    const docs = documentsByEvent.get(event.id) ?? [];
    const sponsors = sponsorsByEvent.get(event.id) ?? [];
    const location = locationLabel([event.venueProvince, event.venueCity, event.venueDistrict]);
    const mainSizes = stationGroups.map((row) => row.mainDrawSize).filter((value): value is number => typeof value === "number");
    const derivedMainSize = mainSizes.length ? (new Set(mainSizes).size === 1 ? `每组${mainSizes[0]}人` : mainSizes.join(" / ")) : "待公布";
    const rulesDoc = docs.find((doc) => doc.documentType === "regulation");
    const refereeDoc = docs.find((doc) => doc.documentType === "referee_list");

    return {
      id: event.id,
      slug: event.slug,
      visualKey: visualKey(event.slug, event.city),
      year: event.year,
      stationNo: event.stationNo,
      stop: `第${chineseNumber(event.stationNo)}站`,
      city: `${event.city}站`,
      shortCity: shortCity(event.city),
      status: STATUS_LABELS[event.status] ?? event.status,
      active: !["finished", "cancelled"].includes(event.status),
      title: event.fullTitle,
      sponsor: detail?.sponsorLabel || sponsors[0]?.name || "",
      sponsorImage: sponsors.find((item) => item.logoKey)?.logoKey ?? null,
      date: formatRange(event.startDate, event.endDate),
      duration: detail?.durationLabel || "待公布",
      venue: event.venueName ? `${location || event.city} · ${event.venueName}` : event.city,
      venueDetail: event.venueAddress || (event.venueName ? `${location || event.city}${event.venueName}` : event.city),
      rulesPdf: rulesDoc?.externalUrl || rulesDoc?.fileKey || null,
      refereesPdf: refereeDoc?.externalUrl || refereeDoc?.fileKey || null,
      qualDate: detail?.qualifierDateLabel || "待公布",
      mainDate: detail?.mainDateLabel || "待公布",
      totalPrize: detail?.totalPrizeLabel || "待公布",
      mainSize: detail?.mainSizeLabel || derivedMainSize,
      intro: event.summary || "赛事详情待组委会更新。",
      organizers: organizationsByEvent.get(event.id) ?? [],
      age: ageRules(detail?.ageRules),
      minimumAge: detail?.minimumAgeNote || "参赛年龄与监护要求待组委会更新。",
      format: rows(detail?.competitionFormat),
      draw: strings(detail?.drawRules),
      signup: detail?.signupNote || "报名安排待组委会更新。",
      prizes: prizeRules(detail?.prizes),
      groups: stationGroups.map((row) => ({ id: row.id, name: row.name, code: row.code, mainDrawSize: row.mainDrawSize, registrationFeeCents: row.registrationFeeCents })),
      phases: (phasesByEvent.get(event.id) ?? []).map((row) => ({
        id: row.code,
        databaseId: row.id,
        number: row.phaseNumber?.trim() || String(row.sortOrder).padStart(2, "0"),
        title: row.title,
        date: row.dateLabel || "日期待公布",
        status: PHASE_STATUS_LABELS[row.status] ?? "待开始",
      })),
      guides: guidesByEvent.get(event.id) ?? {},
    };
  });

  const publicMatches: PublicMatch[] = matchRows.map((match) => ({
    id: match.id,
    eventId: match.eventId,
    phaseId: match.phaseId ? phaseById.get(match.phaseId)?.code ?? null : null,
    group: groupById.get(match.groupId)?.name ?? "未分组",
    date: match.matchDate,
    time: match.matchTime || "",
    round: match.roundName || "",
    progress: match.progress || "",
    race: match.raceTo || "",
    order: match.orderNo ?? 0,
    playerA: match.playerAName,
    playerB: match.playerBName,
    table: match.tableName || "球台待定",
    isTv: match.isTv,
    status: match.status,
  }));

  const participants: PublicParticipant[] = participantRows.map((row) => ({
    eventId: row.eventId,
    group: groupById.get(row.groupId)?.name ?? "未分组",
    playerId: row.playerId,
    playerName: row.playerName,
  }));

  const playerNames = [...new Set(participants.map((row) => row.playerName))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  return { stations, matches: publicMatches, participants, players: playerNames };
}
