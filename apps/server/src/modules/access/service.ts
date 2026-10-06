/**
 * @file 当前人员的身份与功能授权规则。
 * 创建时间：2026-10-04
 * 修改时间：2026-10-06
 * 版本作用：用普通函数实现身份检查、授权读取和功能访问判断。
 * 被调用：权限插件、access 路由、人员管理服务。
 * 调用：server-resources、认证类型、Drizzle、共享功能目录。
 * 功能：从已解析的会话生成权限快照，拒绝失效身份、停用账号和越权访问。
 * 预期结果：业务规则不依赖 Elysia 实例或上下文，授权撤销在下次读取时生效。
 */
import {
	type AccessRequirement,
	canAccessModule,
	modules,
} from "@leonwillow-electron/access";
import type { Auth } from "@leonwillow-electron/auth";
import { userModuleAccess } from "@leonwillow-electron/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { getServerResources } from "../../server-resources";

export class AccessError extends Error {
	constructor(
		public statusCode: 400 | 401 | 403 | 404 | 409 | 503,
		public code: string,
		message: string,
	) {
		super(message);
	}
}

export type AccessSession = {
	user: {
		id: string;
		username: string;
		name: string;
		image: string | null;
		role: "admin" | "user";
	};
	sessionId: string;
	moduleIds: string[];
};

/** 参数为服务器读取的身份和待访问功能；未登记、停用或未授权功能均返回 403。 */
export function requireModule(access: AccessSession, moduleId: string) {
	if (
		!canAccessModule(
			{ role: access.user.role, moduleIds: access.moduleIds },
			moduleId,
		)
	) {
		throw new AccessError(
			403,
			"MODULE_FORBIDDEN",
			"你没有这个功能的访问权限，请联系管理员。",
		);
	}
}

/**
 * 检查当前身份并读取实时授权，不读取 HTTP 请求或写入响应头。
 * @param current 认证库校验签名与有效期后返回的会话；不得使用客户端提交的身份。
 * @param requirement 路由要求的 session/admin/功能标识。
 * @returns 当前人员的身份与功能快照；无会话/停用抛出 401，越权抛出 403。
 */
export async function getAccess(
	current: Auth["$Infer"]["Session"] | null,
	requirement: AccessRequirement,
) {
	const { db } = getServerResources();
	if (!current?.user.username)
		throw new AccessError(401, "UNAUTHENTICATED", "登录已失效，请重新登录。");
	if (
		current.user.banned &&
		(!current.user.banExpires || current.user.banExpires > new Date())
	) {
		throw new AccessError(
			401,
			"ACCOUNT_DISABLED",
			"账号已停用，请联系管理员。",
		);
	}
	const role = current.user.role === "admin" ? "admin" : "user";
	const grants =
		role === "admin"
			? modules.filter((module) => module.enabled).map((module) => module.id)
			: (
					await db
						.select({ id: userModuleAccess.moduleId })
						.from(userModuleAccess)
						.where(
							and(
								eq(userModuleAccess.userId, current.user.id),
								isNull(userModuleAccess.deletedAt),
							),
						)
				).map((grant) => grant.id);
	const access: AccessSession = {
		user: {
			id: current.user.id,
			username: current.user.displayUsername ?? current.user.username,
			name: current.user.name,
			image: current.user.image ?? null,
			role,
		},
		sessionId: current.session.id,
		moduleIds: grants.filter((id) =>
			canAccessModule({ role, moduleIds: grants }, id),
		),
	};
	if (requirement === "admin" && role !== "admin")
		throw new AccessError(
			403,
			"ADMIN_REQUIRED",
			"只有管理员可以管理人员与权限。",
		);
	if (requirement !== "admin" && requirement !== "session")
		requireModule(access, requirement);
	return access;
}
