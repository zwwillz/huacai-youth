CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_user_id` text,
	`event_id` text,
	`module_type` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text,
	`action` text NOT NULL,
	`reason` text,
	`before_json` text,
	`after_json` text,
	`ip_address` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_logs_event_created_idx` ON `audit_logs` (`event_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_logs_actor_idx` ON `audit_logs` (`actor_user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `event_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`document_type` text NOT NULL,
	`title` text NOT NULL,
	`file_key` text,
	`external_url` text,
	`version_no` integer DEFAULT 1 NOT NULL,
	`is_published` integer DEFAULT false NOT NULL,
	`published_at` text,
	`created_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `event_documents_event_type_idx` ON `event_documents` (`event_id`,`document_type`);--> statement-breakpoint
CREATE TABLE `event_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`birth_date_from` text,
	`birth_date_to` text,
	`minimum_age` integer,
	`registration_fee_cents` integer DEFAULT 0 NOT NULL,
	`registration_limit` integer,
	`main_draw_size` integer,
	`rules_json` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_groups_code_unique` ON `event_groups` (`event_id`,`code`);--> statement-breakpoint
CREATE INDEX `event_groups_event_idx` ON `event_groups` (`event_id`);--> statement-breakpoint
CREATE TABLE `event_guides` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`guide_type` text NOT NULL,
	`title` text NOT NULL,
	`content_type` text DEFAULT 'article' NOT NULL,
	`body` text,
	`file_key` text,
	`external_url` text,
	`publish_status` text DEFAULT 'draft' NOT NULL,
	`published_at` text,
	`created_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_guides_unique` ON `event_guides` (`event_id`,`guide_type`);--> statement-breakpoint
CREATE INDEX `event_guides_event_idx` ON `event_guides` (`event_id`);--> statement-breakpoint
CREATE TABLE `event_members` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_members_unique` ON `event_members` (`event_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `event_members_role_idx` ON `event_members` (`event_id`,`role`);--> statement-breakpoint
CREATE TABLE `event_organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`organization_type` text NOT NULL,
	`organization_name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `event_organizations_event_idx` ON `event_organizations` (`event_id`);--> statement-breakpoint
CREATE TABLE `event_sponsors` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`name` text NOT NULL,
	`sponsor_type` text DEFAULT 'sponsor' NOT NULL,
	`logo_key` text,
	`website_url` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_published` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `event_sponsors_event_idx` ON `event_sponsors` (`event_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`series_id` text NOT NULL,
	`year` integer NOT NULL,
	`station_no` integer NOT NULL,
	`full_title` text NOT NULL,
	`short_title` text NOT NULL,
	`slug` text NOT NULL,
	`city` text NOT NULL,
	`venue_id` text,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`registration_start_at` text,
	`registration_end_at` text,
	`cover_image_key` text,
	`summary` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`publish_status` text DEFAULT 'draft' NOT NULL,
	`published_at` text,
	`created_by` text,
	`updated_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`series_id`) REFERENCES `series`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_slug_unique` ON `events` (`slug`);--> statement-breakpoint
CREATE INDEX `events_year_station_idx` ON `events` (`year`,`station_no`);--> statement-breakpoint
CREATE INDEX `events_status_idx` ON `events` (`status`,`publish_status`);--> statement-breakpoint
CREATE TABLE `guardians` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`full_name` text NOT NULL,
	`relationship` text NOT NULL,
	`phone` text NOT NULL,
	`email` text,
	`is_primary` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `guardians_player_idx` ON `guardians` (`player_id`);--> statement-breakpoint
CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`full_name` text NOT NULL,
	`gender` text,
	`birth_date` text,
	`province` text,
	`city` text,
	`club_name` text,
	`school_name` text,
	`phone` text,
	`email` text,
	`avatar_key` text,
	`identity_no_masked` text,
	`profile_status` text DEFAULT 'pending' NOT NULL,
	`merged_into_player_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `players_name_idx` ON `players` (`full_name`);--> statement-breakpoint
CREATE INDEX `players_birth_date_idx` ON `players` (`birth_date`);--> statement-breakpoint
CREATE TABLE `publications` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`module_type` text NOT NULL,
	`module_title` text NOT NULL,
	`version_no` integer DEFAULT 1 NOT NULL,
	`snapshot_json` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`published_by` text,
	`published_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`published_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `publications_module_unique` ON `publications` (`event_id`,`module_type`);--> statement-breakpoint
CREATE INDEX `publications_status_idx` ON `publications` (`event_id`,`status`);--> statement-breakpoint
CREATE TABLE `registrations` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`group_id` text NOT NULL,
	`player_id` text NOT NULL,
	`source` text DEFAULT 'player' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`fee_status` text DEFAULT 'unpaid' NOT NULL,
	`fee_amount_cents` integer DEFAULT 0 NOT NULL,
	`submitted_at` text NOT NULL,
	`reviewed_by` text,
	`reviewed_at` text,
	`review_note` text,
	`withdrawal_reason` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`group_id`) REFERENCES `event_groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `registrations_unique` ON `registrations` (`event_id`,`group_id`,`player_id`);--> statement-breakpoint
CREATE INDEX `registrations_review_idx` ON `registrations` (`event_id`,`status`);--> statement-breakpoint
CREATE TABLE `series` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`short_name` text,
	`organizer_name` text,
	`logo_key` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text DEFAULT 'referee' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`last_login_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_role_idx` ON `users` (`role`);--> statement-breakpoint
CREATE TABLE `venues` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`province` text,
	`city` text,
	`district` text,
	`address` text,
	`contact_name` text,
	`contact_phone` text,
	`table_count` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
