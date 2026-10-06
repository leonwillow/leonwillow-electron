/**
 * @file 主题 Store 的持久化与窗口同步回归测试。
 * 创建时间：2026-10-04
 * 修改时间：2026-10-06
 * 版本作用：验证 Zustand 迁移后的行为，不进入产品构建。
 * 被调用：Bun 测试命令、test:ui。
 * 调用：bun:test、configs/theme-settings、configs/theme-variables、lib/theme-settings、stores/theme-store、types/theme。
 * 功能：检查连续更新、写入失败、临时状态隔离、双通道去重和监听释放。
 * 预期结果：已保存主题可恢复，失败与外部同步均不覆盖本窗口草稿。
 */
import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import {
	initialSettings,
	THEME_STORAGE_KEY,
} from "../src/configs/theme-settings";
import { COLOR_KEYS } from "../src/configs/theme-variables";
import {
	encodeThemePreferences,
	readThemePreferences,
} from "../src/lib/theme-settings";
import { connectThemeSync, useThemeStore } from "../src/stores/theme-store";
import type { ThemeDraft } from "../src/types/theme";

const originalGlobals = Object.fromEntries(
	["localStorage", "window", "BroadcastChannel"].map((name) => [
		name,
		Object.getOwnPropertyDescriptor(globalThis, name),
	]),
);
const draft: ThemeDraft = {
	label: "测试主题",
	font: "inter",
	radius: "lg",
	styles: {
		light: Object.fromEntries(COLOR_KEYS.map((key) => [key, "#6750a4"])),
		dark: Object.fromEntries(COLOR_KEYS.map((key) => [key, "#cdbdff"])),
	},
};
let storage: Map<string, string>;
let setItem: ReturnType<typeof mock<(key: string, value: string) => void>>;
let events: EventTarget;
let disconnect: (() => void) | undefined;

class TestChannel {
	static instances: TestChannel[] = [];
	onmessage: ((event: { data: unknown }) => void) | null = null;
	postMessage = mock((_data: unknown) => {});
	close = mock(() => {});
	constructor() {
		TestChannel.instances.push(this);
	}
}

beforeEach(() => {
	storage = new Map();
	setItem = mock((key: string, value: string) => {
		storage.set(key, value);
	});
	events = new EventTarget();
	TestChannel.instances = [];
	for (const [name, value] of Object.entries({
		localStorage: {
			getItem: (key: string) => storage.get(key) ?? null,
			setItem,
		},
		window: events,
		BroadcastChannel: TestChannel,
	})) {
		Object.defineProperty(globalThis, name, { configurable: true, value });
	}
	useThemeStore.setState(
		{
			...useThemeStore.getInitialState(),
			preferences: { settings: { ...initialSettings }, customThemes: [] },
		},
		true,
	);
});

afterEach(() => {
	disconnect?.();
	disconnect = undefined;
	useThemeStore.setState(useThemeStore.getInitialState(), true);
	for (const [name, descriptor] of Object.entries(originalGlobals)) {
		if (descriptor) Object.defineProperty(globalThis, name, descriptor);
		else Reflect.deleteProperty(globalThis, name);
	}
});

function emitStorage(
	newValue: string | null,
	key: string | null = THEME_STORAGE_KEY,
) {
	events.dispatchEvent(Object.assign(new Event("storage"), { key, newValue }));
}

test("连续操作基于最新状态，写回格式保持 v2 且能由启动入口恢复", () => {
	const { updateSettings } = useThemeStore.getState();
	updateSettings({ scale: "lg" });
	updateSettings({ mode: "dark" });
	expect(useThemeStore.getState().preferences.settings).toMatchObject({
		scale: "lg",
		mode: "dark",
	});
	expect(JSON.parse(storage.get(THEME_STORAGE_KEY) ?? "null")).toEqual({
		...initialSettings,
		version: 2,
		scale: "lg",
		mode: "dark",
		customThemes: [],
	});
	expect(readThemePreferences()).toEqual(useThemeStore.getState().preferences);
});

test("预览与面板开关不写入存储，也不向其他窗口发布", () => {
	disconnect = connectThemeSync();
	const before = useThemeStore.getState().preferences;
	const { setThemePreview, setThemeEditorOpen } = useThemeStore.getState();
	setThemeEditorOpen(true, { current: null });
	setThemePreview({ draft, mode: "dark" });
	setThemePreview(null);
	setThemeEditorOpen(false);
	expect(useThemeStore.getState().preferences).toBe(before);
	expect(setItem).not.toHaveBeenCalled();
	expect(TestChannel.instances[0]?.postMessage).not.toHaveBeenCalled();
});

test("保存后清除预览，切换自定义主题采用字体圆角并保留显式覆盖", () => {
	const { setThemePreview, saveTheme, updateSettings, deleteTheme } =
		useThemeStore.getState();
	setThemePreview({ draft, mode: "dark" });
	saveTheme(draft, "custom:test");
	expect(useThemeStore.getState().preview).toBeNull();
	expect(readThemePreferences().settings).toMatchObject({
		themePreset: "custom:test",
		font: "inter",
		radius: "lg",
	});
	updateSettings({ themePreset: "default", font: "public-sans", radius: "sm" });
	updateSettings({ themePreset: "custom:test", radius: "md" });
	expect(useThemeStore.getState().preferences.settings).toMatchObject({
		font: "inter",
		radius: "md",
	});
	deleteTheme("custom:test");
	expect(readThemePreferences().settings.themePreset).toBe("default");
	expect(readThemePreferences().customThemes).toHaveLength(1);
	expect(readThemePreferences().customThemes[0]?.deletedAt).toBeString();
});

test("存储失败时保存和删除都保留原偏好及草稿，普通设置仍可生效", () => {
	const { saveTheme, deleteTheme, setThemePreview, updateSettings } =
		useThemeStore.getState();
	saveTheme(draft, "custom:test");
	setThemePreview({ draft, mode: "dark" });
	const before = useThemeStore.getState();
	setItem.mockImplementation(() => {
		throw new Error("QuotaExceededError");
	});
	disconnect = connectThemeSync();
	expect(() =>
		saveTheme({ ...draft, label: "修改主题" }, "custom:test"),
	).toThrow("主题尚未保存");
	expect(() => deleteTheme("custom:test")).toThrow("主题尚未保存");
	expect(useThemeStore.getState()).toBe(before);
	expect(TestChannel.instances[0]?.postMessage).not.toHaveBeenCalled();
	updateSettings({ scale: "xl" });
	expect(useThemeStore.getState().preferences.settings.scale).toBe("xl");
	expect(useThemeStore.getState().preview).toBe(before.preview);
	expect(TestChannel.instances[0]?.postMessage).toHaveBeenCalledTimes(1);
});

test("接收消息不反向广播；双通道相同快照只更新一次且保留本窗口预览", () => {
	disconnect = connectThemeSync();
	useThemeStore.getState().setThemePreview({ draft, mode: "dark" });
	const preview = useThemeStore.getState().preview;
	const payload = encodeThemePreferences({
		settings: { ...initialSettings, scale: "lg" },
		customThemes: [],
	});
	const listener = mock(() => {});
	const unsubscribe = useThemeStore.subscribe(listener);
	try {
		TestChannel.instances[0]?.onmessage?.({
			data: { type: "SETTINGS_UPDATED", payload },
		});
		emitStorage(JSON.stringify(payload));
		expect(listener).toHaveBeenCalledTimes(1);
		expect(readThemePreferences().settings.scale).toBe("lg");
		expect(useThemeStore.getState().preview).toBe(preview);
		expect(TestChannel.instances[0]?.postMessage).not.toHaveBeenCalled();
	} finally {
		unsubscribe();
	}
});

test("不支持广播时，storage 仍能迁移旧版、忽略无关键并处理损坏与清空", () => {
	Object.defineProperty(globalThis, "BroadcastChannel", {
		configurable: true,
		value: undefined,
	});
	disconnect = connectThemeSync();
	emitStorage(JSON.stringify({ ...initialSettings, scale: "lg" }));
	expect(useThemeStore.getState().preferences.settings.scale).toBe("xl");
	emitStorage(null, "unrelated-key");
	expect(useThemeStore.getState().preferences.settings.scale).toBe("xl");
	emitStorage("broken json");
	expect(useThemeStore.getState().preferences.settings).toEqual(
		initialSettings,
	);
	emitStorage(JSON.stringify({ ...initialSettings, version: 2, mode: "dark" }));
	emitStorage(null, null);
	expect(useThemeStore.getState().preferences.settings).toEqual(
		initialSettings,
	);
	expect(setItem).not.toHaveBeenCalled();
});

test("挂载清理再挂载不会重复广播，卸载后不再接收 storage 更新", () => {
	const cleanup = connectThemeSync();
	cleanup();
	disconnect = connectThemeSync();
	useThemeStore.getState().updateSettings({ scale: "xl" });
	expect(TestChannel.instances[0]?.close).toHaveBeenCalledTimes(1);
	expect(TestChannel.instances[0]?.postMessage).not.toHaveBeenCalled();
	expect(TestChannel.instances[1]?.postMessage).toHaveBeenCalledTimes(1);
	disconnect();
	disconnect = undefined;
	emitStorage(null);
	expect(useThemeStore.getState().preferences.settings.scale).toBe("xl");
	expect(TestChannel.instances[1]?.close).toHaveBeenCalledTimes(1);
});
