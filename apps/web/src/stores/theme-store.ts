/**
 * @file 应用共享的主题偏好与编辑器会话状态。
 * 创建时间：2026-10-04
 * 修改时间：2026-10-04
 * 版本作用：Zustand 状态入口，沿用主题快照 v2。
 * 被调用：main.tsx、components/layout、components/theme-editor、test/theme-store.test.ts。
 * 调用：zustand、React ref 类型、configs/theme-settings、lib/theme-settings、lib/custom-themes、types/theme、浏览器存储与消息 API。
 * 功能：更新偏好、保存主题库、发布预览及同步其他窗口的已保存选择。
 * 预期结果：组件按字段订阅；草稿预览与面板状态不写入存储或广播。
 */
import type { RefObject } from "react";
import { create } from "zustand";
import { THEME_STORAGE_KEY } from "@/configs/theme-settings";
import { deleteCustomTheme, saveCustomTheme } from "@/lib/custom-themes";
import {
	decodeThemePreferences,
	encodeThemePreferences,
	readThemePreferences,
} from "@/lib/theme-settings";
import type {
	CustomThemeId,
	Settings,
	ThemeDraft,
	ThemePreferences,
	ThemePreview,
} from "@/types/theme";

type ThemeState = {
	preferences: ThemePreferences;
	preview: ThemePreview | null;
	themeEditorOpen: boolean;
	// ref 由入口组件持有，卸载时 React 会清空 current，避免聚焦已移除的按钮。
	themeEditorTrigger: RefObject<HTMLButtonElement | null> | null;
	/** 合并偏好；选中自定义主题时一并采用其字体和圆角，显式字段优先。存储失败仍供本窗口使用。 */
	updateSettings: (settings: Partial<Settings>) => void;
	/** 发布本窗口的临时样式；null 恢复已保存偏好，不影响其他窗口。 */
	setThemePreview: (preview: ThemePreview | null) => void;
	/** 保存并应用草稿；省略 ID 时新建。校验或落盘失败会抛错，保留原偏好与预览。 */
	saveTheme: (draft: ThemeDraft, id?: CustomThemeId) => void;
	/** 删除指定主题；当前选择被删除时回退默认，落盘失败时不修改状态。 */
	deleteTheme: (id: CustomThemeId) => void;
	/** 设置面板开关；打开时可传入入口 ref，供关闭后恢复焦点。 */
	setThemeEditorOpen: (
		open: boolean,
		trigger?: RefObject<HTMLButtonElement | null>,
	) => void;
};

/**
 * 主题的唯一共享状态入口；React 调用时必须传 selector，只订阅所需字段。
 * 首屏通过 getState 读取同一份已解码偏好，浏览器监听由根布局挂载后建立。
 */
export const useThemeStore = create<ThemeState>()((set, get) => {
	const persistPreferences = (
		preferences: ThemePreferences,
		requirePersistence = false,
	) => {
		// 自定义主题必须先落盘再发布；不能把写入失败显示为保存成功。
		try {
			localStorage.setItem(
				THEME_STORAGE_KEY,
				JSON.stringify(encodeThemePreferences(preferences)),
			);
		} catch {
			if (requirePersistence) {
				throw new Error(
					"本地存储不可用或空间不足，主题尚未保存。请导出 CSS 备份。",
				);
			}
		}
		set({ preferences });
	};

	return {
		preferences: readThemePreferences(),
		preview: null,
		themeEditorOpen: false,
		themeEditorTrigger: null,
		updateSettings: (settings) => {
			const preferences = get().preferences;
			const selected = preferences.customThemes.find(
				(theme) => theme.id === settings.themePreset,
			);
			persistPreferences({
				...preferences,
				settings: {
					...preferences.settings,
					...(selected ? { font: selected.font, radius: selected.radius } : {}),
					...settings,
				},
			});
		},
		setThemePreview: (preview) => set({ preview }),
		saveTheme: (draft, id = `custom:${crypto.randomUUID()}`) => {
			persistPreferences(saveCustomTheme(get().preferences, draft, id), true);
			set({ preview: null });
		},
		deleteTheme: (id) => {
			persistPreferences(deleteCustomTheme(get().preferences, id), true);
		},
		setThemeEditorOpen: (themeEditorOpen, trigger) =>
			set({
				themeEditorOpen,
				...(trigger ? { themeEditorTrigger: trigger } : {}),
			}),
	};
});

/**
 * 在根布局挂载期间连接同源窗口；只发送偏好，接收更新不再次广播。
 * storage 是持久化同步的后备通道；BroadcastChannel 同时覆盖无法写入存储的会话。
 * @returns 取消订阅、移除事件并关闭通道的清理函数，供 React effect 使用。
 */
export function connectThemeSync() {
	let channel: BroadcastChannel | null = null;
	let receiving = false;
	const receive = (preferences: ThemePreferences) => {
		// 同一次修改可能从两个通道抵达；相同快照不重复通知消费者。
		if (
			JSON.stringify(encodeThemePreferences(preferences)) ===
			JSON.stringify(
				encodeThemePreferences(useThemeStore.getState().preferences),
			)
		) {
			return;
		}
		receiving = true;
		try {
			useThemeStore.setState({ preferences });
		} finally {
			receiving = false;
		}
	};
	const onStorage = (event: StorageEvent) => {
		if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
		if (event.storageArea && event.storageArea !== localStorage) return;
		let payload: unknown = null;
		try {
			payload = JSON.parse(event.newValue ?? "null");
		} catch {
			// 损坏或清空的快照按启动时的相同规则回退。
		}
		receive(decodeThemePreferences(payload));
	};

	try {
		channel = new BroadcastChannel(THEME_STORAGE_KEY);
		channel.onmessage = (
			event: MessageEvent<{ type?: unknown; payload?: unknown } | null>,
		) => {
			if (event.data?.type !== "SETTINGS_UPDATED") return;
			const preferences = decodeThemePreferences(event.data.payload);
			try {
				localStorage.setItem(
					THEME_STORAGE_KEY,
					JSON.stringify(encodeThemePreferences(preferences)),
				);
			} catch {
				// 接收窗口禁用存储时，仍可在当前会话应用偏好。
			}
			receive(preferences);
		};
	} catch {
		// 不支持或禁止 BroadcastChannel 的环境继续使用 storage 事件。
	}
	window.addEventListener("storage", onStorage);
	const unsubscribe = useThemeStore.subscribe((state, previous) => {
		if (receiving || state.preferences === previous.preferences) return;
		try {
			channel?.postMessage({
				type: "SETTINGS_UPDATED",
				payload: encodeThemePreferences(state.preferences),
			});
		} catch {
			// 通道发送失败不回滚已保存设置；storage 仍可通知其他窗口。
		}
	});
	return () => {
		unsubscribe();
		window.removeEventListener("storage", onStorage);
		channel?.close();
	};
}
