ALTER TABLE "jobs" ADD COLUMN "applied_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "status_changed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "last_follow_up_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "follow_up_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- M10 data migration: the retired 'dismissed' triage state merges into 'discarded'.
UPDATE "jobs" SET "status" = 'discarded' WHERE "status" = 'dismissed';