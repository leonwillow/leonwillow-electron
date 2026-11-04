CREATE TABLE "inquiry_case" (
	"id" text PRIMARY KEY,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "inquiry_inquirer" (
	"id" text PRIMARY KEY,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"badge_number" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inquiry_record" (
	"id" text PRIMARY KEY,
	"case_id" text NOT NULL,
	"title" text NOT NULL,
	"content" jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE INDEX "inquiry_case_owner_idx" ON "inquiry_case" ("owner_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "inquiry_inquirer_owner_badge_unique" ON "inquiry_inquirer" ("owner_id","badge_number");--> statement-breakpoint
CREATE INDEX "inquiry_record_case_idx" ON "inquiry_record" ("case_id","updated_at");--> statement-breakpoint
ALTER TABLE "inquiry_case" ADD CONSTRAINT "inquiry_case_owner_id_user_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "inquiry_inquirer" ADD CONSTRAINT "inquiry_inquirer_owner_id_user_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "inquiry_record" ADD CONSTRAINT "inquiry_record_case_id_inquiry_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "inquiry_case"("id");