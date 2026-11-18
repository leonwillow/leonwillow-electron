CREATE INDEX "document_record_type_created_idx" ON "document_record" ("type_id","created_at");--> statement-breakpoint
CREATE INDEX "funds_case_owner_order_idx" ON "funds_case" ("owner_id","sort_order","created_at");--> statement-breakpoint
CREATE INDEX "funds_inclusion_case_idx" ON "funds_inclusion" ("case_id");--> statement-breakpoint
CREATE INDEX "funds_inclusion_origin_idx" ON "funds_inclusion" ("origin_case_id");--> statement-breakpoint
CREATE INDEX "funds_job_file_job_ordinal_idx" ON "funds_job_file" ("job_id","ordinal");