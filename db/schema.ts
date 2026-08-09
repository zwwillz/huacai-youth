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
  name: text("name").notNull(),
  relationship: text("relationship"),
  phone: text("phone"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("guardians_player_idx").on(table.playerId)]);

export const registrations = pgTable("registrations", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => events.id),
  groupId: text("group_id").notNull().references(() => eventGroups.id),
  playerId: text("player_id").notNull().references(() => players.id),
  source: text("source").notNull().default("admin"),
  paymentStatus: text("payment_status").notNull().default("pending"),
  status: text("status").notNull().default("pending"),
  submittedAt: text("submitted_at").notNull(),
  reviewedBy: text("reviewed_by").references(() => users.id),
  reviewedAt: text("reviewed_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("registrations_unique").on(table.eventId, table.groupId, table.playerId),
  index("registrations_event_status_idx").on(table.eventId, table.status),
]);

export const publications = pgTable("publications", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => events.id),
  moduleType: text("module_type").notNull(),
  moduleTitle: text("module_title").notNull(),
  versionNo: integer("version_no").notNull().default(1),
  status: text("status").notNull().default("draft"),
  publishedBy: text("published_by").references(() => users.id),
  publishedAt: text("published_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("publications_event_module_unique").on(table.eventId, table.moduleType),
  index("publications_status_idx").on(table.status),
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
});

export const adminLoginAttempts = pgTable("admin_login_attempts", {
  id: text("id").primaryKey(),
  username: text("username").notNull(),
  ipAddress: text("ip_address").notNull(),
  succeeded: boolean("succeeded").notNull().default(false),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("admin_login_attempts_lookup_idx").on(table.username, table.ipAddress, table.createdAt),
]);

export const competitionSeedEntries = pgTable("competition_seed_entries", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => events.id),
  groupId: text("group_id").notNull().references(() => eventGroups.id),
  phaseCode: text("phase_code").notNull(),
  playerId: text("player_id").notNull().references(() => players.id),
  seedNo: integer("seed_no").notNull(),
  source: text("source").notNull().default("manual"),
  note: text("note"),
  createdBy: text("created_by").references(() => users.id),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("competition_seed_event_group_phase_player_unique").on(table.eventId, table.groupId, table.phaseCode, table.playerId),
  uniqueIndex("competition_seed_event_group_phase_no_unique").on(table.eventId, table.groupId, table.phaseCode, table.seedNo),
  index("competition_seed_event_group_phase_idx").on(table.eventId, table.groupId, table.phaseCode),
]);

export const drawSessions = pgTable("draw_sessions", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => events.id),
  groupId: text("group_id").notNull().references(() => eventGroups.id),
  phaseId: text("phase_id").notNull().references(() => eventPhases.id),
  phaseCode: text("phase_code").notNull(),
  participantCount: integer("participant_count").notNull().default(0),
  slotCount: integer("slot_count").notNull().default(0),
  seedMode: text("seed_mode").notNull().default("none"),
  randomSeed: text("random_seed"),
  status: text("status").notNull().default("draft"),
  versionNo: integer("version_no").notNull().default(1),
  lockedAt: text("locked_at"),
  publishedAt: text("published_at"),
  createdBy: text("created_by").references(() => users.id),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("draw_sessions_scope_unique").on(table.eventId, table.groupId, table.phaseId),
  index("draw_sessions_scope_idx").on(table.eventId, table.groupId, table.phaseCode, table.status),
]);

export const drawParticipants = pgTable("draw_participants", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => drawSessions.id),
  playerId: text("player_id").references(() => players.id),
  displayName: text("display_name").notNull(),
  seedNo: integer("seed_no"),
  isSeed: boolean("is_seed").notNull().default(false),
  source: text("source").notNull(),
  sourceRank: integer("source_rank"),
  createdAt: text("created_at").notNull(),
}, (table) => [index("draw_participants_session_idx").on(table.sessionId)]);

export const drawSlots = pgTable("draw_slots", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => drawSessions.id),
  slotNo: integer("slot_no").notNull(),
  playerId: text("player_id").references(() => players.id),
  displayName: text("display_name").notNull(),
  seedNo: integer("seed_no"),
  isSeed: boolean("is_seed").notNull().default(false),
  manuallyAdjusted: boolean("manually_adjusted").notNull().default(false),
  updatedBy: text("updated_by").references(() => users.id),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("draw_slots_session_slot_unique").on(table.sessionId, table.slotNo),
  index("draw_slots_session_idx").on(table.sessionId),
]);

export const drawPrelimMatches = pgTable("draw_prelim_matches", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => drawSessions.id),
  matchNo: integer("match_no").notNull(),
  slotA: integer("slot_a").notNull(),
  slotB: integer("slot_b").notNull(),
  participantAId: text("participant_a_id").references(() => players.id),
  participantBId: text("participant_b_id").references(() => players.id),
  displayNameA: text("display_name_a").notNull(),
  displayNameB: text("display_name_b").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("draw_prelim_matches_session_match_unique").on(table.sessionId, table.matchNo),
  index("draw_prelim_matches_session_idx").on(table.sessionId),
]);

export const competitionPhaseSettings = pgTable("competition_phase_settings", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => events.id),
  groupId: text("group_id").notNull().references(() => eventGroups.id),
  phaseCode: text("phase_code").notNull(),
  phaseTitle: text("phase_title").notNull(),
  entryCount: integer("entry_count").notNull().default(0),
  advanceCount: integer("advance_count").notNull().default(0),
  targetSize: integer("target_size").notNull().default(0),
  startLabel: text("start_label"),
  raceTo: text("race_to"),
  lockedAt: text("locked_at"),
  updatedBy: text("updated_by").references(() => users.id),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("competition_phase_settings_scope_unique").on(table.eventId, table.groupId, table.phaseCode),
  index("competition_phase_settings_scope_idx").on(table.eventId, table.groupId, table.phaseCode),
]);

export const competitionQualificationBatches = pgTable("competition_qualification_batches", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => events.id),
  groupId: text("group_id").notNull().references(() => eventGroups.id),
  phaseCode: text("phase_code").notNull(),
  sourcePhaseCode: text("source_phase_code"),
  ruleKey: text("rule_key").notNull(),
  status: text("status").notNull().default("draft"),
  generatedCount: integer("generated_count").notNull().default(0),
  confirmedAt: text("confirmed_at"),
  createdBy: text("created_by").references(() => users.id),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("competition_qualification_batches_scope_idx").on(table.eventId, table.groupId, table.phaseCode, table.status),
]);

export const competitionQualificationEntries = pgTable("competition_qualification_entries", {
  id: text("id").primaryKey(),
  batchId: text("batch_id").notNull().references(() => competitionQualificationBatches.id),
  eventId: text("event_id").notNull().references(() => events.id),
  groupId: text("group_id").notNull().references(() => eventGroups.id),
  phaseCode: text("phase_code").notNull(),
  playerId: text("player_id").notNull().references(() => players.id),
  displayName: text("display_name").notNull(),
  source: text("source").notNull(),
  sourceRank: integer("source_rank"),
  sourceMatchId: text("source_match_id"),
  note: text("note"),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("competition_qualification_entries_batch_player_unique").on(table.batchId, table.playerId),
  index("competition_qualification_entries_scope_idx").on(table.eventId, table.groupId, table.phaseCode),
]);

export const competitionEventTables = pgTable("competition_event_tables", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => events.id),
  tableNo: integer("table_no").notNull(),
  tableLabel: text("table_label").notNull(),
  isTv: boolean("is_tv").notNull().default(false),
  isEnabled: boolean("is_enabled").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  updatedBy: text("updated_by").references(() => users.id),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("competition_event_tables_event_no_unique").on(table.eventId, table.tableNo),
  index("competition_event_tables_event_enabled_idx").on(table.eventId, table.isEnabled, table.sortOrder),
]);

export const competitionTimeSlots = pgTable("competition_time_slots", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => events.id),
  groupId: text("group_id").references(() => eventGroups.id),
  phaseCode: text("phase_code").notNull(),
  dateLabel: text("date_label").notNull(),
  startTime: text("start_time").notNull(),
  roundLabel: text("round_label"),
  capacity: integer("capacity"),
  sortOrder: integer("sort_order").notNull().default(0),
  isEnabled: boolean("is_enabled").notNull().default(true),
  updatedBy: text("updated_by").references(() => users.id),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("competition_time_slots_scope_idx").on(table.eventId, table.phaseCode, table.dateLabel, table.sortOrder),
]);

export const competitionSchedules = pgTable("competition_schedules", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => events.id),
  groupId: text("group_id").notNull().references(() => eventGroups.id),
  phaseCode: text("phase_code").notNull(),
  sourceType: text("source_type").notNull(),
  sourceId: text("source_id").notNull(),
  versionNo: integer("version_no").notNull().default(1),
  status: text("status").notNull().default("draft"),
  generatedAt: text("generated_at"),
  lockedAt: text("locked_at"),
  publishedAt: text("published_at"),
  createdBy: text("created_by").references(() => users.id),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("competition_schedules_scope_idx").on(table.eventId, table.groupId, table.phaseCode, table.status),
]);

export const competitionMatchSchedules = pgTable("competition_match_schedules", {
  id: text("id").primaryKey(),
  scheduleId: text("schedule_id").notNull().references(() => competitionSchedules.id),
  eventId: text("event_id").notNull().references(() => events.id),
  groupId: text("group_id").notNull().references(() => eventGroups.id),
  phaseCode: text("phase_code").notNull(),
  sourceMatchId: text("source_match_id").notNull(),
  matchCode: text("match_code").notNull(),
  playerAId: text("player_a_id").references(() => players.id),
  playerBId: text("player_b_id").references(() => players.id),
  playerAName: text("player_a_name").notNull().default(""),
  playerBName: text("player_b_name").notNull().default(""),
  dateLabel: text("date_label"),
  startTime: text("start_time"),
  tableNo: integer("table_no"),
  tableLabel: text("table_label"),
  isTv: boolean("is_tv").notNull().default(false),
  status: text("status").notNull().default("scheduled"),
  updatedBy: text("updated_by").references(() => users.id),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("competition_match_schedules_schedule_source_unique").on(table.scheduleId, table.sourceMatchId),
  index("competition_match_schedules_scope_idx").on(table.eventId, table.groupId, table.phaseCode, table.dateLabel, table.startTime),
]);

export const competitionBrackets = pgTable("competition_brackets", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => events.id),
  groupId: text("group_id").notNull().references(() => eventGroups.id),
  phaseCode: text("phase_code").notNull(),
  sourceSessionId: text("source_session_id").notNull(),
  status: text("status").notNull().default("draft"),
  versionNo: integer("version_no").notNull().default(1),
  publishedAt: text("published_at"),
  createdBy: text("created_by").references(() => users.id),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("competition_brackets_scope_unique").on(table.eventId, table.groupId, table.phaseCode),
  index("competition_brackets_scope_idx").on(table.eventId, table.groupId, table.phaseCode, table.status),
]);

export const competitionBracketMatches = pgTable("competition_bracket_matches", {
  id: text("id").primaryKey(),
  bracketId: text("bracket_id").notNull().references(() => competitionBrackets.id),
  eventId: text("event_id").notNull().references(() => events.id),
  groupId: text("group_id").notNull().references(() => eventGroups.id),
  phaseCode: text("phase_code").notNull(),
  matchCode: text("match_code").notNull(),
  branch: text("branch").notNull(),
  roundNo: integer("round_no").notNull(),
  roundLabel: text("round_label").notNull(),
  orderNo: integer("order_no").notNull(),
  sourceSlotA: integer("source_slot_a"),
  sourceSlotB: integer("source_slot_b"),
  sourceMatchA: text("source_match_a"),
  sourceMatchB: text("source_match_b"),
  sourceTypeA: text("source_type_a"),
  sourceTypeB: text("source_type_b"),
  playerAId: text("player_a_id").references(() => players.id),
  playerBId: text("player_b_id").references(() => players.id),
  playerAName: text("player_a_name").notNull().default(""),
  playerBName: text("player_b_name").notNull().default(""),
  winnerId: text("winner_id").references(() => players.id),
  loserId: text("loser_id").references(() => players.id),
  scoreA: text("score_a"),
  scoreB: text("score_b"),
  status: text("status").notNull().default("pending"),
  isEntry: boolean("is_entry").notNull().default(false),
  isQualificationMatch: boolean("is_qualification_match").notNull().default(false),
  updatedBy: text("updated_by").references(() => users.id),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("competition_bracket_matches_bracket_code_unique").on(table.bracketId, table.matchCode),
  index("competition_bracket_matches_scope_idx").on(table.eventId, table.groupId, table.phaseCode, table.branch, table.roundNo),
]);

export const competitionMainRosterLocks = pgTable("competition_main_roster_locks", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => events.id),
  groupId: text("group_id").notNull().references(() => eventGroups.id),
  targetPhaseCode: text("target_phase_code").notNull(),
  targetSize: integer("target_size").notNull(),
  status: text("status").notNull().default("draft"),
  lockedAt: text("locked_at"),
  unlockedAt: text("unlocked_at"),
  unlockReason: text("unlock_reason"),
  updatedBy: text("updated_by").references(() => users.id),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("competition_main_roster_locks_scope_unique").on(table.eventId, table.groupId, table.targetPhaseCode),
  index("competition_main_roster_locks_status_idx").on(table.eventId, table.status),
]);

export const competitionMainAdvancementBatches = pgTable("competition_main_advancement_batches", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => events.id),
  groupId: text("group_id").notNull().references(() => eventGroups.id),
  sourcePhaseCode: text("source_phase_code").notNull(),
  targetPhaseCode: text("target_phase_code").notNull(),
  status: text("status").notNull().default("draft"),
  sourceType: text("source_type").notNull(),
  expectedCount: integer("expected_count").notNull().default(0),
  generatedCount: integer("generated_count").notNull().default(0),
  confirmedAt: text("confirmed_at"),
  updatedBy: text("updated_by").references(() => users.id),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("competition_main_advancement_batches_scope_idx").on(table.eventId, table.groupId, table.targetPhaseCode, table.status)]);

export const competitionFinalRankingBatches = pgTable("competition_final_ranking_batches", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => events.id),
  groupId: text("group_id").notNull().references(() => eventGroups.id),
  phaseCode: text("phase_code").notNull(),
  status: text("status").notNull().default("draft"),
  entryCount: integer("entry_count").notNull().default(0),
  generatedCount: integer("generated_count").notNull().default(0),
  confirmedAt: text("confirmed_at"),
  updatedBy: text("updated_by").references(() => users.id),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("competition_final_ranking_batches_scope_idx").on(table.eventId, table.groupId, table.phaseCode, table.status)]);

export const publicationDraftSnapshots = pgTable("publication_draft_snapshots", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => events.id),
  moduleType: text("module_type").notNull(),
  payloadJson: text("payload_json").notNull(),
  versionNo: integer("version_no").notNull().default(1),
  savedBy: text("saved_by").references(() => users.id),
  savedAt: text("saved_at").notNull(),
  publishedVersionNo: integer("published_version_no"),
}, (table) => [
  uniqueIndex("publication_draft_snapshots_scope_unique").on(table.eventId, table.moduleType),
  index("publication_draft_snapshots_saved_idx").on(table.eventId, table.savedAt),
]);

export const adminLoginAttemptsExtra = pgTable("admin_login_attempts_extra", {
  id: text("id").primaryKey(),
  username: text("username").notNull(),
  ipAddress: text("ip_address").notNull(),
  successful: boolean("successful").notNull().default(false),
  createdAt: text("created_at").notNull(),
});

export const playerPointsRules = pgTable("player_points_rules", {
  id: text("id").primaryKey(),
  year: integer("year").notNull(),
  participationPoints: integer("participation_points").notNull().default(1),
  prizeUnitYuan: integer("prize_unit_yuan").notNull().default(100),
  prizePointsPerUnit: integer("prize_points_per_unit").notNull().default(1),
  publishedStatus: text("published_status").notNull().default("draft"),
  rulesText: text("rules_text"),
  calculationNote: text("calculation_note"),
  updatedBy: text("updated_by").references(() => users.id),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("player_points_rules_year_unique").on(table.year)]);
