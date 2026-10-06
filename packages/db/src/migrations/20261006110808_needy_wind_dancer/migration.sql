ALTER TABLE "funds_case" ADD COLUMN "pinned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "funds_case" ADD COLUMN "archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "funds_job_file" ADD COLUMN "file_ref" jsonb;--> statement-breakpoint
ALTER TABLE "funds_source" ADD COLUMN "file_ref" jsonb;--> statement-breakpoint
ALTER TABLE "funds_job_file" ALTER COLUMN "bytes_base64" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "funds_source" ALTER COLUMN "bytes_base64" DROP NOT NULL;