import { boolean, index, integer, jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull(),
  email: text("email"),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("referee"),
  status: text("status").notNull().default("active"),
  passwordUpdatedAt: text("password_updated_at").notNull(),
  lastLoginAt: text("last_login_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("users_username_unique").on(table.username),
  uniqueIndex("users_email_unique").on(table.email),
  index("users_role_idx").on(table.role),
]);

export const adminSessions = pgTable("admin_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  tokenHash: text("token_hash").notNull(),
  expiresAt: text("expires_at").notNull(),
  lastSeenAt: text("last_seen_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("admin_sessions_token_unique").on(table.tokenHash),
  index("admin_sessions_user_idx").on(table.userId),
  index("admin_sessions_expires_idx").on(table.expiresAt),
]);

export const series = pgTable("series", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  shortName: text("short_name"),
  organizerName: text("organizer_name"),
  logoKey: text("logo_key"),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const venues = pgTable("venues", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  province: text("province"),
  city: text("city"),
  district: text("district"),
  address: text("address"),
  contactName: text("contact_name"),
  contactPhone: text("contact_phone"),
  tableCount: integer("table_count").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const events = pgTable("events", {
  id: text("id").primaryKey(),
  seriesId: text("series_id").notNull().references(() => series.id),
  year: integer("year").notNull(),
  stationNo: integer("station_no").notNull(),
  fullTitle: text("full_title").notNull(),
  shortTitle: text("short_title").notNull(),
  slug: text("slug").notNull(),
  city: text("city").notNull(),
  venueId: text("venue_id").references(() => venues.id),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  registrationStartAt: text("registration_start_at"),
  registrationEndAt: text("registration_end_at"),
  coverImageKey: text("cover_image_key"),
  summary: text("summary"),
  status: text("status").notNull().default("draft"),
  publishStatus: text("publish_status").notNull().default("draft"),
  isHidden: boolean("is_hidden").notNull().default(false),
  publishedAt: text("published_at"),
  createdBy: text("created_by").references(() => users.id),
  updatedBy: text("updated_by").references(() => users.id),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("events_slug_unique").on(table.slug),
  index("events_year_station_idx").on(table.year, table.stationNo),
  index("events_status_idx").on(table.status, table.publishStatus),
]);

export const eventMembers = pgTable("event_members", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => events.id),
  userId: text("user_id").notNull().references(() => users.id),
  role: text("role").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("event_members_unique").on(table.eventId, table.userId),
  index("event_members_role_idx").on(table.eventId, table.role),
]);

export const eventOrganizations = pgTable("event_organizations", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => events.id),
  organizationType: text("organization_type").notNull(),
  organizationName: text("organization_name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("event_organizations_event_idx").on(table.eventId)]);

export const eventGroups = pgTable("event_groups", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => events.id),
  name: text("name").notNull(),
  code: text("code").notNull(),
  birthDateFrom: text("birth_date_from"),
  birthDateTo: text("birth_date_to"),
  minimumAge: integer("minimum_age"),
  registrationFeeCents: integer("registration_fee_cents").notNull().default(0),
  registrationLimit: integer("registration_limit"),
  mainDrawSize: integer("main_draw_size"),
  rulesJson: text("rules_json"),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("event_groups_code_unique").on(table.eventId, table.code),
  index("event_groups_event_idx").on(table.eventId),
]);

export const eventDocuments = pgTable("event_documents", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => events.id),
  documentType: text("document_type").notNull(),
  title: text("title").notNull(),
  fileKey: text("file_key"),
  externalUrl: text("external_url"),
  versionNo: integer("version_no").notNull().default(1),
  isPublished: boolean("is_published").notNull().default(false),
  publishedAt: text("published_at"),
  createdBy: text("created_by").references(() => users.id),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("event_documents_event_type_idx").on(table.eventId, table.documentType)]);

export const eventGuides = pgTable("event_guides", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => events.id),
  guideType: text("guide_type").notNull(),
  title: text("title").notNull(),
  contentType: text("content_type").notNull().default("article"),
  body: text("body"),
  fileKey: text("file_key"),
  externalUrl: text("external_url"),
  publishStatus: text("publish_status").notNull().default("draft"),
  publishedAt: text("published_at"),
  createdBy: text("created_by").references(() => users.id),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("event_guides_unique").on(table.eventId, table.guideType),
  index("event_guides_event_idx").on(table.eventId),
]);

export const eventSponsors = pgTable("event_sponsors", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => events.id),
  name: text("name").notNull(),
  sponsorType: text("sponsor_type").notNull().default("sponsor"),
  logoKey: text("logo_key"),
  websiteUrl: text("website_url"),
  sortOrder: integer("sort_order").notNull().default(0),
  isPublished: boolean("is_published").notNull().default(false),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("event_sponsors_event_idx").on(table.eventId, table.sortOrder)]);

export const eventDetails = pgTable("event_details", {
  eventId: text("event_id").primaryKey().references(() => events.id),
  sponsorLabel: text("sponsor_label"),
  durationLabel: text("duration_label"),
  qualifierDateLabel: text("qualifier_date_label"),
  mainDateLabel: text("main_date_label"),
  totalPrizeLabel: text("total_prize_label"),
  mainSizeLabel: text("main_size_label"),
  minimumAgeNote: text("minimum_age_note"),
  signupNote: text("signup_note"),
  ageRules: jsonb("age_rules").notNull().default({}),
  competitionFormat: jsonb("competition_format").notNull().default([]),
  ruleStandard: text("rule_standard"),
  drawRules: jsonb("draw_rules").notNull().default([]),
  prizeNote: text("prize_note"),
  prizes: jsonb("prizes").notNull().default({}),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const eventPhases = pgTable("event_phases", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => events.id),
  code: text("code").notNull(),
  phaseNumber: text("phase_number"),
  title: text("title").notNull(),
  dateLabel: text("date_label"),
  status: text("status").notNull().default("pending"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("event_phases_event_code_unique").on(table.eventId, table.code),
  index("event_phases_event_sort_idx").on(table.eventId, table.sortOrder),
]);

export const players = pgTable("players", {
  id: text("id").primaryKey(),
  fullName: text("full_name").notNull(),
  gender: text("gender"),
  birthDate: text("birth_date"),
  province: text("province"),
  city: text("city"),
  clubName: text("club_name"),
  schoolName: text("school_name"),
  phone: text("phone"),
  email: text("email"),
  avatarKey: text("avatar_key"),
  identityNoMasked: text("identity_no_masked"),
  profileStatus: text("profile_status").notNull().default("pending"),
  mergedIntoPlayerId: text("merged_into_player_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("players_name_idx").on(table.fullName),
  index("players_birth_date_idx").on(table.birthDate),
]);

export const matches = pgTable("matches", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => events.id),
  groupId: text("group_id").notNull().references(() => eventGroups.id),
  phaseId: text("phase_id").references(() => eventPhases.id),
  matchDate: text("match_date").notNull(),
  matchTime: text("match_time"),
  roundName: text("round_name"),
  progress: text("progress"),
  raceTo: text("race_to"),
  orderNo: integer("order_no"),
  matchCode: text("match_code"),
  playerAId: text("player_a_id").references(() => players.id),
  playerBId: text("player_b_id").references(() => players.id),
  playerAName: text("player_a_name").notNull().default(""),
  playerBName: text("player_b_name").notNull().default(""),
  scoreA: text("score_a"),
  scoreB: text("score_b"),
  resultType: text("result_type"),
  tableName: text("table_name"),
  isTv: boolean("is_tv").notNull().default(false),
  status: text("status").notNull().default("scheduled"),
  source: text("source").notNull().default("admin"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("matches_event_group_date_idx").on(table.eventId, table.groupId, table.matchDate),
  index("matches_event_phase_code_idx").on(table.eventId, table.phaseId, table.matchCode),
  index("matches_player_a_idx").on(table.playerAId),
  index("matches_player_b_idx").on(table.playerBId),
]);

export const guardians = pgTable("guardians", {
  id: text("id").primaryKey(),
  playerId: text("player_id").notNull().references(() => players.id),
  fullName: text("full_name").notNull(),
  relationship: text("relationship").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  isPrimary: boolean("is_primary").notNull().default(true),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("guardians_player_idx").on(table.playerId)]);

export const registrations = pgTable("registrations", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => events.id),
  groupId: text("group_id").notNull().references(() => eventGroups.id),
  playerId: text("player_id").notNull().references(() => players.id),
  source: text("source").notNull().default("player"),
  status: text("status").notNull().default("pending"),
  feeStatus: text("fee_status").notNull().default("unpaid"),
  feeAmountCents: integer("fee_amount_cents").notNull().default(0),
  submittedAt: text("submitted_at").notNull(),
  reviewedBy: text("reviewed_by").references(() => users.id),
  reviewedAt: text("reviewed_at"),
  reviewNote: text("review_note"),
  withdrawalReason: text("withdrawal_reason"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("registrations_unique").on(table.eventId, table.groupId, table.playerId),
  index("registrations_review_idx").on(table.eventId, table.status),
]);

export const publications = pgTable("publications", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => events.id),
  moduleType: text("module_type").notNull(),
  moduleTitle: text("module_title").notNull(),
  versionNo: integer("version_no").notNull().default(1),
  snapshotJson: text("snapshot_json"),
  status: text("status").notNull().default("draft"),
  publishedBy: text("published_by").references(() => users.id),
  publishedAt: text("published_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("publications_module_unique").on(table.eventId, table.moduleType),
  index("publications_status_idx").on(table.eventId, table.status),
]);

export const auditLogs = pgTable("audit_logs", {
  id: text("id").primaryKey(),
  actorUserId: text("actor_user_id").references(() => users.id),
  eventId: text("event_id").references(() => events.id),
  moduleType: text("module_type").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id"),
  action: text("action").notNull(),
  reason: text("reason"),
  beforeJson: text("before_json"),
  afterJson: text("after_json"),
  ipAddress: text("ip_address"),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("audit_logs_event_created_idx").on(table.eventId, table.createdAt),
  index("audit_logs_actor_idx").on(table.actorUserId, table.createdAt),
]);