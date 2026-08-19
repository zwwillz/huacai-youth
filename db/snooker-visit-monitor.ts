import { getSqlClient } from "./index";

export type SnookerVisitRange = "today" | "yesterday" | "7d" | "30d";

export type SnookerVisitMonitorRow = {
  id: string;
  time: string;
  visitor: string;
  ip: string;
  region: string;
  device: string;
  page: string;
  event: string;
  action: "浏览页面";
};

export type SnookerVisitMonitorData = {
  rows: SnookerVisitMonitorRow[];
  page: number;
  pageSize: number;
  hasPrevious: boolean;
  hasNext: boolean;
};

type VisitRow = {
  id: string;
  createdAt: string;
  visitorId: string | null;
  ipAddress: string | null;
  afterJson: string | null;
};

type VisitMeta = {
  path?: string;
  pageLabel?: string;
  eventLabel?: string;
  region?: string;
  device?: string;
};

const PAGE_SIZE = 100;
const CHINA_OFFSET_MS = 8 * 60 * 60 * 1000;

function clean(value: string | undefined, max = 80) {
  return (value || "").trim().slice(0, max);
}

function normalizePage(value: number | undefined) {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(10_000, Math.floor(value || 1)));
}

function chinaDayStart(reference: Date, offsetDays = 0) {
  const shifted = new Date(reference.getTime() + CHINA_OFFSET_MS);
  const shiftedMidnightUtc = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate() + offsetDays,
  );
  return new Date(shiftedMidnightUtc - CHINA_OFFSET_MS).toISOString();
}

function rangeBounds(range: SnookerVisitRange) {
  const now = new Date();
  const nowIso = now.toISOString();
  const todayStart = chinaDayStart(now);
  if (range === "today") return { from: todayStart, to: nowIso };
  if (range === "yesterday") return { from: chinaDayStart(now, -1), to: todayStart };
  if (range === "30d") return { from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(), to: nowIso };
  return { from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(), to: nowIso };
}

function parseMeta(value: string | null): VisitMeta {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" ? parsed as VisitMeta : {};
  } catch {
    return {};
  }
}

function visitorLabel(visitorId: string | null) {
  const compact = (visitorId || "").replace(/[^a-zA-Z0-9]/g, "");
  return `游客 ${compact.slice(-4).toUpperCase() || "----"}`;
}

function fullIp(value: string | null) {
  const ip = (value || "").trim();
  return ip || "未知";
}

export async function getSnookerVisitMonitorData(input: {
  range?: SnookerVisitRange;
  query?: string;
  page?: number;
} = {}): Promise<SnookerVisitMonitorData> {
  const sql = getSqlClient();
  const range = input.range || "today";
  const query = clean(input.query);
  const searchPattern = query ? `%${query.toLowerCase()}%` : "";
  const page = normalizePage(input.page);
  const offset = (page - 1) * PAGE_SIZE;
  const { from, to } = rangeBounds(range);

  const rows = await sql<VisitRow[]>`
    select
      al.id,
      al.created_at as "createdAt",
      al.target_id as "visitorId",
      al.ip_address as "ipAddress",
      al.after_json as "afterJson"
    from public.audit_logs al
    where al.module_type='public_visit'
      and al.created_at>=${from}
      and al.created_at<${to}
      and coalesce(al.after_json,'{}')::jsonb->>'path' like '/snooker%'
      and coalesce(al.after_json,'{}')::jsonb->>'path' not like '/snooker/site-monitor%'
      and (
        ${searchPattern}=''
        or lower(concat_ws(' ',al.target_id,al.ip_address,al.after_json)) like ${searchPattern}
      )
    order by al.created_at desc,al.id desc
    limit ${PAGE_SIZE + 1}
    offset ${offset}
  `;

  const hasNext = rows.length > PAGE_SIZE;
  return {
    page,
    pageSize: PAGE_SIZE,
    hasPrevious: page > 1,
    hasNext,
    rows: rows.slice(0, PAGE_SIZE).map((row) => {
      const meta = parseMeta(row.afterJson);
      return {
        id: row.id,
        time: row.createdAt,
        visitor: visitorLabel(row.visitorId),
        ip: fullIp(row.ipAddress),
        region: meta.region || "未知",
        device: meta.device || "未知",
        page: meta.pageLabel || meta.path || "世界斯诺克数据中心",
        event: meta.eventLabel || "—",
        action: "浏览页面" as const,
      };
    }),
  };
}
