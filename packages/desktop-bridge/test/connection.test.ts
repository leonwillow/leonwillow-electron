/**
 * @file 桌面服务器地址边界与回显测试。
 * 创建时间：2026-11-10；修改时间：2026-11-10。
 * 调用：连接契约；预期：默认端口/IPv6可回显，危险或含糊输入无法进入持久化配置。
 */
import { expect, test } from "bun:test";
import { connectionInput, normalizeConnection } from "../src";

test("规范化域名、IPv4、IPv6及协议默认端口", () => {
	for (const [address, port, expected] of [
		[" localhost ", "3000", "http://localhost:3000"],
		["http://192.168.1.2:3000/", "", "http://192.168.1.2:3000"],
		["https://API.example.com/", "443", "https://api.example.com"],
		["http://[::1]", "3000", "http://[::1]:3000"],
		["https://api.example.com", "8443", "https://api.example.com:8443"],
	] as const) {
		expect(normalizeConnection({ address, port })).toBe(expected);
		expect(normalizeConnection(connectionInput(expected))).toBe(expected);
	}
});

test("地址与端口同值可以接受，不同值不能静默覆盖", () => {
	expect(
		normalizeConnection({ address: "localhost:3000", port: "03000" }),
	).toBe("http://localhost:3000");
	expect(() =>
		normalizeConnection({ address: "localhost:3000", port: "4000" }),
	).toThrow("不一致");
});

test("拒绝错误协议、路径、凭据、查询以及无效端口", () => {
	for (const address of [
		"",
		"a b",
		"file:///tmp/api",
		"ftp://server",
		"javascript:alert(1)",
		"https://user:pass@server",
		"https://server/api",
		"https://server?token=x",
		"https://server#",
		"https://server\\other",
	]) {
		expect(() => normalizeConnection({ address, port: "" })).toThrow();
	}
	for (const port of ["0", "65536", "-1", "1.5", "abc", "3e3"]) {
		expect(() => normalizeConnection({ address: "localhost", port })).toThrow();
	}
	expect(() => normalizeConnection(null as never)).toThrow("格式无效");
});
