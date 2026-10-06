/**
 * @file 流水案件、来源、规范交易、后台任务和跨案纳入的持久化表。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-06
 * 版本作用：v2 保存规范交易、任务租约和可重放快照，Neo4j 承担业务分析。
 * 被调用：schema 出口、funds 服务与 Worker；调用：Drizzle 和人员表。
 * 功能：按案件保存来源与交易，持久化任务进度及跨案纳入状态。
 * 预期结果：图不可用时原文和待投影版本仍可恢复；案件外键阻止孤立记录。
 */
import {
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

/** 案件内按原始字节 SHA-256 定位；关系库只保留对象引用及校验信息。 */
export type FundsFileRef = {
	bucket: string;
	key: string;
	sha256: string;
	size: number;
};

export const fundsCase = pgTable("funds_case", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	pinned: boolean("pinned").notNull().default(false),
	archived: boolean("archived").notNull().default(false),
	sortOrder: integer("sort_order").notNull().default(0),
	deletedAt: timestamp("deleted_at"),
	deletedBy: text("deleted_by").references(() => user.id),
	ownerId: text("owner_id")
		.notNull()
		.references(() => user.id),
	revision: integer("revision").notNull().default(0),
	graphRevision: integer("graph_revision").notNull().default(0),
	createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const fundsSource = pgTable(
	"funds_source",
	{
		caseId: text("case_id")
			.notNull()
			.references(() => fundsCase.id),
		id: text("id").notNull(),
		name: text("name").notNull(),
		bytesBase64: text("bytes_base64"),
		fileRef: jsonb("file_ref").$type<FundsFileRef>(),
		parsed: jsonb("parsed").notNull(),
		active: boolean("active").notNull().default(true),
		inclusionId: text("inclusion_id"),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(table) => [primaryKey({ columns: [table.caseId, table.id] })],
);

/** 持久任务与文件分离，进度更新不重写文件字节；租约用于进程退出后的恢复。 */
export const fundsJob = pgTable(
	"funds_job",
	{
		id: text("id").primaryKey(),
		caseId: text("case_id")
			.notNull()
			.references(() => fundsCase.id),
		actorId: text("actor_id")
			.notNull()
			.references(() => user.id),
		mode: text("mode").notNull(),
		status: text("status").notNull().default("queued"),
		stage: text("stage").notNull().default("queued"),
		completedFiles: integer("completed_files").notNull().default(0),
		totalFiles: integer("total_files").notNull().default(0),
		attempts: integer("attempts").notNull().default(0),
		leaseOwner: text("lease_owner"),
		leaseUntil: timestamp("lease_until"),
		nextRunAt: timestamp("next_run_at").notNull().defaultNow(),
		error: text("error").notNull().default(""),
		result: jsonb("result"),
		events: jsonb("events").notNull().default([]),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
	},
	(table) => [
		index("funds_job_queue_idx").on(table.status, table.nextRunAt),
		index("funds_job_case_idx").on(table.caseId),
	],
);

export const fundsJobFile = pgTable("funds_job_file", {
	id: text("id").primaryKey(),
	jobId: text("job_id")
		.notNull()
		.references(() => fundsJob.id, { onDelete: "cascade" }),
	ordinal: integer("ordinal").notNull(),
	name: text("name").notNull(),
	bytesBase64: text("bytes_base64"),
	fileRef: jsonb("file_ref").$type<FundsFileRef>(),
	status: text("status").notNull().default("queued"),
	standardCsv: text("standard_csv"),
	parsed: jsonb("parsed"),
	report: jsonb("report"),
});

/** 规范交易是关系库中的基础事实；图同步从该案已提交的规范版本生成。 */
export const fundsTransaction = pgTable(
	"funds_transaction",
	{
		caseId: text("case_id")
			.notNull()
			.references(() => fundsCase.id),
		id: text("id").notNull(),
		revision: integer("revision").notNull(),
		fromAccount: text("from_account").notNull(),
		toAccount: text("to_account").notNull(),
		data: jsonb("data").notNull(),
		deletedAt: timestamp("deleted_at"),
	},
	(table) => [primaryKey({ columns: [table.caseId, table.id] })],
);

/** 跨案纳入是一份明确范围的快照；排除只影响目标案件，不修改来源案件。 */
export const fundsInclusion = pgTable("funds_inclusion", {
	id: text("id").primaryKey(),
	caseId: text("case_id")
		.notNull()
		.references(() => fundsCase.id),
	originCaseId: text("origin_case_id")
		.notNull()
		.references(() => fundsCase.id),
	originRevision: integer("origin_revision").notNull(),
	account: text("account").notNull(),
	active: boolean("active").notNull().default(true),
	actorId: text("actor_id")
		.notNull()
		.references(() => user.id),
	createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const fundsRevision = pgTable(
	"funds_revision",
	{
		caseId: text("case_id")
			.notNull()
			.references(() => fundsCase.id),
		revision: integer("revision").notNull(),
		actorId: text("actor_id")
			.notNull()
			.references(() => user.id),
		action: text("action").notNull(),
		snapshot: jsonb("snapshot").notNull(),
		decisions: jsonb("decisions").notNull(),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(table) => [primaryKey({ columns: [table.caseId, table.revision] })],
);
