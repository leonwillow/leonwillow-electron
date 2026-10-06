CREATE TABLE "funds_inclusion" (
	"id" text PRIMARY KEY,
	"case_id" text NOT NULL,
	"origin_case_id" text NOT NULL,
	"origin_revision" integer NOT NULL,
	"account" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"actor_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funds_job" (
	"id" text PRIMARY KEY,
	"case_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"mode" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"stage" text DEFAULT 'queued' NOT NULL,
	"completed_files" integer DEFAULT 0 NOT NULL,
	"total_files" integer DEFAULT 0 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"lease_owner" text,
	"lease_until" timestamp,
	"next_run_at" timestamp DEFAULT now() NOT NULL,
	"error" text DEFAULT '' NOT NULL,
	"result" jsonb,
	"events" jsonb DEFAULT '[]' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funds_job_file" (
	"id" text PRIMARY KEY,
	"job_id" text NOT NULL,
	"ordinal" integer NOT NULL,
	"name" text NOT NULL,
	"bytes_base64" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"standard_csv" text,
	"parsed" jsonb,
	"report" jsonb
);
--> statement-breakpoint
CREATE TABLE "funds_transaction" (
	"case_id" text,
	"id" text,
	"revision" integer NOT NULL,
	"from_account" text NOT NULL,
	"to_account" text NOT NULL,
	"data" jsonb NOT NULL,
	CONSTRAINT "funds_transaction_pkey" PRIMARY KEY("case_id","id")
);
--> statement-breakpoint
ALTER TABLE "funds_source" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "funds_source" ADD COLUMN "inclusion_id" text;--> statement-breakpoint
CREATE INDEX "funds_job_queue_idx" ON "funds_job" ("status","next_run_at");--> statement-breakpoint
CREATE INDEX "funds_job_case_idx" ON "funds_job" ("case_id");--> statement-breakpoint
ALTER TABLE "funds_inclusion" ADD CONSTRAINT "funds_inclusion_case_id_funds_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "funds_case"("id");--> statement-breakpoint
ALTER TABLE "funds_inclusion" ADD CONSTRAINT "funds_inclusion_origin_case_id_funds_case_id_fkey" FOREIGN KEY ("origin_case_id") REFERENCES "funds_case"("id");--> statement-breakpoint
ALTER TABLE "funds_inclusion" ADD CONSTRAINT "funds_inclusion_actor_id_user_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "funds_job" ADD CONSTRAINT "funds_job_case_id_funds_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "funds_case"("id");--> statement-breakpoint
ALTER TABLE "funds_job" ADD CONSTRAINT "funds_job_actor_id_user_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "funds_job_file" ADD CONSTRAINT "funds_job_file_job_id_funds_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "funds_job"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "funds_transaction" ADD CONSTRAINT "funds_transaction_case_id_funds_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "funds_case"("id");