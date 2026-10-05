/**
 * @file 认证限流的客户端地址信任边界。
 * 创建时间：2026-10-04（本次新建）
 * 修改时间：2026-10-05
 * 版本作用：区分直连地址与部署方明确授权的反向代理。
 * 被调用：进程入口、认证 HTTP 适配器；调用：node:net 的 IP 校验。
 * 功能：仅受信直接对端可提供单个 X-Real-IP，不解析任意转发链。
 * 预期结果：直连伪造头无效，错误代理头回退到对端地址。
 */
import { isIP } from "node:net";

function normalizeIp(value: string) {
	if (!isIP(value)) return undefined;
	return value.startsWith("::ffff:") && isIP(value.slice(7)) === 4
		? value.slice(7)
		: value.toLowerCase();
}

/** 解析逗号分隔的直接代理 IP；空配置不信任代理，非法地址/CIDR 在启动时抛错。 */
export function parseTrustedProxyIps(value = "") {
	return value
		.split(",")
		.filter((ip) => ip.trim())
		.map((ip) => {
			const normalized = normalizeIp(ip.trim());
			if (!normalized)
				throw new Error(
					"TRUSTED_PROXY_IPS 只接受明确的 IPv4/IPv6 地址，不接受 CIDR 或主机名。",
				);
			return normalized;
		});
}

/** peerIp 必须来自监听器；只信任配置中的对端，缺少连接地址时返回 undefined。 */
export function getClientIp(
	request: Request,
	peerIp: string | undefined,
	trustedProxyIps: readonly string[],
) {
	const peer = peerIp ? normalizeIp(peerIp) : undefined;
	if (!peer || !trustedProxyIps.includes(peer)) return peer;
	return normalizeIp(request.headers.get("x-real-ip")?.trim() ?? "") ?? peer;
}
