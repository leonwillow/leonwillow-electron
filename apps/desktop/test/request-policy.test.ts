/**
 * @file 桌面资源与网络隔离的回归测试。
 * 创建时间：2026-11-10；修改时间：2026-11-20。
 * 被调用：Bun test；功能：拒绝伪似来源、目录穿越与伪造凭据请求头。
 */
import { expect, test } from "bun:test";
import {
	isAllowedExternalUrl,
	isAllowedRendererPermission,
	isAppUrl,
	isNavigableAppUrl,
	rendererFile,
	rendererHeaders,
	upstreamHeaders,
} from "../src/request-policy";

test("IPC只接受应用来源，变更服务器仅允许登录页，且禁止导航至 /api/*", () => {
	expect(isAppUrl("aidesk://app/login", true)).toBe(true);
	expect(isAppUrl("aidesk://app/calculators")).toBe(true);
	expect(isNavigableAppUrl("aidesk://app/calculators")).toBe(true);
	expect(isNavigableAppUrl("aidesk://app/api")).toBe(false);
	expect(isNavigableAppUrl("aidesk://app/api/auth/session")).toBe(false);
	for (const value of [
		"aidesk://app/calculators",
		"aidesk://app.evil/login",
		"http://app/login",
		"aidesk://app:123/login",
		"aidesk://user:password@app/login",
	])
		expect(isAppUrl(value, true)).toBe(false);
});
test("只读取renderer内的资源", () => {
	expect(rendererFile("/tmp/renderer", "/assets/test.js")).toBe(
		"/tmp/renderer/assets/test.js",
	);
	for (const value of [
		"/../../secret",
		"/%2e%2e/secret",
		"/%2fsecret",
		"/%5csecret",
		"/%00secret",
		"/bad%",
		"/..\\secret",
	])
		expect(rendererFile("/tmp/renderer", value)).toBeNull();
});
test("网络会话独占凭据，不信任renderer传入的Cookie或来源", () => {
	const source = new Headers({
		cookie: "secret",
		authorization: "Bearer secret",
		host: "evil",
		origin: "http://evil",
		"x-forwarded-for": "1.1.1.1",
		"content-type": "application/json",
		accept: "application/json",
	});
	const headers = upstreamHeaders(source);
	expect([...headers.keys()].sort()).toEqual([
		"accept",
		"content-type",
		"origin",
	]);
	expect(headers.get("origin")).toBe("aidesk://app");
	const response = rendererHeaders(
		new Headers({
			"set-cookie": "secret",
			"content-encoding": "gzip",
			"content-length": "200",
			"content-type": "application/json",
			"x-request-id": "test",
		}),
	);
	expect(response.has("set-cookie")).toBe(false);
	expect(response.has("content-encoding")).toBe(false);
	expect(response.get("x-request-id")).toBe("test");
	expect(response.get("x-content-type-options")).toBe("nosniff");
	expect(response.get("content-security-policy")).toBe(
		"default-src 'none'; sandbox",
	);
});

test("渲染进程权限与外部法规链接严格遵守最小白名单", () => {
	expect(isAllowedRendererPermission("fullscreen")).toBe(true);
	expect(isAllowedRendererPermission("clipboard-sanitized-write")).toBe(true);
	for (const denied of [
		"geolocation",
		"media",
		"notifications",
		"clipboard-read",
		"openExternal",
	]) {
		expect(isAllowedRendererPermission(denied)).toBe(false);
	}
	expect(
		isAllowedExternalUrl(
			"https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_1dbea81872cb4fda9ab3ccc45c627531.html",
		),
	).toBe(true);
	expect(
		isAllowedExternalUrl(
			"https://www.chinatax.gov.cn/chinatax/n810214/c102374/c102377/c102378/c3575330/content.html",
		),
	).toBe(true);
	for (const bad of [
		"http://www.samr.gov.cn/",
		"https://www.samr.gov.cn:8443/",
		"https://user:pass@www.chinatax.gov.cn/",
		"https://evil.www.samr.gov.cn/",
		"https://example.com/",
		"javascript:alert(1)",
	]) {
		expect(isAllowedExternalUrl(bad)).toBe(false);
	}
});
