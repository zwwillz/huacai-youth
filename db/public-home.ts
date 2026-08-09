import { and, desc, eq, sql } from "drizzle-orm";
import type { EventData, Station } from "@/app/public-types";
import { getDb } from "./index";
import { events, venues } from "./schema";

const EVENT_STATUS: Record<string, string> = {
  registration_open: "报名中",
  registration_closed: "报名结束",
  upcoming: "即将开始",
  in_progress: "进行中",
  finished: "已结束",
  cancelled: "已取消",
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

function loadingStation(row: {
  id: string;
  year: number;
  stationNo: number;
  title: string;
  city: string;
  startDate: string;
  endDate: string;
  coverImage: string | null;
  summary: string | null;
  status: string;
  venueName: string | null;
  venueProvince: string | null;
  venueCity: string | null;
  venueDistrict: string | null;
  venueAddress: string | null;
}, index: number): Station {
  const id = visualId(row.id);
  const prefix = locationPrefix([row.venueProvince, row.venueCity, row.venueDistrict]);
  const venuePrefix = row.venueDistrict?.includes("/") ? row.city : prefix;
  const detailLoading = "详情加载中";
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
    sponsor: "中国华彩十六球青少年系列赛",
    coverImage: row.coverImage || "",
    date: formatRange(row.startDate, row.endDate),
    duration: detailLoading,
    venue: [venuePrefix, row.venueName].filter(Boolean).join(" · "),
    venueDetail: row.venueAddress || [prefix, row.venueName].filter(Boolean).join(" · "),
    rulesPdf: "#",
    refereesPdf: "#",
    qualDate: detailLoading,
    mainDate: detailLoading,
    totalPrize: detailLoading,
    mainSize: detailLoading,
    intro: row.summary || "赛事详情正在后台加载。",
    organizers: [],
    age: { 少年组: detailLoading, 青年组: detailLoading },
    minimumAge: detailLoading,
    format: [[detailLoading, detailLoading, detailLoading, detailLoading]],
    draw: [],
    signup: detailLoading,
    prizes: { 少年组: [["奖金", detailLoading]], 青年组: [["奖金", detailLoading]] },
    phases: [],
  };
}

export async function getPublicHomeData(): Promise<EventData> {
  const db = getDb();
  const rows = await db
    .select({
      id: events.id,
      year: events.year,
      stationNo: events.stationNo,
      title: events.fullTitle,
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
    })
    .from(events)
    .leftJoin(venues, eq(events.venueId, venues.id))
    .where(and(eq(events.publishStatus, "published"), sql`coalesce(is_hidden, false) = false`))
    .orderBy(desc(events.year), desc(events.stationNo));

  return {
    stations: rows.map((row, index) => loadingStation(row, index)),
    matches: [],
    players: [],
  };
}
