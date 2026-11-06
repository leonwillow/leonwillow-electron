CREATE TABLE "late_fee_scenario" (
	"id" text PRIMARY KEY,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"cutoff" text NOT NULL,
	"liabilities" jsonb NOT NULL,
	"result" jsonb NOT NULL,
	"rules_version" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"deleted_by" text
);
--> statement-breakpoint
CREATE INDEX "late_fee_scenario_owner_idx" ON "late_fee_scenario" ("owner_id","updated_at");--> statement-breakpoint
ALTER TABLE "late_fee_scenario" ADD CONSTRAINT "late_fee_scenario_owner_id_user_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "late_fee_scenario" ADD CONSTRAINT "late_fee_scenario_deleted_by_user_id_fkey" FOREIGN KEY ("deleted_by") REFERENCES "user"("id");