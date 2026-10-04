/**
 * @file 主题偏好存储版本的回归测试。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：当前行为的回归约束，不进入产品构建。
 * 被调用：Bun 测试命令。
 * 调用：bun:test、../src/configs/theme-settings、../src/lib/theme-settings。
 * 功能：检查旧三档迁移、四档往返及损坏设置的字段回退。
 * 预期结果：新版大档不会重复迁移为特大。
 */
import { expect, test } from "bun:test";
import { initialSettings } from "../src/configs/theme-settings";
import {
	decodeStoredSettings,
	encodeStoredSettings,
	normalizeSettings,
} from "../src/lib/theme-settings";

test("旧版大档迁移为特大，保留其他偏好", () => {
	expect(
		decodeStoredSettings({
			...initialSettings,
			scale: "lg",
			font: "inter",
			radius: "lg",
		}),
	).toEqual({ ...initialSettings, scale: "xl", font: "inter", radius: "lg" });
});

test("新四档可以独立保存和恢复，大档不会被再次迁移", () => {
	for (const scale of ["sm", "md", "lg", "xl"] as const) {
		const settings = { ...initialSettings, scale };
		expect(
			decodeStoredSettings(
				JSON.parse(JSON.stringify(encodeStoredSettings(settings))),
			),
		).toEqual(settings);
		expect(normalizeSettings(settings).scale).toBe(scale);
	}
});

test("损坏和过期设置回退到有效默认值", () => {
	expect(decodeStoredSettings(null)).toEqual(initialSettings);
	expect(decodeStoredSettings({ scale: "unknown", font: "missing" })).toEqual(
		initialSettings,
	);
});
