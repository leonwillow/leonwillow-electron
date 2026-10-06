/**
 * @file 工作台现有功能和访问规则的共享目录。
 * 创建时间：2026-10-04
 * 修改时间：2026-10-06
 * 版本作用：首次接入按功能授权；不包含业务实现或服务端依赖。
 * 被调用：服务端 access/admin 模块、Web 导航与路由。
 * 调用：无外部运行时依赖。
 * 功能：统一功能标识、中文名称、入口和路由访问规则。
 * 预期结果：新增入口必须明确登记权限，浏览器与后端使用相同标识。
 */
const definitions = {
	funds: { name: "资金调查", enabled: true },
	inbox: { name: "收件箱", enabled: true },
	tickets: { name: "工单", enabled: true },
	contacts: { name: "联系人", enabled: true },
	"knowledge-base": { name: "知识库", enabled: true },
	"ai-agent": { name: "AI 助手", enabled: true },
	reports: { name: "报表", enabled: true },
} as const;

export type ModuleId = keyof typeof definitions;

export const modules = (Object.keys(definitions) as ModuleId[]).map((id) => ({
	id,
	...definitions[id],
	path: `/${id}` as const,
}));

export type SystemRole = "admin" | "user";
export type AccessRequirement = "session" | "admin" | ModuleId;
export type AccessIdentity = { role: SystemRole; moduleIds: readonly string[] };

export const isModuleId = (value: string): value is ModuleId =>
	modules.some((module) => module.id === value);

/** 检查已启用功能；管理员自动拥有全部启用功能，普通人员必须显式授权。 */
export function canAccessModule(identity: AccessIdentity, id: string) {
	return modules.some(
		(module) =>
			module.id === id &&
			module.enabled &&
			(identity.role === "admin" || identity.moduleIds.includes(id)),
	);
}

const adminPaths = new Set([
	"/admin/users",
	"/settings/general",
	"/settings/teammates",
	"/settings/office-hours",
	"/settings/security",
	"/settings/assignments",
	"/settings/saved-replies",
	"/settings/messenger",
	"/settings/billing",
	"/settings/tags",
]);

/** 未登记地址返回 null，禁止把未知页面当成默认公开入口。 */
export function routeRequirement(path: string): AccessRequirement | null {
	const pathname = path.replace(/\/+$/, "") || "/";
	if (
		[
			"/",
			"/access-denied",
			"/settings/profile",
			"/settings/notifications",
		].includes(pathname)
	)
		return "session";
	if (adminPaths.has(pathname)) return "admin";
	if (pathname === "/funds/cases") return "funds";
	if (pathname === "/knowledge-base/collections") return "knowledge-base";
	return modules.find((module) => module.path === pathname)?.id ?? null;
}

export function canAccessPath(identity: AccessIdentity, path: string) {
	const requirement = routeRequirement(path);
	if (requirement === "session") return true;
	if (requirement === "admin") return identity.role === "admin";
	return requirement !== null && canAccessModule(identity, requirement);
}

/** 无业务授权的人员进入说明页，避免默认跳转到没有权限的收件箱。 */
export function firstAccessiblePath(identity: AccessIdentity) {
	return (
		modules.find((module) => canAccessModule(identity, module.id))?.path ??
		"/access-denied"
	);
}
