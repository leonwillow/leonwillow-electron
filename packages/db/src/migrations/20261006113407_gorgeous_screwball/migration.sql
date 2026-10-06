ALTER TABLE "user_module_access" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "funds_case" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "funds_case" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "funds_case" ADD COLUMN "deleted_by" text;--> statement-breakpoint
ALTER TABLE "funds_transaction" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "funds_case" ADD CONSTRAINT "funds_case_deleted_by_user_id_fkey" FOREIGN KEY ("deleted_by") REFERENCES "user"("id");