/**
 * @file 共享二级菜单宽度偏好的持久化和隔离回归。
 * 创建时间：2026-11-04；修改时间：2026-11-04。
 * 版本作用：覆盖数值校验、用户隔离、默认回退及浏览器存储失败。
 * 被调用：Bun test、test:ui；调用：workspace-menu-width。
 * 预期结果：宽度保持 rem 数值且不覆盖固定偏好，坏值或禁用存储不会破坏布局。
 */
import { expect, test } from "bun:test";
import {
	isWorkspaceMenuWidth,
	readWorkspaceMenuWidth,
	workspaceMenuWidthStorageKey,
	writeWorkspaceMenuWidth,
} from "../src/lib/workspace-menu-width";

function preferenceStorage(values: Record<string, string> = {}) {
	const data = new Map(Object.entries(values));
	return {
		data,
		getItem: (key: string) => data.get(key) ?? null,
		setItem: (key: string, value: string) => {
			data.set(key, value);
		},
	};
}

test("同一用户共用一份 rem 宽度，其他用户与固定偏好不受影响", () => {
	const storage = preferenceStorage({
		"workspace-menu:v1:alice": "true",
		[workspaceMenuWidthStorageKey("bob")]: "21.5",
	});
	expect(readWorkspaceMenuWidth("alice", storage)).toBeNull();
	writeWorkspaceMenuWidth("alice", 18.375, storage);
	expect(readWorkspaceMenuWidth("alice", storage)).toBe(18.375);
	expect(storage.getItem(workspaceMenuWidthStorageKey("alice"))).toBe("18.375");
	expect(readWorkspaceMenuWidth("bob", storage)).toBe(21.5);
	expect(storage.getItem("workspace-menu:v1:alice")).toBe("true");
	writeWorkspaceMenuWidth("alice", 24, storage);
	expect(readWorkspaceMenuWidth("alice", storage)).toBe(24);
	expect(readWorkspaceMenuWidth("bob", storage)).toBe(21.5);
});

test("缺失、删除、清空和损坏的宽度偏好回退共享默认值", () => {
	const key = workspaceMenuWidthStorageKey("alice");
	const storage = preferenceStorage();
	expect(readWorkspaceMenuWidth("alice", storage)).toBeNull();
	for (const value of [
		"",
		"not-json",
		"NaN",
		"Infinity",
		"1e100",
		"0",
		"-12",
		"null",
		"true",
		'"18"',
		'"18rem"',
		"[]",
		"{}",
	]) {
		storage.setItem(key, value);
		expect(readWorkspaceMenuWidth("alice", storage)).toBeNull();
	}
	writeWorkspaceMenuWidth("alice", 20, storage);
	storage.data.delete(key);
	expect(readWorkspaceMenuWidth("alice", storage)).toBeNull();
	writeWorkspaceMenuWidth("alice", 20, storage);
	storage.data.clear();
	expect(readWorkspaceMenuWidth("alice", storage)).toBeNull();
});

test("拒绝非数值和非有限提交，不覆盖上一次有效宽度", () => {
	const storage = preferenceStorage();
	writeWorkspaceMenuWidth("alice", 19.5, storage);
	for (const value of [
		0,
		-1,
		Number.NaN,
		Number.POSITIVE_INFINITY,
		Number.NEGATIVE_INFINITY,
		1e100,
	]) {
		expect(isWorkspaceMenuWidth(value)).toBe(false);
		writeWorkspaceMenuWidth("alice", value, storage);
		expect(readWorkspaceMenuWidth("alice", storage)).toBe(19.5);
	}
	for (const value of [null, undefined, "20", true, {}, []])
		expect(isWorkspaceMenuWidth(value)).toBe(false);
	expect(isWorkspaceMenuWidth(20.125)).toBe(true);
});

test("读取和写入被禁用时安全返回，原有持久偏好保持不变", () => {
	const storage = preferenceStorage({
		[workspaceMenuWidthStorageKey("alice")]: "17.25",
	});
	expect(
		readWorkspaceMenuWidth("alice", {
			...storage,
			getItem: () => {
				throw new Error("storage unavailable");
			},
		}),
	).toBeNull();
	expect(() =>
		writeWorkspaceMenuWidth("alice", 23, {
			...storage,
			setItem: () => {
				throw new Error("storage unavailable");
			},
		}),
	).not.toThrow();
	expect(readWorkspaceMenuWidth("alice", storage)).toBe(17.25);
});
