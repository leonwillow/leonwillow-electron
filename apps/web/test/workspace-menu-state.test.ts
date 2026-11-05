/**
 * @file 工作台二级菜单统一状态与旧偏好迁移的回归测试。
 * 创建时间：2026-11-04；修改时间：2026-11-05。
 * 版本作用：覆盖固定后跨模块切换、统一取消固定、恢复和存储失败，不镜像界面结构。
 * 被调用：Bun test、test:ui；调用：workspace-menu-state。
 * 预期结果：任意内容切换都使用同一固定状态，用户及历史偏好不会互相覆盖。
 */
import { expect, test } from "bun:test";
import {
	initialWorkspaceMenuState,
	readWorkspaceMenuPinned,
	type WorkspaceMenuState,
	workspaceMenuForPath,
	workspaceMenuReducer,
	workspaceMenuStorageKey,
	writeWorkspaceMenuPinned,
} from "../src/lib/workspace-menu-state";

function preferenceStorage(values: Record<string, string> = {}) {
	const data = new Map(Object.entries(values));
	return {
		data,
		getItem: (key: string) => data.get(key) ?? null,
		setItem: (key: string, value: string) => {
			data.set(key, value);
		},
		removeItem: (key: string) => {
			data.delete(key);
		},
	};
}

const initial: WorkspaceMenuState = {
	activeMenu: "funds",
	routeMenu: "funds",
	open: true,
	pinned: false,
};

test("刷新只恢复菜单内容，未固定浮窗必须保持关闭", () => {
	for (const menuId of ["funds", "documents", "inquiries"] as const) {
		const state = initialWorkspaceMenuState(menuId, false);
		expect(state.activeMenu).toBe(menuId);
		expect(workspaceMenuReducer(state, { type: "route", menuId }).open).toBe(
			false,
		);
		expect(
			workspaceMenuReducer(state, { type: "route", menuId: "documents" }).open,
		).toBe(false);
	}
	const fixed = initialWorkspaceMenuState("inquiries", true);
	expect(fixed.pinned).toBe(true);
	expect(fixed.activeMenu).toBe("inquiries");
	expect(
		workspaceMenuReducer(fixed, { type: "sync-pinned", pinned: false }).open,
	).toBe(false);
});

test("显式点击导航后路由变化保持打开，关闭后同路由更新不能再次弹出", () => {
	let state = initialWorkspaceMenuState("funds", false);
	state = workspaceMenuReducer(state, { type: "show", menuId: "inquiries" });
	state = workspaceMenuReducer(state, { type: "route", menuId: "inquiries" });
	expect(state.open).toBe(true);
	state = workspaceMenuReducer(state, { type: "dismiss" });
	expect(
		workspaceMenuReducer(state, { type: "route", menuId: "inquiries" }).open,
	).toBe(false);
	expect(
		workspaceMenuReducer(state, { type: "route", menuId: "documents" }).open,
	).toBe(false);
});

test("资金固定后切换文书和笔录保持固定，在任一模块取消后所有模块共用未固定状态", () => {
	let state = workspaceMenuReducer(initial, { type: "pin", pinned: true });
	for (const menuId of ["documents", "inquiries", "funds"] as const) {
		state = workspaceMenuReducer(state, { type: "show", menuId });
		state = workspaceMenuReducer(state, { type: "route", menuId });
		expect(state.activeMenu).toBe(menuId);
		expect(state.pinned).toBe(true);
	}
	state = workspaceMenuReducer(state, { type: "pin", pinned: false });
	for (const menuId of ["inquiries", "documents", "funds"] as const) {
		state = workspaceMenuReducer(state, { type: "route", menuId });
		expect(state.pinned).toBe(false);
	}
});

test("固定时悬停和焦点预览不改变内容，显式打开或路由激活才切换", () => {
	let state = workspaceMenuReducer(initial, { type: "pin", pinned: true });
	for (const menuId of ["documents", "inquiries", null] as const) {
		expect(workspaceMenuReducer(state, { type: "preview", menuId })).toBe(
			state,
		);
	}
	state = workspaceMenuReducer(state, { type: "show", menuId: "documents" });
	expect(state.activeMenu).toBe("documents");
	state = workspaceMenuReducer(state, { type: "route", menuId: "inquiries" });
	expect(state.activeMenu).toBe("inquiries");
	state = workspaceMenuReducer(state, { type: "dismiss" });
	// 窄窗暂时关闭不改变固定偏好，也不能被其他图标的预览重新打开。
	expect(
		workspaceMenuReducer(state, { type: "preview", menuId: "documents" }),
	).toEqual(state);
	expect(state.open).toBe(false);
});

test("取消固定后立即恢复预览切换，经过无二级菜单的图标时只关闭浮窗", () => {
	let state = workspaceMenuReducer(initial, { type: "pin", pinned: true });
	state = workspaceMenuReducer(state, { type: "pin", pinned: false });
	state = workspaceMenuReducer(state, { type: "preview", menuId: "documents" });
	expect(state.activeMenu).toBe("documents");
	expect(state.open).toBe(true);
	expect(state.routeMenu).toBe("funds");
	state = workspaceMenuReducer(state, { type: "preview", menuId: null });
	expect(state.open).toBe(false);
	expect(state.activeMenu).toBe("documents");
	expect(state.pinned).toBe(false);
});

test("临时收起、非菜单路由和跨窗口同步均不产生独立的模块固定状态", () => {
	let state = workspaceMenuReducer(initial, { type: "pin", pinned: true });
	state = workspaceMenuReducer(state, { type: "dismiss" });
	expect(state.open).toBe(false);
	expect(state.pinned).toBe(true);
	state = workspaceMenuReducer(state, { type: "route", menuId: null });
	expect(state.activeMenu).toBeNull();
	expect(state.pinned).toBe(true);
	state = workspaceMenuReducer(state, { type: "show", menuId: "documents" });
	expect(state.open).toBe(true);
	state = workspaceMenuReducer(state, { type: "sync-pinned", pinned: false });
	state = workspaceMenuReducer(state, { type: "route", menuId: "inquiries" });
	expect(state.pinned).toBe(false);
	state = workspaceMenuReducer(state, { type: "dismiss" });
	expect(
		workspaceMenuReducer(state, { type: "route", menuId: "inquiries" }).open,
	).toBe(false);
});

test("旧菜单任一固定即迁移为统一固定，成功写入后只清理当前用户的旧键", () => {
	const storage = preferenceStorage({
		"funds-case-menu:v1:alice": "false",
		"document-type-menu:v1:alice": "true",
		"inquiry-case-menu:v1:alice": "false",
		"funds-case-menu:v1:bob": "true",
	});
	expect(readWorkspaceMenuPinned("alice", storage)).toBe(true);
	writeWorkspaceMenuPinned("alice", true, storage);
	expect([...storage.data.entries()]).toEqual([
		["funds-case-menu:v1:bob", "true"],
		[workspaceMenuStorageKey("alice"), "true"],
	]);
	expect(readWorkspaceMenuPinned("alice", storage)).toBe(true);
	writeWorkspaceMenuPinned("alice", false, storage);
	expect(readWorkspaceMenuPinned("alice", storage)).toBe(false);
	expect(readWorkspaceMenuPinned("bob", storage)).toBe(true);
});

test("新偏好优先，旧窗口留下的固定值和损坏值不会重新开启菜单固定", () => {
	const storage = preferenceStorage({
		[workspaceMenuStorageKey("alice")]: "false",
		"funds-case-menu:v1:alice": "true",
	});
	expect(readWorkspaceMenuPinned("alice", storage)).toBe(false);
	storage.setItem(workspaceMenuStorageKey("alice"), "invalid");
	expect(readWorkspaceMenuPinned("alice", storage)).toBe(false);
	expect(readWorkspaceMenuPinned("new-user", storage)).toBe(false);
});

test("写入失败保留旧固定偏好，读取被禁用时安全回退", () => {
	const storage = preferenceStorage({ "inquiry-case-menu:v1:alice": "true" });
	const blockedWrite = {
		...storage,
		setItem: () => {
			throw new Error("storage unavailable");
		},
	};
	writeWorkspaceMenuPinned("alice", false, blockedWrite);
	expect(storage.getItem("inquiry-case-menu:v1:alice")).toBe("true");
	expect(storage.getItem(workspaceMenuStorageKey("alice"))).toBeNull();
	expect(
		readWorkspaceMenuPinned("alice", {
			...storage,
			getItem: () => {
				throw new Error("storage unavailable");
			},
		}),
	).toBe(false);
});

test("内部页面识别为同一菜单，未知或相似路由不会误选内容", () => {
	expect(workspaceMenuForPath("/funds/cases")).toBe("funds");
	expect(workspaceMenuForPath("/documents")).toBe("documents");
	expect(workspaceMenuForPath("/inquiries")).toBe("inquiries");
	expect(workspaceMenuForPath("/funds-other")).toBeNull();
	expect(workspaceMenuForPath("/settings/profile")).toBeNull();
});
