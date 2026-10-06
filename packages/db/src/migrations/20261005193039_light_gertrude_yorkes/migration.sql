CREATE TABLE "funds_case" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"owner_id" text NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"graph_revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funds_revision" (
	"case_id" text,
	"revision" integer,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"decisions" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "funds_revision_pkey" PRIMARY KEY("case_id","revision")
);
--> statement-breakpoint
CREATE TABLE "funds_source" (
	"case_id" text,
	"id" text,
	"name" text NOT NULL,
	"bytes_base64" text NOT NULL,
	"parsed" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "funds_source_pkey" PRIMARY KEY("case_id","id")
);
--> statement-breakpoint
ALTER TABLE "funds_case" ADD CONSTRAINT "funds_case_owner_id_user_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "funds_revision" ADD CONSTRAINT "funds_revision_case_id_funds_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "funds_case"("id");--> statement-breakpoint
ALTER TABLE "funds_revision" ADD CONSTRAINT "funds_revision_actor_id_user_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "funds_source" ADD CONSTRAINT "funds_source_case_id_funds_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "funds_case"("id");