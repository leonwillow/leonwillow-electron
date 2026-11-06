/**
 * @file 笔录案件、询问内容与个人常用询问人的持久化定义。
 * 创建时间：2026-11-04；修改时间：2026-11-05。
 * 版本作用：独立于资金案件；内容按案件所有者隔离，修订号防止覆盖。
 * 被调用：schema 出口、inquiries 服务、Drizzle 迁移；调用：pg-core、认证 user 表。
 * 功能与预期结果：kind 区分多笔录文件夹和独立笔录容器，归档和标记删除保留原资料。
 */
import {
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export type InquiryContent = {
	inquiryStartAt: string;
	inquiryEndAt: string;
	inquiryCount: number;
	inquiryLocation: string;
	enforcementUnitName: string;
	inquirers: {
		id: string;
		name: string;
		badgeNumber: string;
		isRecorder: boolean;
	}[];
	subjectName: string;
	subjectGender: string;
	subjectAge: string;
	subjectIdType: string;
	subjectIdNumber: string;
	subjectAddress: string;
	subjectPhone: string;
	subjectOrg: string;
	subjectPosition: string;
	subjectRelationship: string;
	subjectRelationshipOther: string;
	qaItems: { id: string; question: string; answer: string }[];
};

export const inquiryCase = pgTable(
	"inquiry_case",
	{
		id: text("id").primaryKey(),
		ownerId: text("owner_id")
			.notNull()
			.references(() => user.id),
		name: text("name").notNull(),
		kind: text("kind")
			.$type<"folder" | "standalone">()
			.notNull()
			.default("folder"),
		archived: boolean("archived").notNull().default(false),
		revision: integer("revision").notNull().default(1),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
		deletedAt: timestamp("deleted_at"),
		deletedBy: text("deleted_by").references(() => user.id),
	},
	(table) => [
		index("inquiry_case_owner_idx").on(table.ownerId, table.updatedAt),
	],
);

export const inquiryRecord = pgTable(
	"inquiry_record",
	{
		id: text("id").primaryKey(),
		caseId: text("case_id")
			.notNull()
			.references(() => inquiryCase.id),
		title: text("title").notNull(),
		archived: boolean("archived").notNull().default(false),
		content: jsonb("content").$type<InquiryContent>().notNull(),
		revision: integer("revision").notNull().default(1),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
		deletedAt: timestamp("deleted_at"),
		deletedBy: text("deleted_by").references(() => user.id),
	},
	(table) => [
		index("inquiry_record_case_idx").on(table.caseId, table.updatedAt),
	],
);

export const inquiryInquirer = pgTable(
	"inquiry_inquirer",
	{
		id: text("id").primaryKey(),
		ownerId: text("owner_id")
			.notNull()
			.references(() => user.id),
		name: text("name").notNull(),
		badgeNumber: text("badge_number").notNull(),
		deletedAt: timestamp("deleted_at"),
		deletedBy: text("deleted_by").references(() => user.id),
		revision: integer("revision").notNull().default(1),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex("inquiry_inquirer_owner_badge_unique").on(
			table.ownerId,
			table.badgeNumber,
		),
	],
);
