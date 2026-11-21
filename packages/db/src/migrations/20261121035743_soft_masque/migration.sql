DROP INDEX "document_record_created_idx";--> statement-breakpoint
CREATE INDEX "document_record_created_idx" ON "document_record" ("created_at") WHERE "deleted_at" is null;--> statement-breakpoint
DROP INDEX "document_record_type_created_idx";--> statement-breakpoint
CREATE INDEX "document_record_type_created_idx" ON "document_record" ("type_id","created_at") WHERE "deleted_at" is null;--> statement-breakpoint
DROP INDEX "inquiry_case_owner_idx";--> statement-breakpoint
CREATE INDEX "inquiry_case_owner_idx" ON "inquiry_case" ("owner_id","updated_at") WHERE "deleted_at" is null;--> statement-breakpoint
DROP INDEX "inquiry_inquirer_owner_badge_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "inquiry_inquirer_owner_badge_unique" ON "inquiry_inquirer" ("owner_id","badge_number") WHERE "deleted_at" is null;--> statement-breakpoint
DROP INDEX "inquiry_record_case_idx";--> statement-breakpoint
CREATE INDEX "inquiry_record_case_idx" ON "inquiry_record" ("case_id","updated_at") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "document_record_owner_created_idx" ON "document_record" ("owner_id","created_at") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "document_record_year_created_idx" ON "document_record" ("year","created_at") WHERE "deleted_at" is null;