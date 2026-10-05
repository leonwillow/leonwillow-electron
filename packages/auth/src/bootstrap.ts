/**
 * @file 显式管理员初始化入口。
 * 创建时间：2026-10-04（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：服务端认证基础层，随工作区维护。
 * 被调用：apps/server/test/auth.test.ts、apps/server/src/init-admin.ts。
 * 调用：@leonwillow-electron/db、drizzle-orm、./index。
 * 功能：用事务锁串行化检查，通过认证库创建缺失的管理员。
 * 预期结果：多实例启动不重复创建，也不覆盖已有密码或角色。
 */
import type { Database } from "@leonwillow-electron/db";
import { account, user } from "@leonwillow-electron/db/schema";
import { and, eq, sql } from "drizzle-orm";
import type { Auth } from "./index";

// 仅受控管理命令调用；普通应用启动不创建账号。
/**
 * 显式初始化管理员；已有账号绝不重置密码或自动提权。
 * @param auth 使用目标数据库的认证实例，创建用户仍走官方 createUser。
 * @param db 与 auth 相同的数据库；事务锁用于串行化多个实例的初始化检查。
 * @param password 由操作者安全注入的 8～128 位初始密码，无默认值。
 * @returns 本次创建返回 true，已有完整管理员返回 false。
 * @throws 同名账号角色或凭据不完整，或数据库/创建操作失败。
 */
export async function initializeAdmin(
	auth: Auth,
	db: Database,
	password: string,
) {
	if (password.length < 8 || password.length > 128)
		throw new Error("初始管理员密码必须为 8～128 个字符。");
	return db.transaction(async (tx) => {
		// 多个服务同时启动时也只初始化一次，事务结束自动释放锁。
		await tx.execute(sql`select pg_advisory_xact_lock(1279607119, 1)`);
		const [existing] = await tx
			.select()
			.from(user)
			.where(eq(user.username, "admin"))
			.limit(1);
		if (existing) {
			const [credential] = await tx
				.select({ password: account.password })
				.from(account)
				.where(
					and(
						eq(account.userId, existing.id),
						eq(account.providerId, "credential"),
					),
				)
				.limit(1);
			if (existing.role !== "admin" || !credential?.password)
				throw new Error(
					"admin 账号已存在，但管理员角色或密码凭据不完整；初始化不会覆盖已有账号。",
				);
			return false;
		}
		await auth.api.createUser({
			body: {
				email: "admin@leonwillow.com",
				name: "管理员",
				password,
				role: "admin",
				data: { username: "admin", displayUsername: "admin" },
			},
		});
		return true;
	});
}
