/**
 * @file 当前服务进程共用的认证、数据库和安全配置。
 * 创建时间：2026-10-05
 * 修改时间：2026-10-06
 * 版本作用：基础依赖只在启动时绑定一次，业务模块按需读取。
 * 被调用：index.ts、认证/权限服务、管理事务服务、服务端测试。
 * 调用：auth/db 类型；不加载环境、不创建连接或监听器。
 * 功能：提供固定资源与来源校验，拒绝运行中替换资源。
 * 预期结果：业务路由直接注册；请求、用户、会话和事务不存入共享资源。
 */
import type { Auth } from "@leonwillow-electron/auth";
import type { Database } from "@leonwillow-electron/db";
import type { FundsFileStore } from "./modules/funds/file-store";
import type { FundsGraph } from "./modules/funds/graph";

type ServerResources = Readonly<{
	auth: Auth;
	db: Database;
	origins: readonly string[];
	trustedProxyIps: readonly string[];
	fundsGraph?: FundsGraph;
	fundsFiles?: FundsFileStore;
}>;

let current: ServerResources | undefined;
const defaultOrigins = ["http://localhost:3001"];

export class ServerResourcesUnavailableError extends Error {
	constructor() {
		super("服务资源尚未初始化。");
	}
}

/**
 * 绑定当前进程唯一的一组资源；已绑定时拒绝覆盖，避免请求切换到另一套数据库。
 * @param resources 由启动入口或测试创建的实例与明确的安全配置。
 * @returns 幂等解绑函数；调用方须先停止并排空 HTTP 请求，再解绑和关闭数据库池。
 * 本函数不接管连接池，也不提供按请求或按用户替换资源的能力。
 */
export function initializeServerResources(resources: ServerResources) {
	if (current) throw new Error("服务资源已初始化，请先停止服务并释放原资源。");
	const bound = Object.freeze({
		...resources,
		origins: Object.freeze([...resources.origins]),
		trustedProxyIps: Object.freeze([...resources.trustedProxyIps]),
	});
	current = bound;
	return () => {
		if (current === bound) current = undefined;
	};
}

/** 返回已绑定资源；未初始化时抛出专用错误，由各 API 边界转换为 503。 */
export function getServerResources() {
	if (!current) throw new ServerResourcesUnavailableError();
	return current;
}

/** 校验精确 Origin；未初始化时沿用本地公共路由的默认来源，不放开任意来源。 */
export function isTrustedOrigin(request: Request) {
	return (current?.origins ?? defaultOrigins).includes(
		request.headers.get("origin") ?? "",
	);
}

/** 只提供固定代理配置，不保存请求地址；未初始化时不信任任何代理。 */
export function getTrustedProxyIps(): readonly string[] {
	return current?.trustedProxyIps ?? [];
}
