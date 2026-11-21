/**
 * @file 工作台权限与人员管理的 Eden 客户端。
 * 创建时间：2026-10-04
 * 修改时间：2026-11-21
 * 版本作用：前端只依赖服务端类型契约。
 * 被调用：工作台路由、认证客户端、人员管理视图。
 * 调用：api.ts、access-cache.ts。
 * 功能：读取实时授权（带请求代际合并与强制核验）、人员与记录，提交创建、编辑和重置操作。
 * 预期结果：不存储密码或令牌，清缓存立即作废在途旧响应，登录及根路由重定向不重复请求同一份权限。
 */
import { createAccessCache } from "./access-cache";
import { api } from "./api";

class AccessRequestError extends Error {}

function unwrap<T>(result: {
	data: T | null;
	error: { value: unknown } | null;
}): T {
	if (result.error) {
		const value = result.error.value;
		throw new AccessRequestError(
			typeof value === "object" &&
				value !== null &&
				"message" in value &&
				typeof value.message === "string"
				? value.message
				: "操作失败，请稍后重试。",
		);
	}
	if (result.data === null)
		throw new AccessRequestError("服务未返回有效结果，请重试。");
	return result.data;
}

export const accessErrorMessage = (error: unknown) =>
	error instanceof AccessRequestError
		? error.message
		: "暂时无法连接人员与权限服务，请稍后重试。";

type AccessPayload = Awaited<ReturnType<typeof fetchAccess>>;

// 仅合并同一导航/重定向周期内的重复查询，清缓存与强制核验会递增代际作废在途旧响应。
const ACCESS_HANDOFF_TTL_MS = 1000;

async function fetchAccess() {
	const result = await api.api.access.get();
	if (result.status === 401) return null;
	return unwrap(result);
}

const accessCache = createAccessCache(fetchAccess, ACCESS_HANDOFF_TTL_MS);

export function clearAccessCache() {
	accessCache.clear();
}

/** 仅 401 返回 null；网络或服务故障抛出，让路由显示可重试错误。 */
export function getAccess(options?: {
	force?: boolean;
}): Promise<AccessPayload> {
	return accessCache.get(options);
}

/** 比较两次权限快照的身份与模块授权是否一致，避免切回窗口无变化时触发路由重建。 */
export function sameAccessSnapshot(
	a: NonNullable<AccessPayload>,
	b: NonNullable<AccessPayload>,
) {
	return (
		a.user.id === b.user.id &&
		a.user.role === b.user.role &&
		a.user.name === b.user.name &&
		a.user.username === b.user.username &&
		a.moduleIds.length === b.moduleIds.length &&
		a.moduleIds.every((id, index) => id === b.moduleIds[index])
	);
}

export async function getAdminData() {
	const [people, history] = await Promise.all([
		api.api.admin.users.get(),
		api.api.admin.audit.get(),
	]);
	return { users: unwrap(people).users, events: unwrap(history).events };
}

export type ManagedUser = Awaited<
	ReturnType<typeof getAdminData>
>["users"][number];
export type AuditEvent = Awaited<
	ReturnType<typeof getAdminData>
>["events"][number];
export type CreateUserValues = Parameters<typeof api.api.admin.users.post>[0];
export type UpdateUserValues = Omit<
	CreateUserValues,
	"password" | "username"
> & { disabled: boolean };

export async function createManagedUser(values: CreateUserValues) {
	const data = unwrap(await api.api.admin.users.post(values));
	clearAccessCache();
	return data;
}

export async function updateManagedUser(id: string, values: UpdateUserValues) {
	const data = unwrap(await api.api.admin.users({ userId: id }).patch(values));
	clearAccessCache();
	return data;
}

export async function resetManagedPassword(id: string, password: string) {
	const data = unwrap(
		await api.api.admin.users({ userId: id }).password.post({ password }),
	);
	clearAccessCache();
	return data;
}
