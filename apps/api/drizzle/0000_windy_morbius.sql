CREATE TABLE "job_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"fitness" integer NOT NULL,
	"reasons" text[],
	"model" text NOT NULL,
	"composite" double precision NOT NULL,
	"scored_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_scores_jobId_unique" UNIQUE("job_id")
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"source_job_id" text NOT NULL,
	"url" text NOT NULL,
	"apply_url" text,
	"title" text NOT NULL,
	"company" text NOT NULL,
	"location" text,
	"workplace_type" text,
	"posted_at" timestamp with time zone,
	"description" text,
	"salary_min" integer,
	"salary_max" integer,
	"employment_type" text,
	"seniority" text,
	"tags" text[],
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dedup_key" text NOT NULL,
	"duplicate_of_id" uuid,
	CONSTRAINT "jobs_source_source_job_id_unique" UNIQUE("source","source_job_id")
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"kind" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_polled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sources_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "job_scores" ADD CONSTRAINT "job_scores_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "jobs_dedup_key_idx" ON "jobs" USING btree ("dedup_key");--> statement-breakpoint
CREATE INDEX "jobs_posted_at_idx" ON "jobs" USING btree ("posted_at");