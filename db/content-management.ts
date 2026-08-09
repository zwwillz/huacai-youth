import { and, asc, eq } from "drizzle-orm";
import { getDb } from "./index";
import { requireEventAccess } from "./permissions";
import {
  auditLogs,
  eventDetails,
  eventDocuments,
  eventGuides,
  events,
  publications,
} from "./schema";

export type ContentPublication = {
  id: string;
  moduleType: string;
  moduleTitle: string;
  versionNo: number;
  status: string;
  publishedAt: string;
};

export type ContentDocument = {
  id: string;
  documentType: string;
  title: string;
  url: string;
  isPublished: boolean;
};

export type ContentGuide = {
  id: string;
  guideType: string;
  title: string;
  body: string;
  publishStatus: string;
};

export type ContentManagementData = {
  event: {
    id: string;
    shortTitle: string;
    fullTitle: string;
    city: string;
    status: string;
    publishStatus: string;
    summary: string;
  };
  publications: ContentPublication[];
  details: {
    competitionFormat: string[][];
    drawRules: string[];
    ruleStandard: string;
    prizeNote: string;
    prizes: Record<"少年组" | "青年组", string[][]>;
  };
  documents: ContentDocument[];
  guides: ContentGuide[];
};

export type ContentManagementInput = {
  eventId: string;
  summary: string;
  competitionFormat: string[][];
  drawRules: string[];
  ruleStandard: string;
  prizeNote: string;
  prizes: Record<"少年组" | "青年组", string[][]>;
  documents: Array<{
    documentType: "regulation" | "referee_list";
    title: string;
    url: string;
    isPublished: boolean;
  }>;
  guides: Array<{
    guideType: "transport" | "clothing";
    title: string;
    body: string;
    publishStatus: "draft" | "published";
  }>;
};

function now() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return prefix + "_" + crypto.randomUUID().replaceAll("-", "");
}

function asRows(value: unknown): string[][] {
  if (!Array.isArray(value)) return [];
  return value.filter(Array.isArray).map((row) => (row as unknown[]).map((item) => String(item ?? "")));
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item ?? "")).filter(Boolean) : [];
}

function prizeMap(value: unknown) {
  const result: Record<"少年组" | "青年组", string[][]> = { 少年组: [], 青年组: [] };
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    result.少年组 = asRows(record.少年组);
    result.青年组 = asRows(record.青年组);
  }
  return result;
}

async function requireEditor(username: string, eventId: string) {
  return requireEventAccess(username, eventId, {
    allowedRoles: ["system_admin", "committee"],
    deniedMessage: "当前账号没有编辑和发布赛事内容的权限。",
  });
}

export async function getContentManagementData(username: string, eventId: string): Promise<ContentManagementData> {
  await requireEditor(username, eventId);
  const db = getDb();
  const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!event) throw new Error("没有找到这场赛事。");

  const [details, publicationRows, documentRows, guideRows] = await Promise.all([
    db.select().from(eventDetails).where(eq(eventDetails.eventId, eventId)).limit(1).then((rows) => rows[0] ?? null),
    db.select().from(publications).where(eq(publications.eventId, eventId)).orderBy(asc(publications.moduleType)),
    db.select().from(eventDocuments).where(eq(eventDocuments.eventId, eventId)).orderBy(asc(eventDocuments.documentType)),
    db.select().from(eventGuides).where(eq(eventGuides.eventId, eventId)).orderBy(asc(eventGuides.guideType)),
  ]);

  const documentByType = new Map(documentRows.map((row) => [row.documentType, row]));
  const guideByType = new Map(guideRows.map((row) => [row.guideType, row]));
  const normalizedDocuments: ContentDocument[] = ([
    ["regulation", "完整竞赛规程"],
    ["referee_list", "裁判员名单"],
  ] as const).map(([documentType, title]) => {
    const row = documentByType.get(documentType);
    return {
      id: row?.id ?? "",
      documentType,
      title: row?.title ?? title,
      url: row?.externalUrl || row?.fileKey || "",
      isPublished: row?.isPublished ?? false,
    };
  });

  const normalizedGuides: ContentGuide[] = ([
    ["transport", "交通住宿攻略"],
    ["clothing", "服装要求"],
  ] as const).map(([guideType, title]) => {
    const row = guideByType.get(guideType);
    return { id: row?.id ?? "", guideType, title: row?.title ?? title, body: row?.body ?? "", publishStatus: row?.publishStatus ?? "draft" };
  });

  return {
    event: {
      id: event.id,
      shortTitle: event.shortTitle,
      fullTitle: event.fullTitle,
      city: event.city,
      status: event.status,
      publishStatus: event.publishStatus,
      summary: event.summary ?? "",
    },
    publications: publicationRows.map((row) => ({
      id: row.id, moduleType: row.moduleType, moduleTitle: row.moduleTitle, versionNo: row.versionNo, status: row.status, publishedAt: row.publishedAt ?? "",
    })),
    details: {
      competitionFormat: asRows(details?.competitionFormat),
      drawRules: asStrings(details?.drawRules),
      ruleStandard: details?.ruleStandard ?? "",
      prizeNote: details?.prizeNote ?? "",
      prizes: prizeMap(details?.prizes),
    },
    documents: normalizedDocuments,
    guides: normalizedGuides,
  };
}

function validate(input: ContentManagementInput) {
  if (!input.eventId) throw new Error("缺少赛事ID。");
  for (const row of input.competitionFormat ?? []) {
    if (row.length < 4) throw new Error("每条竞赛办法需要填写阶段、赛制、少年组和青年组四项内容。");
  }
  for (const document of input.documents ?? []) {
    if (!document.title.trim()) throw new Error("赛事文件标题不能为空。");
    if (document.isPublished && !document.url.trim()) throw new Error(`“${document.title}”设为前端展示前需要先上传或填写文件地址。`);
  }
}

export async function saveContentManagementData(username: string, input: ContentManagementInput) {
  validate(input);
  const account = await requireEditor(username, input.eventId);
  const db = getDb();
  const [event] = await db.select().from(events).where(eq(events.id, input.eventId)).limit(1);
  if (!event) throw new Error("没有找到这场赛事。");
  const updatedAt = now();
  const cleanDrawRules = (input.drawRules ?? []).map((item) => item.trim()).filter(Boolean);

  await db.transaction(async (tx) => {
    await tx.update(events).set({ summary: input.summary.trim() || null, updatedBy: account.id, updatedAt }).where(eq(events.id, input.eventId));

    await tx.insert(eventDetails).values({
      eventId: input.eventId,
      ageRules: {},
      competitionFormat: input.competitionFormat ?? [],
      ruleStandard: input.ruleStandard.trim() || null,
      drawRules: cleanDrawRules,
      prizeNote: input.prizeNote.trim() || null,
      prizes: input.prizes ?? { 少年组: [], 青年组: [] },
      createdAt: updatedAt,
      updatedAt,
    }).onConflictDoUpdate({
      target: eventDetails.eventId,
      set: {
        competitionFormat: input.competitionFormat ?? [],
        ruleStandard: input.ruleStandard.trim() || null,
        drawRules: cleanDrawRules,
        prizeNote: input.prizeNote.trim() || null,
        prizes: input.prizes ?? { 少年组: [], 青年组: [] },
        updatedAt,
      },
    });

    for (const document of input.documents ?? []) {
      const [existing] = await tx.select().from(eventDocuments).where(and(eq(eventDocuments.eventId, input.eventId), eq(eventDocuments.documentType, document.documentType))).limit(1);
      const next = {
        title: document.title.trim(),
        fileKey: document.url.trim().startsWith("/api/assets/") ? document.url.trim() : null,
        externalUrl: document.url.trim().startsWith("/api/assets/") ? null : (document.url.trim() || null),
        isPublished: Boolean(document.isPublished),
        publishedAt: document.isPublished ? existing?.publishedAt ?? updatedAt : null,
        updatedAt,
      };
      if (existing) await tx.update(eventDocuments).set(next).where(eq(eventDocuments.id, existing.id));
      else await tx.insert(eventDocuments).values({ id: id("doc"), eventId: input.eventId, documentType: document.documentType, ...next, versionNo: 1, createdBy: account.id, createdAt: updatedAt });
    }

    for (const guide of input.guides ?? []) {
      const [existing] = await tx.select().from(eventGuides).where(and(eq(eventGuides.eventId, input.eventId), eq(eventGuides.guideType, guide.guideType))).limit(1);
      const next = {
        title: guide.title.trim(), contentType: "article", body: guide.body.trim() || null, publishStatus: guide.publishStatus,
        publishedAt: guide.publishStatus === "published" ? existing?.publishedAt ?? updatedAt : null, updatedAt,
      };
      if (existing) await tx.update(eventGuides).set(next).where(eq(eventGuides.id, existing.id));
      else await tx.insert(eventGuides).values({ id: id("guide"), eventId: input.eventId, guideType: guide.guideType, ...next, createdBy: account.id, createdAt: updatedAt });
    }

    await tx.insert(auditLogs).values({
      id: id("log"), actorUserId: account.id, eventId: input.eventId, moduleType: "content", targetType: "content_bundle", targetId: input.eventId,
      action: "save_content", afterJson: JSON.stringify({ formatRows: input.competitionFormat?.length ?? 0, drawRules: cleanDrawRules.length, documents: input.documents?.length ?? 0, guides: input.guides?.length ?? 0 }), createdAt: updatedAt,
    });
  });

  return getContentManagementData(username, input.eventId);
}

export async function setContentPublicationStatus(username: string, eventId: string, publicationId: string, status: "draft" | "published") {
  const account = await requireEditor(username, eventId);
  const db = getDb();
  const [before] = await db.select().from(publications).where(and(eq(publications.id, publicationId), eq(publications.eventId, eventId))).limit(1);
  if (!before) throw new Error("没有找到要发布的内容模块。");
  const updatedAt = now();
  const next = { status, versionNo: before.versionNo + 1, publishedBy: status === "published" ? account.id : null, publishedAt: status === "published" ? updatedAt : null, updatedAt };
  await db.update(publications).set(next).where(eq(publications.id, publicationId));
  await db.insert(auditLogs).values({ id: id("log"), actorUserId: account.id, eventId, moduleType: "content", targetType: "publication", targetId: publicationId, action: status === "published" ? "publish" : "unpublish", beforeJson: JSON.stringify({ status: before.status, versionNo: before.versionNo }), afterJson: JSON.stringify(next), createdAt: updatedAt });
  return getContentManagementData(username, eventId);
}
