/**
 * @file 文书类型、不可变模板、年度号码与文书版本的持久化定义。
 * 创建时间：2026-10-10；修改时间：2026-10-10。
 * 版本作用：按文书类型和年份分配号码，历史文书保留原模板与内容。
 * 被调用：schema 出口、documents 服务和迁移工具；调用：Drizzle、认证 user 表。
 * 功能与预期结果：数据库约束阻止重复号码，业务删除保留原行和已用序号。
 */
import {
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export type DocumentField = {
	key: string;
	label: string;
	kind: "text" | "textarea" | "date" | "time";
	required: boolean;
	defaultValue: string;
};

export const documentType = pgTable("document_type", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	prefix: text("prefix").notNull(),
	currentVersion: integer("current_version").notNull(),
	revision: integer("revision").default(1).notNull(),
	createdBy: text("created_by")
		.notNull()
		.references(() => user.id),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
	deletedAt: timestamp("deleted_at"),
	deletedBy: text("deleted_by"),
});

export const documentTemplate = pgTable(
	"document_template",
	{
		typeId: text("type_id")
			.notNull()
			.references(() => documentType.id),
		version: integer("version").notNull(),
		fileName: text("file_name").notNull(),
		bytesBase64: text("bytes_base64").notNull(),
		fields: jsonb("fields").$type<DocumentField[]>().notNull(),
		createdBy: text("created_by")
			.notNull()
			.references(() => user.id),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [primaryKey({ columns: [table.typeId, table.version] })],
);

export const documentSequence = pgTable(
	"document_sequence",
	{
		typeId: text("type_id")
			.notNull()
			.references(() => documentType.id),
		year: integer("year").notNull(),
		lastNumber: integer("last_number").notNull(),
	},
	(table) => [primaryKey({ columns: [table.typeId, table.year] })],
);

export const documentRecord = pgTable(
	"document_record",
	{
		id: text("id").primaryKey(),
		typeId: text("type_id")
			.notNull()
			.references(() => documentType.id),
		templateVersion: integer("template_version").notNull(),
		typeName: text("type_name").notNull(),
		year: integer("year").notNull(),
		sequence: integer("sequence").notNull(),
		documentNumber: text("document_number").notNull(),
		subject: text("subject").notNull(),
		values: jsonb("values").$type<Record<string, string>>().notNull(),
		ownerId: text("owner_id")
			.notNull()
			.references(() => user.id),
		ownerName: text("owner_name").notNull(),
		revision: integer("revision").default(1).notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
		deletedAt: timestamp("deleted_at"),
		deletedBy: text("deleted_by"),
	},
	(table) => [
		uniqueIndex("document_record_number_unique").on(
			table.typeId,
			table.year,
			table.sequence,
		),
		index("document_record_created_idx").on(table.createdAt),
	],
);

export const documentRevision = pgTable(
	"document_revision",
	{
		recordId: text("record_id")
			.notNull()
			.references(() => documentRecord.id),
		revision: integer("revision").notNull(),
		subject: text("subject").notNull(),
		values: jsonb("values").$type<Record<string, string>>().notNull(),
		actorId: text("actor_id")
			.notNull()
			.references(() => user.id),
		actorName: text("actor_name").notNull(),
		action: text("action").$type<"create" | "update" | "delete">().notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [primaryKey({ columns: [table.recordId, table.revision] })],
);
