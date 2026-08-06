import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "./index";
import {
  eventDetails,
  eventDocuments,
  eventGroups,
  eventOrganizations,
  eventPhases,
  eventSponsors,
  events,
  matches,
  players,
  registrations,
  venues,
} from "./schema";
import type { EventData, Group, Match, Phase, PhaseId, PrizeMap, Station } from "@/app/public-types";

const GROUPS: Group[] = ["少年组", "青年组"];
const PHASE_IDS: PhaseId[] = ["qualifier-one", "qualifier-two", "main-one", "main-two"];

const EVENT_STATUS: Record<string, string> = {
  registration_open: "报名中",
  registration_closed: "报名结束",
  upcoming: "即将开始",
  in_progress: "进行中",
  finished: "已结束",
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

function noZeroDate(value: string) {
  const [y, m, d] = value.split("-");
  return y && m && d ? `${y}-${Number(m)}-${Number(d)}` : value;
}

function locationPrefix(parts: Array<string | null | undefined>) {
  const values = parts.map((item) => item?.trim()).filter((item): item is string => Boolean(item));
  return [...new Set(values)].join("");
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
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

export async function getPublicSiteData(): Promise<EventData> {
  const db = getDb();

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
    .where(eq(events.publishStatus, "published"))
    .orderBy(desc(events.year), desc(events.stationNo));

  if (!eventRows.length) return { stations: [], matches: [], players: [] };
  const eventIds = eventRows.map((row) => row.id);

  const [orgRows, sponsorRows, documentRows, phaseRows, groupRows, matchRows, registrationRows] = await Promise.all([
    db.select().from(eventOrganizations).where(inArray(eventOrganizations.eventId, eventIds)).orderBy(asc(eventOrganizations.sortOrder)),
    db.select().from(eventSponsors).where(inArray(eventSponsors.eventId, eventIds)).orderBy(asc(eventSponsors.sortOrder)),
    db.select().from(eventDocuments).where(inArray(eventDocuments.eventId, eventIds)),
    db.select().from(eventPhases).where(inArray(eventPhases.eventId, eventIds)).orderBy(asc(eventPhases.sortOrder)),
    db.select().from(eventGroups).where(inArray(eventGroups.eventId, eventIds)),
    db.select({
      id: matches.id,
      eventId: matches.eventId,
      groupId: matches.groupId,
      phaseId: sql<string | null>`"matches"."phase_id"`,
      date: matches.matchDate,
      time: matches.matchTime,
      round: matches.roundName,
      progress: matches.progress,
      race: matches.raceTo,
      order: matches.orderNo,
      playerA: matches.playerAName,
      playerB: matches.playerBName,
      table: matches.tableName,
      isTv: matches.isTv,
      status: matches.status,
    }).from(matches).where(inArray(matches.eventId, eventIds)).orderBy(asc(matches.matchDate), asc(matches.matchTime), asc(matches.orderNo)),
    db.select({ eventId: registrations.eventId, groupId: registrations.groupId, playerId: registrations.playerId, playerName: players.fullName })
      .from(registrations)
      .innerJoin(players, eq(registrations.playerId, players.id))
      .where(inArray(registrations.eventId, eventIds)),
  ]);

  const groupById = new Map(groupRows.map((row) => [row.id, row.name as Group]));
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

  const sponsorsByEvent = new Map<string, string[]>();
  for (const row of sponsorRows) {
    if (!row.isPublished) continue;
    const current = sponsorsByEvent.get(row.eventId) ?? [];
    current.push(row.name);
    sponsorsByEvent.set(row.eventId, current);
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
    if (!format.length) format.push(["待公布", "待公布", "待公布", "待公布"]);
    for (const group of GROUPS) if (!prizes[group].length) prizes[group] = [["冠军", "待公布"]];
    return {
      eventId: row.id,
      year: row.year,
      id,
      stop: `第${chineseNumber(row.stationNo)}站`,
      city: `${row.city}站`,
      shortCity: shortCity(row.city),
      status: EVENT_STATUS[row.status] ?? row.status,
      active: index === 0,
      title: row.title,
      sponsor: row.sponsorLabel || (sponsorsByEvent.get(row.id) ?? []).join(" · ") || "赛事信息待公布",
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
    };
  });

  const publicMatches: Match[] = matchRows.flatMap((row) => {
    const group = groupById.get(row.groupId);
    if (!group || !GROUPS.includes(group)) return [];
    return [{
      id: row.id,
      eventId: row.eventId,
      phaseId: row.phaseId ? phaseId(row.phaseId) : null,
      group,
      date: noZeroDate(row.date),
      time: row.time ?? "",
      round: row.round ?? "",
      progress: row.progress ?? "",
      race: row.race ?? "",
      order: row.order ?? 0,
      playerA: row.playerA,
      playerB: row.playerB,
      table: row.table ?? "",
      isTv: row.isTv,
      status: row.status,
    }];
  });

  const langfang = stations.find((station) => station.id === "langfang") ?? stations.find((station) => publicMatches.some((match) => match.eventId === station.eventId));
  const youthGroupId = langfang ? groupRows.find((group) => group.eventId === langfang.eventId && group.name === "少年组")?.id : undefined;
  const youthPlayers = youthGroupId
    ? [...new Set(registrationRows.filter((row) => row.eventId === langfang?.eventId && row.groupId === youthGroupId).map((row) => row.playerName))].sort((a, b) => a.localeCompare(b, "zh-CN"))
    : [];

  return { stations, matches: publicMatches, players: youthPlayers };
}
