ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "player_code" text;
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "nickname" text;
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "wechat_id" text;
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "mentor_name" text;
--> statement-breakpoint
UPDATE "players" SET "player_code" = upper(substr(md5("id"), 1, 6)) WHERE "player_code" IS NULL OR btrim("player_code") = '';
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "players_player_code_unique" ON "players" USING btree ("player_code") WHERE "player_code" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "players_phone_idx" ON "players" USING btree ("phone");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "players_identity_last4_idx" ON "players" USING btree ("identity_no_last4");
