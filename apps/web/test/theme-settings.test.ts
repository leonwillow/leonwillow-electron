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
