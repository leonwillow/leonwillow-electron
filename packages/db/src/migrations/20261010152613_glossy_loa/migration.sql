CREATE TABLE "document_record" (
	"id" text PRIMARY KEY,
	"type_id" text NOT NULL,
	"template_version" integer NOT NULL,
	"type_name" text NOT NULL,
	"year" integer NOT NULL,
	"sequence" integer NOT NULL,
	"document_number" text NOT NULL,
	"subject" text NOT NULL,
	"values" jsonb NOT NULL,
	"owner_id" text NOT NULL,
	"owner_name" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE "document_revision" (
	"record_id" text,
	"revision" integer,
	"subject" text NOT NULL,
	"values" jsonb NOT NULL,
	"actor_id" text NOT NULL,
	"actor_name" text NOT NULL,
	"action" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "document_revision_pkey" PRIMARY KEY("record_id","revision")
);
--> statement-breakpoint
CREATE TABLE "document_sequence" (
	"type_id" text,
	"year" integer,
	"last_number" integer NOT NULL,
	CONSTRAINT "document_sequence_pkey" PRIMARY KEY("type_id","year")
);
--> statement-breakpoint
CREATE TABLE "document_template" (
	"type_id" text,
	"version" integer,
	"file_name" text NOT NULL,
	"bytes_base64" text NOT NULL,
	"fields" jsonb NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "document_template_pkey" PRIMARY KEY("type_id","version")
);
--> statement-breakpoint
CREATE TABLE "document_type" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"prefix" text NOT NULL,
	"current_version" integer NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"deleted_by" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX "document_record_number_unique" ON "document_record" ("type_id","year","sequence");--> statement-breakpoint
CREATE INDEX "document_record_created_idx" ON "document_record" ("created_at");--> statement-breakpoint
ALTER TABLE "document_record" ADD CONSTRAINT "document_record_type_id_document_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "document_type"("id");--> statement-breakpoint
ALTER TABLE "document_record" ADD CONSTRAINT "document_record_owner_id_user_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "document_revision" ADD CONSTRAINT "document_revision_record_id_document_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "document_record"("id");--> statement-breakpoint
ALTER TABLE "document_revision" ADD CONSTRAINT "document_revision_actor_id_user_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "document_sequence" ADD CONSTRAINT "document_sequence_type_id_document_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "document_type"("id");--> statement-breakpoint
ALTER TABLE "document_template" ADD CONSTRAINT "document_template_type_id_document_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "document_type"("id");--> statement-breakpoint
ALTER TABLE "document_template" ADD CONSTRAINT "document_template_created_by_user_id_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "document_type" ADD CONSTRAINT "document_type_created_by_user_id_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id");