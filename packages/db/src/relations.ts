/**
 * @file Drizzle 1.0 的手写认证关系。
 * 创建时间：2026-10-04（从 schema/auth.ts 提取）
 * 修改时间：2026-10-04
 * 版本作用：保持生成表与关系 API 的独立维护边界。
 * 被调用：数据库工厂、schema 出口；调用：Drizzle、schema/auth。
 * 功能：绑定账号、会话与凭据；预期结果：重新生成表定义不覆盖关系。
 */
import { defineRelations } from "drizzle-orm";
import { account, session, user } from "./schema/auth";

export const authRelations = defineRelations(
	{ user, session, account },
	(r) => ({
		user: { sessions: r.many.session(), accounts: r.many.account() },
		session: { user: r.one.user({ from: r.session.userId, to: r.user.id }) },
		account: { user: r.one.user({ from: r.account.userId, to: r.user.id }) },
	}),
);
