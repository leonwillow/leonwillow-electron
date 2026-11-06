/**
 * @file 增值税与滞纳金方案及权威计算快照的持久化定义。
 * 创建时间：2026-11-05；修改时间：2026-11-06。
 * 版本作用：方案按人员隔离，历史与调整分开存储，修订号阻止多窗口覆盖。
 * 被调用：Drizzle 迁移、计算器服务；调用：认证用户表、共享领域类型。
 * 预期结果：原始申报追加和校正由事务服务校验，保留计算版本与软删除字段。
 */
import type {
	Adjustments,
	Calculation,
	HistoryInput,
} from "@leonwillow-electron/calculators";
import type {
	LateFeeResult,
	TaxLiability,
} from "@leonwillow-electron/calculators/late-fees";
import {
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
export const vatScenario = pgTable(
	"vat_scenario",
	{
		id: text("id").primaryKey(),
		ownerId: text("owner_id")
			.notNull()
			.references(() => user.id),
		name: text("name").notNull(),
		archived: boolean("archived").notNull().default(false),
		source: text("source").notNull().default(""),
		history: jsonb("history").$type<HistoryInput[]>().notNull(),
		adjustments: jsonb("adjustments").$type<Adjustments>().notNull(),
		result: jsonb("result").$type<Calculation>().notNull(),
		rulesVersion: text("rules_version").notNull(),
		revision: integer("revision").notNull().default(1),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
		deletedAt: timestamp("deleted_at"),
		deletedBy: text("deleted_by").references(() => user.id),
	},
	(table) => [
		index("vat_scenario_owner_idx").on(table.ownerId, table.updatedAt),
	],
);

/** 独立滞纳金方案；录入与服务端计算快照一起提交，规则版本可追溯。 */
export const lateFeeScenario = pgTable(
	"late_fee_scenario",
	{
		id: text("id").primaryKey(),
		ownerId: text("owner_id")
			.notNull()
			.references(() => user.id),
		name: text("name").notNull(),
		archived: boolean("archived").notNull().default(false),
		cutoff: text("cutoff").notNull(),
		liabilities: jsonb("liabilities").$type<TaxLiability[]>().notNull(),
		result: jsonb("result").$type<LateFeeResult>().notNull(),
		rulesVersion: text("rules_version").notNull(),
		revision: integer("revision").notNull().default(1),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
		deletedAt: timestamp("deleted_at"),
		deletedBy: text("deleted_by").references(() => user.id),
	},
	(table) => [
		index("late_fee_scenario_owner_idx").on(table.ownerId, table.updatedAt),
	],
);
