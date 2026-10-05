/**
 * @file 认证代理地址边界回归。
 * 创建时间：2026-10-04（本次新建）；修改时间：2026-10-04。
 * 版本作用：发布前验证直连与代理限流输入；被调用：test:unit。
 * 调用：client-ip；功能：覆盖伪造头、代理头及非法配置。
 * 预期结果：只有明确受信的直接对端能提供客户端地址。
 */
import { expect, test } from "bun:test";
import {
	getClientIp,
	parseTrustedProxyIps,
} from "../src/modules/auth/client-ip";

test("直连不信任任何伪造转发头", () => {
	const request = new Request("http://localhost", {
		headers: {
			"x-real-ip": "198.51.100.9",
			"x-forwarded-for": "198.51.100.10",
		},
	});
	expect(getClientIp(request, "192.0.2.1", [])).toBe("192.0.2.1");
});

test("受信代理区分客户端，拒绝多值和无效地址", () => {
	const proxies = parseTrustedProxyIps("127.0.0.1,::1");
	for (const address of ["198.51.100.1", "198.51.100.2"]) {
		expect(
			getClientIp(
				new Request("http://localhost", { headers: { "x-real-ip": address } }),
				"::ffff:127.0.0.1",
				proxies,
			),
		).toBe(address);
	}
	for (const address of [
		"",
		"198.51.100.1, 198.51.100.2",
		"attacker.invalid",
	]) {
		expect(
			getClientIp(
				new Request("http://localhost", { headers: { "x-real-ip": address } }),
				"127.0.0.1",
				proxies,
			),
		).toBe("127.0.0.1");
	}
	expect(() => parseTrustedProxyIps("0.0.0.0/0")).toThrow();
});
