import { randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { NextResponse } from "next/server";
import { getSqlClient } from "@/db";
import {
  describeDevice,
  extractRequestIp,
  extractRequestRegion,
  formatVisitorRegion,
  type VisitorGeoPayload,
} from "@/lib/site-monitor";

const BLOCKED_PATH_PREFIXES = ["/admin", "/site-monitor", "/api"];
const WECHAT_VERIFY_PATH = "/dd8ad1096190a17bbcd86e01faa9c979.txt";

type VisitBody = {
  visitorId?: string;
  path?: string;
  pageLabel?: string;
  eventId?: string;
  eventLabel?: string;
  referrer?: string;
  geo?: VisitorGeoPayload;
};

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function safeVisitorId(value: unknown) {
  const cleaned = clean(value, 80);
  return /^[a-zA-Z0-9._-]{8,80}$/.test(cleaned) ? cleaned : "";
}

function safePath(value: unknown) {
  const cleaned = clean(value, 320);
  return cleaned.startsWith("/") ? cleaned : "";
}

function blockedPath(path: string) {
  const pathname = path.split("?")[0] || "/";
  return pathname === WECHAT_VERIFY_PATH || BLOCKED_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function bodyIp(value: unknown) {
  const candidate = clean(value, 80).replace(/^::ffff:/, "");
  return isIP(candidate) ? candidate : "";
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as VisitBody;
    const visitorId = safeVisitorId(body.visitorId);
    const path = safePath(body.path);
    if (!visitorId || !path || blockedPath(path)) return new NextResponse(null, { status: 204 });

    const eventId = clean(body.eventId, 100);
    const pageLabel = clean(body.pageLabel, 140);
    const eventLabel = clean(body.eventLabel, 120);
    const referrer = clean(body.referrer, 320);
    const userAgent = clean(request.headers.get("user-agent"), 500);
    const serverIp = extractRequestIp(request.headers);
    const reportedIp = bodyIp(body.geo?.clientIp);
    const ipAddress = serverIp || reportedIp || null;
    const bodyRegion = formatVisitorRegion(body.geo);
    const region = bodyRegion || extractRequestRegion(request.headers) || "未知";
    const device = describeDevice(userAgent);
    const createdAt = new Date().toISOString();
    const afterJson = JSON.stringify({
      path,
      pageLabel,
      eventLabel,
      region,
      device,
      userAgent,
      referrer,
    });

    const sql = getSqlClient();
    await sql`
      insert into public.audit_logs(
        id,actor_user_id,event_id,module_type,target_type,target_id,action,reason,before_json,after_json,ip_address,created_at
      )
      select
        ${randomUUID()},null,nullif(${eventId},''),'public_visit','page',${visitorId},'view',null,null,${afterJson},${ipAddress},${createdAt}
      where not exists (
        select 1
        from public.audit_logs existing
        where existing.module_type='public_visit'
          and existing.target_id=${visitorId}
          and coalesce(existing.after_json,'{}')::jsonb->>'path'=${path}
          and existing.created_at::timestamptz>now()-interval '20 seconds'
      )
    `;
  } catch (error) {
    console.warn("public visit logging skipped", error instanceof Error ? error.message : "unknown error");
  }

  return new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}
