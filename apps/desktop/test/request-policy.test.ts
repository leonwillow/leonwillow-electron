/**
 * @file 桌面资源与网络隔离的回归测试。
 * 创建时间：2026-11-10；修改时间：2026-11-10。
 * 被调用：Bun test；功能：拒绝伪似来源、目录穿越与伪造凭据请求头。
 */
import { expect, test } from "bun:test";
import {
	isAppUrl,
	rendererFile,
	rendererHeaders,
	upstreamHeaders,
} from "../src/request-policy";

test("IPC只接受应用来源，变更服务器仅允许登录页", () => {
	expect(isAppUrl("aidesk://app/login", true)).toBe(true);
	expect(isAppUrl("aidesk://app/calculators")).toBe(true);
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
});
