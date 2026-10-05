CREATE TABLE "access_audit" (
	"id" text PRIMARY KEY,
	"actor_id" text NOT NULL,
	"actor_name" text NOT NULL,
	"target_id" text NOT NULL,
	"target_name" text NOT NULL,
	"action" text NOT NULL,
	"before" jsonb,
	"after" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_module_access" (
	"user_id" text,
	"module_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_module_access_pkey" PRIMARY KEY("user_id","module_id")
);
--> statement-breakpoint
CREATE INDEX "access_audit_created_at_idx" ON "access_audit" ("created_at");--> statement-breakpoint
ALTER TABLE "user_module_access" ADD CONSTRAINT "user_module_access_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;