CREATE EXTENSION IF NOT EXISTS pgcrypto;
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "identity_type" text;
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "identity_no_last4" text;
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "identity_unique_key" text;
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "identity_review_status" text DEFAULT 'missing' NOT NULL;
--> statement-breakpoint
WITH document_counts AS (
  SELECT upper(btrim(identity_no_masked)) AS normalized_no, count(*) AS n
  FROM "players"
  WHERE identity_no_masked IS NOT NULL AND btrim(identity_no_masked) <> ''
  GROUP BY upper(btrim(identity_no_masked))
)
UPDATE "players" p
SET
  identity_type = coalesce(p.identity_type, CASE WHEN length(btrim(p.identity_no_masked)) = 18 THEN 'id_card' ELSE 'passport' END),
  identity_no_last4 = upper(right(btrim(p.identity_no_masked), 4)),
  identity_unique_key = CASE
    WHEN dc.n = 1 THEN encode(digest((CASE WHEN length(btrim(p.identity_no_masked)) = 18 THEN 'id_card' ELSE 'passport' END) || ':' || upper(btrim(p.identity_no_masked)), 'sha256'), 'hex')
    ELSE NULL
  END,
  identity_review_status = CASE WHEN dc.n = 1 THEN 'imported' ELSE 'conflict' END
FROM document_counts dc
WHERE upper(btrim(p.identity_no_masked)) = dc.normalized_no;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "players_identity_unique_key_unique" ON "players" USING btree ("identity_unique_key") WHERE "identity_unique_key" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "players_identity_last4_idx" ON "players" USING btree ("identity_no_last4");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "players_profile_status_idx" ON "players" USING btree ("profile_status");