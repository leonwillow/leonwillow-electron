/**
 * @file 前端入口与路由权限策略的安全回归测试。
 * 创建时间：2026-10-04
 * 修改时间：2026-10-04
 * 版本作用：覆盖无授权、路径绕过和管理中心与个人设置隔离。
 * 被调用：bun run test:ui。
 * 调用：bun:test、共享权限目录、导航与搜索目录。
 * 功能：验证导航目标已登记，未知和越权路径拒绝访问。
 * 预期结果：目录变更不会自动开放新页面或让无权限用户循环跳转。
 */
import { expect, test } from "bun:test";
import {
	canAccessModule,
	canAccessPath,
	firstAccessiblePath,
	routeRequirement,
} from "@leonwillow-electron/access";
import {
	adminNav,
	primaryNav,
	settingsHomeHref,
} from "../src/assets/data/navigation";
import { searchData } from "../src/assets/data/search";

test("所有现有导航与搜索目标都显式登记访问规则", () => {
	for (const path of [
		...primaryNav.map((item) => item.href),
		...adminNav.map((item) => item.href),
		...searchData.flatMap((group) => group.data.map((item) => item.href)),
	])
		expect(routeRequirement(path)).not.toBeNull();
});

test("未授权人员只能访问个人设置与权限说明，不会默认进入收件箱", () => {
	const identity = { role: "user" as const, moduleIds: [] };
	expect(firstAccessiblePath(identity)).toBe("/access-denied");
	for (const path of [
		"/inbox",
		"/admin/users",
		"/settings/teammates",
		"/settings/security",
		"/knowledge-base/collections",
	])
		expect(canAccessPath(identity, path)).toBe(false);
	for (const path of [
		"/",
		"/access-denied",
		"/settings/profile",
		"/settings/notifications",
	])
		expect(canAccessPath(identity, path)).toBe(true);
});

test("按功能选择首个入口，授权覆盖已登记子页但不自动开放相似或未知地址", () => {
	const identity = {
		role: "user" as const,
		moduleIds: ["knowledge-base", "reports"],
	};
	expect(firstAccessiblePath(identity)).toBe("/knowledge-base");
	expect(canAccessPath(identity, "/knowledge-base/collections/")).toBe(true);
	for (const path of [
		"/knowledge-base-secret",
		"/knowledge-base/unknown",
		"/admin/users",
		"/settings/teammates",
		"/inbox",
	])
		expect(canAccessPath(identity, path)).toBe(false);
	expect(canAccessModule({ role: "admin", moduleIds: [] }, "unknown")).toBe(
		false,
	);
	expect(
		canAccessPath({ role: "admin", moduleIds: [] }, "/new-unregistered-page"),
	).toBe(false);
});

test("两种身份共享个人设置，管理菜单与搜索只向管理员开放", () => {
	const member = { role: "user" as const, moduleIds: [] };
	const admin = { role: "admin" as const, moduleIds: [] };
	const personalSettings = searchData.find(
		(group) => group.title === "个人设置",
	);
	const adminSettings = searchData.find((group) => group.title === "管理中心");
	if (!personalSettings || !adminSettings)
		throw new Error("搜索必须分别提供个人设置与管理中心分组");
	expect(settingsHomeHref).toBe("/settings/profile");
	for (const identity of [member, admin]) {
		expect(canAccessPath(identity, settingsHomeHref)).toBe(true);
		for (const item of personalSettings.data)
			expect(canAccessPath(identity, item.href)).toBe(true);
	}
	for (const item of [...adminNav, ...adminSettings.data]) {
		expect(routeRequirement(item.href)).toBe("admin");
		expect(canAccessPath(member, item.href)).toBe(false);
		expect(canAccessPath(admin, item.href)).toBe(true);
	}
	for (const path of ["/admin", "/admin/users-extra", "/admin/unknown"])
		expect(canAccessPath(admin, path)).toBe(false);
});
