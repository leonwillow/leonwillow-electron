/**
 * @file 认证运行时与表结构生成共用的规则。
 * 创建时间：未记录（现有文件尚无 Git 创建记录）
 * 修改时间：2026-10-04
 * 版本作用：服务端认证基础层，随工作区维护。
 * 被调用：packages/auth/src/cli.ts、packages/auth/src/index.ts。
 * 调用：better-auth。
 * 功能：配置账号插件、密码范围、会话、Cookie 与数据库限流。
 * 预期结果：生成工具与运行时采用相同插件字段。
 */
import type { BetterAuthOptions } from "better-auth";
import { admin, username } from "better-auth/plugins";

// 供运行时和官方 CLI 共用，生成 schema 不需要连接数据库。
export const authOptions = {
	basePath: "/api/auth",
	emailAndPassword: {
		enabled: true,
		minPasswordLength: 8,
		maxPasswordLength: 128,
	},
	plugins: [
		admin(),
		username({
			minUsernameLength: 1,
			maxUsernameLength: 64,
			usernameValidator: (value) => value.trim().length > 0,
		}),
	],
	session: { cookieCache: { enabled: false } },
	rateLimit: { enabled: true, storage: "database" },
	advanced: {
		cookiePrefix: "leonwillow",
		ipAddress: { ipAddressHeaders: ["x-leonwillow-client-ip"] },
	},
} satisfies BetterAuthOptions;
