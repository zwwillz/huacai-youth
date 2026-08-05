import { and, count, desc, eq } from "drizzle-orm";
import { hash } from "bcryptjs";
import { getDb } from "./index";
import {
  auditLogs,
  adminSessions,
  eventDocuments,
  eventGroups,
  eventGuides,
  eventOrganizations,
  events,
  eventSponsors,
  players,
  publications,
  registrations,
  series,
  users,
  venues,
} from "./schema";

export type AdminRole = "system_admin" | "committee" | "referee";

export type EventInput = {
  id?: string;
  fullTitle: string;
  shortTitle: string;
  year: number;
  stationNo: number;
  city: string;
  venueName: string;
  startDate: string;
  endDate: string;
  registrationStartAt?: string;
  registrationEndAt?: string;
  summary?: string;
  status: string;
  publishStatus: string;
};

export type ManagedAccountInput =
  | { action: "create"; username: string; displayName: string; password: string; role: "committee" | "referee" }
  | { action: "status"; id: string; status: "active" | "disabled" }
  | { action: "password"; id: string; password: string };

const roleLabels: Record<AdminRole, string> = {
  system_admin: "系统管理员",
  committee: "组委会",
  referee: "裁判",
};

function now() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return prefix + "_" + crypto.randomUUID().replaceAll("-", "");
}

export async function bootstrapSystemAdmin(username: string, displayName: string, passwordHash: string) {
  const db = getDb();
  const [{ total }] = await db.select({ total: count() }).from(users);
  const [existingAccount] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  const [{ publicationCountBefore }] = await db.select({ publicationCountBefore: count() }).from(publications);
  if (Number(total) > 0 && !existingAccount) throw new Error("后台已经完成初始化，不能再次创建首位管理员。");

  const createdAt = now();
  const userId = existingAccount?.id ?? id("usr");
  if (!existingAccount) {
    await db.insert(users).values({
      id: userId,
      username,
      email: null,
      displayName,
      passwordHash,
      role: "system_admin",
      status: "active",
      passwordUpdatedAt: createdAt,
      lastLoginAt: createdAt,
      createdAt,
      updatedAt: createdAt,
    });
  }

  await seedCompetitionData(userId, createdAt);
  if (!existingAccount || Number(publicationCountBefore) < 18) {
    await db.insert(auditLogs).values({
      id: id("log"),
      actorUserId: userId,
      moduleType: "system",
      targetType: "users",
      targetId: userId,
      action: existingAccount ? "resume_bootstrap" : "bootstrap_admin",
      afterJson: JSON.stringify({ username, role: "system_admin" }),
      createdAt,
    });
  }

  return getAdminSnapshot(username);
}

async function seedCompetitionData(userId: string, createdAt: string) {
  const db = getDb();
  const seriesId = "series_huacai_youth";
  await db.insert(series).values({
    id: seriesId,
    name: "中国华彩十六球青少年系列赛",
    shortName: "华彩青少年系列赛",
    organizerName: "中国台球协会",
    status: "active",
    createdAt,
    updatedAt: createdAt,
  }).onConflictDoNothing();

  const venueRows = [
    { id: "venue_langfang", name: "铧一台球学院", province: "河北省", city: "廊坊市", district: "安次区", address: "安次区高新技术产业园安华路10号" },
    { id: "venue_taiyuan", name: "NB台球俱乐部 / 滨河体育中心", province: "山西省", city: "太原市", district: "小店区 / 万柏林区", address: "NB台球俱乐部许东店、滨河体育中心A馆" },
    { id: "venue_miyun", name: "万象汇星牌台球俱乐部", province: "北京市", city: "北京市", district: "密云区", address: "密云区万象汇星牌台球俱乐部" },
  ];
  await db.insert(venues).values(venueRows.map((venue) => ({ ...venue, tableCount: 0, createdAt, updatedAt: createdAt }))).onConflictDoNothing();

  const eventRows = [
    {
      id: "event_langfang_2026",
      stationNo: 3,
      fullTitle: "2026“铧一·星牌·南匠·Case One杯”中国华彩十六球青少年系列赛",
      shortTitle: "2026中国华彩十六球青少年系列赛廊坊站",
      slug: "2026-langfang",
      city: "河北廊坊",
      venueId: "venue_langfang",
      startDate: "2026-07-25",
      endDate: "2026-08-04",
      status: "in_progress",
      summary: "少年组和青年组分设资格赛、正赛双败阶段及32强单败阶段。",
    },
    {
      id: "event_taiyuan_2026",
      stationNo: 2,
      fullTitle: "2026“LKD·南匠·NB台球俱乐部杯”中国华彩十六球青少年系列赛",
      shortTitle: "2026中国华彩十六球青少年系列赛太原站",
      slug: "2026-taiyuan",
      city: "山西太原",
      venueId: "venue_taiyuan",
      startDate: "2026-06-11",
      endDate: "2026-06-20",
      status: "finished",
      summary: "少年组和青年组各设两场资格赛，正赛按双败和单败两个阶段进行。",
    },
    {
      id: "event_miyun_2026",
      stationNo: 1,
      fullTitle: "2026“南匠由甲”中国华彩十六球青少年系列赛",
      shortTitle: "2026中国华彩十六球青少年系列赛密云站",
      slug: "2026-miyun",
      city: "北京密云",
      venueId: "venue_miyun",
      startDate: "2026-02-22",
      endDate: "2026-03-02",
      status: "finished",
      summary: "2026赛季首站，少年组和青年组各设置两场预选赛。",
    },
  ];
  await db.insert(events).values(eventRows.map((event) => ({
    ...event,
    seriesId,
    year: 2026,
    publishStatus: "published",
    publishedAt: createdAt,
    createdBy: userId,
    updatedBy: userId,
    createdAt,
    updatedAt: createdAt,
  }))).onConflictDoNothing();

  const groupRows = eventRows.flatMap((event) => [
    { id: event.id + "_u16", eventId: event.id, name: "少年组", code: "U16", minimumAge: 6, registrationFeeCents: 10000, mainDrawSize: event.id === "event_miyun_2026" ? 128 : 64 },
    { id: event.id + "_u20", eventId: event.id, name: "青年组", code: "U20", minimumAge: 6, registrationFeeCents: 10000, mainDrawSize: event.id === "event_miyun_2026" ? 128 : 64 },
  ]);
  await db.insert(eventGroups).values(groupRows.map((group) => ({ ...group, status: "active", createdAt, updatedAt: createdAt }))).onConflictDoNothing();

  await db.insert(eventOrganizations).values([
    { id: "org_langfang_host", eventId: "event_langfang_2026", organizationType: "host", organizationName: "中国台球协会", sortOrder: 1, createdAt, updatedAt: createdAt },
    { id: "org_langfang_operator", eventId: "event_langfang_2026", organizationType: "operator", organizationName: "河北铧一体育文化集团有限公司", sortOrder: 2, createdAt, updatedAt: createdAt },
  ]).onConflictDoNothing();

  await db.insert(eventDocuments).values(eventRows.flatMap((event) => {
    const key = event.id.includes("langfang") ? "langfang" : event.id.includes("taiyuan") ? "taiyuan" : "miyun";
    return [
      { id: event.id + "_regulation", eventId: event.id, documentType: "regulation", title: "完整竞赛规程", externalUrl: "/regulations/" + key + ".pdf", versionNo: 1, isPublished: true, publishedAt: createdAt, createdBy: userId, createdAt, updatedAt: createdAt },
      { id: event.id + "_referees", eventId: event.id, documentType: "referee_list", title: "裁判员名单", externalUrl: "/referees/" + key + ".pdf", versionNo: 1, isPublished: true, publishedAt: createdAt, createdBy: userId, createdAt, updatedAt: createdAt },
    ];
  })).onConflictDoNothing();

  await db.insert(eventGuides).values([
    { id: "guide_langfang_transport", eventId: "event_langfang_2026", guideType: "transport", title: "交通住宿攻略", contentType: "article", body: "待组委会更新", publishStatus: "draft", createdBy: userId, createdAt, updatedAt: createdAt },
    { id: "guide_langfang_clothing", eventId: "event_langfang_2026", guideType: "clothing", title: "服装要求", contentType: "article", body: "待组委会更新", publishStatus: "draft", createdBy: userId, createdAt, updatedAt: createdAt },
  ]).onConflictDoNothing();

  await db.insert(eventSponsors).values({
    id: "sponsor_langfang_composite",
    eventId: "event_langfang_2026",
    name: "廊坊站合作伙伴",
    sponsorType: "sponsor",
    logoKey: "/langfang-sponsors.jpg",
    sortOrder: 1,
    isPublished: true,
    createdAt,
    updatedAt: createdAt,
  }).onConflictDoNothing();

  const moduleRows = eventRows.flatMap((event) => [
    ["overview", "赛事概览"],
    ["regulation", "竞赛规程"],
    ["documents", "赛事文件"],
    ["schedule", "赛程"],
    ["matches", "对阵"],
    ["rankings", "排名"],
  ].map(([moduleType, moduleTitle], index) => ({
    id: event.id + "_publication_" + moduleType,
    eventId: event.id,
    moduleType,
    moduleTitle,
    versionNo: 1,
    status: index < 3 ? "published" : event.id === "event_langfang_2026" ? "published" : "draft",
    publishedBy: index < 3 || event.id === "event_langfang_2026" ? userId : null,
    publishedAt: index < 3 || event.id === "event_langfang_2026" ? createdAt : null,
    createdAt,
    updatedAt: createdAt,
  })));
  for (let offset = 0; offset < moduleRows.length; offset += 6) {
    await db.insert(publications).values(moduleRows.slice(offset, offset + 6)).onConflictDoNothing();
  }
}

export async function getAdminSnapshot(username: string) {
  const db = getDb();
  const [account] = await db.select().from(users).where(and(eq(users.username, username), eq(users.status, "active"))).limit(1);
  if (!account) throw new Error("当前账号尚未获得后台权限。");

  const eventRows = await db.select().from(events).orderBy(desc(events.year), desc(events.stationNo));
  const venueRows = await db.select().from(venues);
  const publicationRows = await db.select().from(publications).orderBy(desc(publications.updatedAt));
  const documentRows = await db.select().from(eventDocuments);
  const guideRows = await db.select().from(eventGuides);
  const sponsorRows = await db.select().from(eventSponsors);
  const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(12);
  const accountRows = account.role === "system_admin"
    ? await db.select({ id: users.id, username: users.username, displayName: users.displayName, role: users.role, status: users.status, lastLoginAt: users.lastLoginAt, createdAt: users.createdAt }).from(users).orderBy(desc(users.createdAt))
    : [];
  const [{ playerCount }] = await db.select({ playerCount: count() }).from(players);
  const [{ pendingRegistrationCount }] = await db.select({ pendingRegistrationCount: count() }).from(registrations).where(eq(registrations.status, "pending"));
  const [{ registrationCount }] = await db.select({ registrationCount: count() }).from(registrations);
  const venueMap = new Map(venueRows.map((venue) => [venue.id, venue]));

  return {
    account: {
      id: account.id,
      username: account.username,
      displayName: account.displayName,
      role: account.role,
      roleLabel: roleLabels[account.role as AdminRole] ?? "后台账号",
    },
    metrics: {
      eventCount: eventRows.length,
      activeEventCount: eventRows.filter((event) => event.status === "in_progress" || event.status === "registration_open").length,
      playerCount: Number(playerCount),
      registrationCount: Number(registrationCount),
      pendingRegistrationCount: Number(pendingRegistrationCount),
      draftPublicationCount: publicationRows.filter((item) => item.status !== "published").length,
    },
    events: eventRows.map((event) => ({
      ...event,
      venueName: event.venueId ? venueMap.get(event.venueId)?.name ?? "" : "",
      groupCount: 2,
      publicationCount: publicationRows.filter((item) => item.eventId === event.id && item.status === "published").length,
    })),
    publications: publicationRows,
    documents: documentRows,
    guides: guideRows,
    sponsors: sponsorRows,
    accounts: accountRows,
    auditLogs: logs,
  };
}

async function requireEditor(username: string) {
  const db = getDb();
  const [account] = await db.select().from(users).where(and(eq(users.username, username), eq(users.status, "active"))).limit(1);
  if (!account || !["system_admin", "committee"].includes(account.role)) {
    throw new Error("当前角色没有修改赛事内容的权限。");
  }
  return account;
}

export async function saveEvent(username: string, input: EventInput) {
  const db = getDb();
  const account = await requireEditor(username);
  const updatedAt = now();
  if (!input.fullTitle.trim() || !input.shortTitle.trim() || !input.city.trim() || !input.startDate || !input.endDate) {
    throw new Error("请填写赛事名称、城市和比赛日期。");
  }

  if (input.id) {
    const [before] = await db.select().from(events).where(eq(events.id, input.id)).limit(1);
    if (!before) throw new Error("没有找到要修改的赛事。");
    let venueId = before.venueId;
    if (input.venueName.trim() && input.venueName.trim() !== "") {
      const [knownVenue] = await db.select().from(venues).where(eq(venues.name, input.venueName.trim())).limit(1);
      if (knownVenue) venueId = knownVenue.id;
      else {
        venueId = id("venue");
        await db.insert(venues).values({ id: venueId, name: input.venueName.trim(), city: input.city.trim(), tableCount: 0, createdAt: updatedAt, updatedAt });
      }
    }
    const next = {
      year: Number(input.year),
      stationNo: Number(input.stationNo),
      fullTitle: input.fullTitle.trim(),
      shortTitle: input.shortTitle.trim(),
      city: input.city.trim(),
      venueId,
      startDate: input.startDate,
      endDate: input.endDate,
      registrationStartAt: input.registrationStartAt || null,
      registrationEndAt: input.registrationEndAt || null,
      summary: input.summary?.trim() || null,
      status: input.status,
      publishStatus: input.publishStatus,
      publishedAt: input.publishStatus === "published" ? before.publishedAt ?? updatedAt : null,
      updatedBy: account.id,
      updatedAt,
    };
    await db.update(events).set(next).where(eq(events.id, input.id));
    await db.insert(auditLogs).values({ id: id("log"), actorUserId: account.id, eventId: input.id, moduleType: "events", targetType: "event", targetId: input.id, action: "update", beforeJson: JSON.stringify(before), afterJson: JSON.stringify(next), createdAt: updatedAt });
  } else {
    const [defaultSeries] = await db.select().from(series).limit(1);
    if (!defaultSeries) throw new Error("请先创建赛事系列。");
    const eventId = id("event");
    const venueId = id("venue");
    await db.insert(venues).values({ id: venueId, name: input.venueName.trim() || input.city.trim() + "比赛场馆", city: input.city.trim(), tableCount: 0, createdAt: updatedAt, updatedAt });
    const slug = "event-" + input.year + "-station-" + input.stationNo + "-" + eventId.slice(-6);
    await db.insert(events).values({
      id: eventId,
      seriesId: defaultSeries.id,
      year: Number(input.year),
      stationNo: Number(input.stationNo),
      fullTitle: input.fullTitle.trim(),
      shortTitle: input.shortTitle.trim(),
      slug,
      city: input.city.trim(),
      venueId,
      startDate: input.startDate,
      endDate: input.endDate,
      registrationStartAt: input.registrationStartAt || null,
      registrationEndAt: input.registrationEndAt || null,
      summary: input.summary?.trim() || null,
      status: input.status,
      publishStatus: input.publishStatus,
      publishedAt: input.publishStatus === "published" ? updatedAt : null,
      createdBy: account.id,
      updatedBy: account.id,
      createdAt: updatedAt,
      updatedAt,
    });
    await db.insert(eventGroups).values([
      { id: eventId + "_u16", eventId, name: "少年组", code: "U16", registrationFeeCents: 10000, mainDrawSize: 64, status: "active", createdAt: updatedAt, updatedAt },
      { id: eventId + "_u20", eventId, name: "青年组", code: "U20", registrationFeeCents: 10000, mainDrawSize: 64, status: "active", createdAt: updatedAt, updatedAt },
    ]);
    await db.insert(publications).values(["overview", "regulation", "documents", "schedule", "matches", "rankings"].map((moduleType) => ({
      id: eventId + "_publication_" + moduleType,
      eventId,
      moduleType,
      moduleTitle: ({ overview: "赛事概览", regulation: "竞赛规程", documents: "赛事文件", schedule: "赛程", matches: "对阵", rankings: "排名" } as Record<string, string>)[moduleType],
      versionNo: 1,
      status: "draft",
      createdAt: updatedAt,
      updatedAt,
    })));
    await db.insert(auditLogs).values({ id: id("log"), actorUserId: account.id, eventId, moduleType: "events", targetType: "event", targetId: eventId, action: "create", afterJson: JSON.stringify(input), createdAt: updatedAt });
  }
  return getAdminSnapshot(username);
}

export async function setPublicationStatus(username: string, publicationId: string, status: "draft" | "published") {
  const db = getDb();
  const account = await requireEditor(username);
  const [before] = await db.select().from(publications).where(eq(publications.id, publicationId)).limit(1);
  if (!before) throw new Error("没有找到要发布的内容模块。");
  const updatedAt = now();
  const next = {
    status,
    versionNo: before.versionNo + 1,
    publishedBy: status === "published" ? account.id : null,
    publishedAt: status === "published" ? updatedAt : null,
    updatedAt,
  };
  await db.update(publications).set(next).where(eq(publications.id, publicationId));
  await db.insert(auditLogs).values({ id: id("log"), actorUserId: account.id, eventId: before.eventId, moduleType: "publications", targetType: "publication", targetId: publicationId, action: status === "published" ? "publish" : "unpublish", beforeJson: JSON.stringify(before), afterJson: JSON.stringify(next), createdAt: updatedAt });
  return getAdminSnapshot(username);
}

async function requireSystemAdmin(username: string) {
  const db = getDb();
  const [account] = await db.select().from(users).where(and(eq(users.username, username), eq(users.status, "active"))).limit(1);
  if (!account || account.role !== "system_admin") throw new Error("只有系统管理员可以管理后台账号。");
  return account;
}

function validateUsername(username: string) {
  const normalized = username.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(normalized)) {
    throw new Error("用户名需为3至32位小写字母、数字、点、横线或下划线。");
  }
  return normalized;
}

function validatePassword(password: string) {
  if (password.length < 8 || password.length > 72) throw new Error("密码需为8至72个字符。");
}

export async function manageAccount(actorUsername: string, input: ManagedAccountInput) {
  const db = getDb();
  const actor = await requireSystemAdmin(actorUsername);
  const updatedAt = now();

  if (input.action === "create") {
    const username = validateUsername(input.username);
    validatePassword(input.password);
    if (!['committee', 'referee'].includes(input.role)) throw new Error("账号角色只能选择组委会或裁判。");
    if (!input.displayName.trim()) throw new Error("请填写账号显示名称。");
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
    if (existing) throw new Error("该用户名已经存在。");
    const accountId = id("usr");
    await db.insert(users).values({
      id: accountId,
      username,
      email: null,
      displayName: input.displayName.trim(),
      passwordHash: await hash(input.password, 12),
      role: input.role,
      status: "active",
      passwordUpdatedAt: updatedAt,
      createdAt: updatedAt,
      updatedAt,
    });
    await db.insert(auditLogs).values({ id: id("log"), actorUserId: actor.id, moduleType: "accounts", targetType: "user", targetId: accountId, action: "create_account", afterJson: JSON.stringify({ username, displayName: input.displayName.trim(), role: input.role }), createdAt: updatedAt });
  } else {
    const [target] = await db.select().from(users).where(eq(users.id, input.id)).limit(1);
    if (!target) throw new Error("没有找到该后台账号。");
    if (target.role === "system_admin" && target.username === actorUsername && input.action === "status" && input.status === "disabled") {
      throw new Error("不能停用当前登录的系统管理员账号。");
    }
    if (input.action === "status") {
      await db.update(users).set({ status: input.status, updatedAt }).where(eq(users.id, input.id));
      if (input.status === "disabled") await db.delete(adminSessions).where(eq(adminSessions.userId, input.id));
      await db.insert(auditLogs).values({ id: id("log"), actorUserId: actor.id, moduleType: "accounts", targetType: "user", targetId: input.id, action: input.status === "active" ? "enable_account" : "disable_account", beforeJson: JSON.stringify({ status: target.status }), afterJson: JSON.stringify({ status: input.status }), createdAt: updatedAt });
    } else {
      validatePassword(input.password);
      await db.update(users).set({ passwordHash: await hash(input.password, 12), passwordUpdatedAt: updatedAt, updatedAt }).where(eq(users.id, input.id));
      await db.delete(adminSessions).where(eq(adminSessions.userId, input.id));
      await db.insert(auditLogs).values({ id: id("log"), actorUserId: actor.id, moduleType: "accounts", targetType: "user", targetId: input.id, action: "reset_password", createdAt: updatedAt });
    }
  }
  return getAdminSnapshot(actorUsername);
}
