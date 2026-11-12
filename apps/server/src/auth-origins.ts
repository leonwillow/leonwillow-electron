/**
 * @file 认证与 CORS 共用的网站及桌面应用来源解析。
 * 创建时间：2026-11-10；修改时间：2026-11-10。
 * 版本作用：开发时跟随本机网络地址变化；各环境均支持固定桌面应用来源。
 * 被调用：服务启动入口与认证测试；调用：node:os 的本机网卡信息、共享桌面协议常量。
 * 预期结果：用户不按 IP 登记；仅扩展已配置开发网站的协议和端口，不信任请求自报地址。
 */
import { networkInterfaces } from "node:os";
import { DESKTOP_ORIGIN } from "@leonwillow-electron/desktop-bridge";

function localIPv4Addresses(): string[] {
	return Object.values(networkInterfaces()).flatMap((entries) =>
		(entries ?? [])
			.filter((entry) => entry.family === "IPv4")
			.map((entry) => entry.address),
	);
}

/**
 * 创建来源读取器，供应用校验与 Better Auth 使用同一规则。
 * @param configured 明确配置的完整 Origin；只有 localhost/回环来源可派生开发地址。
 * @param mode 仅 development 启用本机地址解析，production/test 保持固定配置。
 * @param readAddresses 本机 IPv4 读取函数；测试可注入网络切换，无请求或用户数据。
 * @returns 每次读取的新数组，包含唯一桌面应用来源；换网后下次请求即使用当前网卡，不累计失效地址。
 */
export function createOriginResolver(
	configured: readonly string[],
	mode: string,
	readAddresses: () => readonly string[] = localIPv4Addresses,
) {
	const explicit = [
		...new Set([
			...configured.map((value) => value.trim()).filter(Boolean),
			DESKTOP_ORIGIN,
		]),
	];
	const localSites =
		mode === "development"
			? explicit.flatMap((value) => {
					try {
						const site = new URL(value);
						return ["http:", "https:"].includes(site.protocol) &&
							["localhost", "127.0.0.1", "[::1]"].includes(site.hostname)
							? [site]
							: [];
					} catch {
						return [];
					}
				})
			: [];
	return (): string[] => {
		if (!localSites.length) return [...explicit];
		const origins = new Set(explicit);
		const hosts = new Set([
			"localhost",
			"127.0.0.1",
			"[::1]",
			...readAddresses(),
		]);
		for (const site of localSites) {
			for (const host of hosts) {
				const origin = new URL(site.origin);
				origin.hostname = host;
				origins.add(origin.origin);
			}
		}
		return [...origins];
	};
}
