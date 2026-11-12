/**
 * @file 开发网站来源、桌面应用来源与生产部署边界的回归测试。
 * 创建时间：2026-11-10；修改时间：2026-11-10。
 * 版本作用：使用合成网卡地址验证换网，无需真实网络或数据库。
 * 调用：auth-origins；预期：只信任本机已配置端口，生产和测试不自动扩展。
 */
import { expect, test } from "bun:test";
import { DESKTOP_ORIGIN } from "@leonwillow-electron/desktop-bridge";
import { createOriginResolver } from "../src/auth-origins";

test("开发来源跟随网卡切换，不累计旧地址或信任同网段的其他设备", () => {
	let addresses = ["192.168.5.225", "100.100.1.1"];
	const origins = createOriginResolver(
		["http://localhost:3001", "https://preview.example.com"],
		"development",
		() => addresses,
	);
	expect(origins()).toContain("http://192.168.5.225:3001");
	expect(origins()).toContain("http://100.100.1.1:3001");
	expect(origins()).toContain("http://127.0.0.1:3001");
	expect(origins()).toContain("http://[::1]:3001");
	expect(origins()).toContain("https://preview.example.com");
	addresses = ["192.168.1.58"];
	const changed = origins();
	expect(changed).toContain("http://192.168.1.58:3001");
	for (const denied of [
		"http://192.168.5.225:3001",
		"http://192.168.1.59:3001",
		"http://192.168.1.58:4000",
		"https://192.168.1.58:3001",
		"http://localhost.attacker.invalid:3001",
		"null",
	])
		expect(changed).not.toContain(denied);
	changed.push("https://attacker.invalid");
	expect(origins()).not.toContain("https://attacker.invalid");
});

test("生产与测试使用明确网站及桌面来源，不读取开发网卡；配置数组不能被外部改写", () => {
	for (const mode of ["production", "test"]) {
		const configured = ["https://app.example.com", "http://localhost:3001"];
		const origins = createOriginResolver(configured, mode, () => {
			throw Error("不应读取网卡");
		});
		configured.push("https://attacker.invalid");
		expect(origins()).toEqual([
			"https://app.example.com",
			"http://localhost:3001",
			DESKTOP_ORIGIN,
		]);
	}
});

test("只从配置的回环网站派生协议与端口，域名和坏输入不自动开放本机", () => {
	const origins = createOriginResolver(
		[
			"https://localhost:8443",
			"http://127.0.0.1:3001",
			"http://127.0.0.1:3001",
		],
		"development",
		() => ["192.168.1.58"],
	)();
	expect(origins).toContain("https://192.168.1.58:8443");
	expect(origins).toContain("http://192.168.1.58:3001");
	expect(origins).not.toContain("http://192.168.1.58:8443");
	expect(new Set(origins).size).toBe(origins.length);
	const configured = ["https://app.example.com", "not-a-url"];
	expect(
		createOriginResolver(configured, "development", () => {
			throw Error("没有开发回环来源，不应读取网卡");
		})(),
	).toEqual([...configured, DESKTOP_ORIGIN]);
});

test("桌面来源在各环境固定且精确，不接受其他主机、端口、路径或 null", () => {
	for (const mode of ["development", "production", "test"]) {
		const origins = createOriginResolver([], mode, () => []);
		expect(origins()).toEqual(["aidesk://app"]);
		for (const denied of [
			"aidesk://other",
			"aidesk://app:3000",
			"aidesk://app.evil.invalid",
			"aidesk://app/login",
			"http://app",
			"https://unconfigured.invalid",
			"null",
			"",
		])
			expect(origins()).not.toContain(denied);
	}
	expect(
		createOriginResolver([DESKTOP_ORIGIN, DESKTOP_ORIGIN], "production")(),
	).toEqual([DESKTOP_ORIGIN]);
});
