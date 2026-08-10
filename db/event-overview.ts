import { and, eq } from "drizzle-orm";
import { getDb } from "./index";
import { requireEventAccess } from "./permissions";
import { auditLogs, eventDetails, eventGuides, eventSponsors, events, venues } from "./schema";
import { getEventManagementData, type EventManagementData } from "./event-management";

export type EventOverviewInput = {
  eventId: string;
  shortTitle: string;
  summary?: string;
  publishStatus: "draft" | "published";
  coverImageKey?: string;
  venue: { name?: string; province?: string; city?: string; district?: string; address?: string; tableCount?: number };
  details: { sponsorLabel?: string; durationLabel?: string; qualifierDateLabel?: string; mainDateLabel?: string; totalPrizeLabel?: string; mainSizeLabel?: string };
  sponsors: Array<{ name: string; sponsorType: string; logoKey?: string; websiteUrl?: string; isPublished: boolean }>;
  guides: Array<{ guideType: "transport" | "clothing"; title: string; body: string; publishStatus: "draft" | "published" }>;
};

function now() { return new Date().toISOString(); }
function id(prefix: string) { return prefix + "_" + crypto.randomUUID().replaceAll("-", ""); }
function clean(value: string | null | undefined) { const next = value?.trim(); return next ? next : null; }
function validate(input: EventOverviewInput) {
  if (!input.eventId) throw new Error("缺少赛事ID。");
  if (!input.shortTitle?.trim()) throw new Error("请填写前端显示简称。");
  if (!["draft", "published"].includes(input.publishStatus)) throw new Error("前端发布状态不正确。");
  for (const sponsor of input.sponsors ?? []) {
    if (sponsor.logoKey?.trim() && !sponsor.name?.trim()) throw new Error("上传合作伙伴 Logo 后，请同时填写名称。");
    if (sponsor.isPublished && sponsor.name?.trim() && !sponsor.logoKey?.trim()) throw new Error(`“${sponsor.name.trim()}”已设为前端展示，请先上传 Logo。`);
  }
}

/** Save only overview-owned fields, atomically. */
export async function saveEventOverviewData(username: string, input: EventOverviewInput): Promise<EventManagementData> {
  validate(input);
  const account = await requireEventAccess(username, input.eventId, { write: true, allowedRoles: ["system_admin", "committee"], deniedMessage: "当前账号没有编辑赛事概览的权限。" });
  const db = getDb();
  const updatedAt = now();
  const sponsorRows = (input.sponsors ?? []).map((sponsor) => ({ ...sponsor, name: sponsor.name.trim() })).filter((sponsor) => sponsor.name);

  await db.transaction(async (tx) => {
    const [beforeEvent] = await tx.select().from(events).where(eq(events.id, input.eventId)).limit(1);
    if (!beforeEvent) throw new Error("没有找到要修改的赛事。");
    let venueId = beforeEvent.venueId;
    const venueName = input.venue?.name?.trim() ?? "";
    if (venueId) {
      await tx.update(venues).set({ name: venueName, province: clean(input.venue.province), city: clean(input.venue.city) ?? beforeEvent.city, district: clean(input.venue.district), address: clean(input.venue.address), tableCount: Math.max(0, Number(input.venue.tableCount ?? 0)), updatedAt }).where(eq(venues.id, venueId));
    } else if (venueName) {
      venueId = id("venue");
      await tx.insert(venues).values({ id: venueId, name: venueName, province: clean(input.venue.province), city: clean(input.venue.city) ?? beforeEvent.city, district: clean(input.venue.district), address: clean(input.venue.address), tableCount: Math.max(0, Number(input.venue.tableCount ?? 0)), createdAt: updatedAt, updatedAt });
    }
    await tx.update(events).set({ shortTitle: input.shortTitle.trim(), venueId, coverImageKey: clean(input.coverImageKey), summary: clean(input.summary), publishStatus: input.publishStatus, publishedAt: input.publishStatus === "published" ? beforeEvent.publishedAt ?? updatedAt : null, updatedBy: account.id, updatedAt }).where(eq(events.id, input.eventId));
    await tx.insert(eventDetails).values({ eventId: input.eventId, sponsorLabel: clean(input.details.sponsorLabel), durationLabel: clean(input.details.durationLabel), qualifierDateLabel: clean(input.details.qualifierDateLabel), mainDateLabel: clean(input.details.mainDateLabel), totalPrizeLabel: clean(input.details.totalPrizeLabel), mainSizeLabel: clean(input.details.mainSizeLabel), createdAt: updatedAt, updatedAt }).onConflictDoUpdate({ target: eventDetails.eventId, set: { sponsorLabel: clean(input.details.sponsorLabel), durationLabel: clean(input.details.durationLabel), qualifierDateLabel: clean(input.details.qualifierDateLabel), mainDateLabel: clean(input.details.mainDateLabel), totalPrizeLabel: clean(input.details.totalPrizeLabel), mainSizeLabel: clean(input.details.mainSizeLabel), updatedAt } });
    await tx.delete(eventSponsors).where(eq(eventSponsors.eventId, input.eventId));
    if (sponsorRows.length) await tx.insert(eventSponsors).values(sponsorRows.map((sponsor, index) => ({ id: id("sponsor"), eventId: input.eventId, name: sponsor.name, sponsorType: sponsor.sponsorType?.trim() || "sponsor", logoKey: clean(sponsor.logoKey), websiteUrl: clean(sponsor.websiteUrl), sortOrder: index + 1, isPublished: Boolean(sponsor.isPublished), createdAt: updatedAt, updatedAt })));
    for (const guide of input.guides ?? []) {
      const [existing] = await tx.select().from(eventGuides).where(and(eq(eventGuides.eventId, input.eventId), eq(eventGuides.guideType, guide.guideType))).limit(1);
      const next = { title: guide.title.trim(), contentType: "article", body: clean(guide.body), publishStatus: guide.publishStatus, publishedAt: guide.publishStatus === "published" ? existing?.publishedAt ?? updatedAt : null, updatedAt };
      if (existing) await tx.update(eventGuides).set(next).where(eq(eventGuides.id, existing.id));
      else await tx.insert(eventGuides).values({ id: id("guide"), eventId: input.eventId, guideType: guide.guideType, ...next, createdBy: account.id, createdAt: updatedAt });
    }
    await tx.insert(auditLogs).values({ id: id("log"), actorUserId: account.id, eventId: input.eventId, moduleType: "content", targetType: "event_overview", targetId: input.eventId, action: "save_overview", beforeJson: JSON.stringify({ publishStatus: beforeEvent.publishStatus, coverImageKey: beforeEvent.coverImageKey }), afterJson: JSON.stringify({ publishStatus: input.publishStatus, coverImageKey: clean(input.coverImageKey), sponsorCount: sponsorRows.length }), createdAt: updatedAt });
  });
  return getEventManagementData(username, input.eventId);
}
