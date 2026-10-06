/**
 * @file 人员功能授权与管理员操作记录。
 * 创建时间：2026-10-04
 * 修改时间：2026-10-06
 * 版本作用：工作台权限基础表，与自动生成的认证表分开维护。
 * 被调用：schema 出口、数据库迁移、服务端 access/admin。
 * 调用：Drizzle、认证 user 表。
 * 功能：保存用户的功能授权和不含凭据的操作前后快照。
 * 预期结果：授权修改与审计在同一事务提交，不存储密码或会话令牌。
 */
import {
	index,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const userModuleAccess = pgTable(
	"user_module_access",
	{
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		moduleId: text("module_id").notNull(),
		deletedAt: timestamp("deleted_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [primaryKey({ columns: [table.userId, table.moduleId] })],
);

export type AccessSnapshot = {
	username: string;
	name: string;
	role: "admin" | "user";
	disabled: boolean;
	moduleIds: string[];
};

export const accessAudit = pgTable(
	"access_audit",
	{
		id: text("id").primaryKey(),
		actorId: text("actor_id").notNull(),
		actorName: text("actor_name").notNull(),
		targetId: text("target_id").notNull(),
		targetName: text("target_name").notNull(),
		action: text("action")
			.$type<"user.create" | "user.update" | "user.password-reset">()
			.notNull(),
		before: jsonb("before").$type<AccessSnapshot>(),
		after: jsonb("after").$type<AccessSnapshot>().notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [index("access_audit_created_at_idx").on(table.createdAt)],
);
