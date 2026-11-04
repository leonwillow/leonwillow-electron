ALTER TABLE "inquiry_case" ADD COLUMN "deleted_by" text;--> statement-breakpoint
ALTER TABLE "inquiry_inquirer" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "inquiry_inquirer" ADD COLUMN "deleted_by" text;--> statement-breakpoint
ALTER TABLE "inquiry_record" ADD COLUMN "deleted_by" text;--> statement-breakpoint
ALTER TABLE "inquiry_case" ADD CONSTRAINT "inquiry_case_deleted_by_user_id_fkey" FOREIGN KEY ("deleted_by") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "inquiry_inquirer" ADD CONSTRAINT "inquiry_inquirer_deleted_by_user_id_fkey" FOREIGN KEY ("deleted_by") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "inquiry_record" ADD CONSTRAINT "inquiry_record_deleted_by_user_id_fkey" FOREIGN KEY ("deleted_by") REFERENCES "user"("id");