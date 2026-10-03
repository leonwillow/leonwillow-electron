// React Imports

// Third-party Imports
import { useTheme } from "next-themes";
import type { ReactNode } from "react";
import { useEffect, useEffectEvent, useRef, useState } from "react";

// Config Imports
import themeConfig from "@/configs/themeConfig";
import { SettingsContext } from "@/contexts/settings-state";
// Hook Imports
import { useObjectStorage } from "@/hooks/use-object-storage";
import { deleteCustomTheme, saveCustomTheme } from "@/lib/custom-themes";
import {
	decodeThemePreferences,
	encodeThemePreferences,
} from "@/lib/theme-settings";
// Type Imports
import type {
	CustomThemeId,
	Settings,
	ThemeDraft,
	ThemePreferences,
	ThemePreview,
} from "@/types/theme";
import { applyTheme } from "@/utils/theme-script";

type BroadcastMessage = {
	type: "SETTINGS_UPDATED";
	payload: ReturnType<typeof encodeThemePreferences>;
};

type Props = {
	children: ReactNode;
	savedPreferences: ThemePreferences;
};

// Ignore the mode hotkey while the user is typing in a field
const isTypingTarget = (target: EventTarget | null) => {
	if (!(target instanceof HTMLElement)) {
		return false;
	}

	return (
		target.isContentEditable ||
		target.tagName === "INPUT" ||
		target.tagName === "TEXTAREA" ||
		target.tagName === "SELECT"
	);
};

export const SettingsProvider = (props: Props) => {
	const { children } = props;

	const { setTheme, resolvedTheme } = useTheme();

	const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

	const [preferences, updateStoredSettings] =
		useObjectStorage<ThemePreferences>(
			themeConfig.settingsStorageKey,
			props.savedPreferences,
			decodeThemePreferences,
			encodeThemePreferences,
		);
	const settings = preferences.settings;
	const [preview, setThemePreview] = useState<ThemePreview | null>(null);

	useEffect(() => {
		if (typeof window !== "undefined" && "BroadcastChannel" in window) {
			try {
				if (!broadcastChannelRef.current) {
					broadcastChannelRef.current = new BroadcastChannel(
						themeConfig.settingsStorageKey,
					);
				}

				const handleMessage = (event: MessageEvent<BroadcastMessage>) => {
					if (event.data?.type !== "SETTINGS_UPDATED") return;
					const { type, payload } = event.data;

					if (type === "SETTINGS_UPDATED") {
						updateStoredSettings(decodeThemePreferences(payload));
					}
				};

				broadcastChannelRef.current.onmessage = handleMessage;

				return () => {
					broadcastChannelRef.current?.close();
					broadcastChannelRef.current = null;
				};
			} catch (error) {
				console.error("BroadcastChannel error:", error);

				if (broadcastChannelRef.current) {
					try {
						broadcastChannelRef.current.close();
					} catch {
						// Ignore close errors
					}

					broadcastChannelRef.current = null;
				}
			}
		}
	}, [updateStoredSettings]);

	const broadcastSettingsUpdate = (updatedSettings: ThemePreferences) => {
		if (typeof window === "undefined" || !("BroadcastChannel" in window)) {
			return;
		}

		if (!broadcastChannelRef.current) {
			try {
				broadcastChannelRef.current = new BroadcastChannel(
					themeConfig.settingsStorageKey,
				);
			} catch (error) {
				console.error("Failed to create BroadcastChannel", error);

				return;
			}
		}

		try {
			broadcastChannelRef.current.postMessage({
				type: "SETTINGS_UPDATED",
				payload: encodeThemePreferences(updatedSettings),
			});
		} catch (error) {
			console.error("Failed to broadcast settings update", error);

			try {
				broadcastChannelRef.current.close();
			} catch {
				// Ignore close errors
			}

			broadcastChannelRef.current = null;
		}
	};

	const persistPreferences = (
		next: ThemePreferences,
		requirePersistence = false,
	) => {
		if (!updateStoredSettings(next, requirePersistence) && requirePersistence) {
			throw new Error(
				"本地存储不可用或空间不足，主题尚未保存。请导出 CSS 备份。",
			);
		}
		broadcastSettingsUpdate(next);
	};

	const updateSettings = (newSettings: Partial<Settings>) => {
		const selected = preferences.customThemes.find(
			(theme) => theme.id === newSettings.themePreset,
		);
		const updatedSettings = {
			...settings,
			...(selected ? { font: selected.font, radius: selected.radius } : {}),
			...newSettings,
		};
		persistPreferences({ ...preferences, settings: updatedSettings });
	};

	const saveTheme = (
		draft: ThemeDraft,
		id: CustomThemeId = `custom:${crypto.randomUUID()}`,
	) => {
		persistPreferences(saveCustomTheme(preferences, draft, id), true);
		setThemePreview(null);
	};

	const deleteTheme = (id: CustomThemeId) => {
		persistPreferences(deleteCustomTheme(preferences, id), true);
	};

	useEffect(() => {
		setTheme(preview?.mode ?? settings.mode);
	}, [preview?.mode, settings.mode, setTheme]);

	const toggleMode = useEffectEvent(() => {
		// 编辑时用面板模式控件预览，快捷键不改动草稿背后的持久化偏好。
		if (preview) return;
		updateSettings({ mode: resolvedTheme === "dark" ? "light" : "dark" });
	});

	// Press "d" to toggle light/dark (routed through settings so persisted settings stay in sync)
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (
				event.defaultPrevented ||
				event.repeat ||
				event.metaKey ||
				event.ctrlKey ||
				event.altKey
			) {
				return;
			}

			if (event.key?.toLowerCase() !== "d" || isTypingTarget(event.target)) {
				return;
			}

			toggleMode();
		};

		window.addEventListener("keydown", onKeyDown);

		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);

	useEffect(() => {
		applyTheme(
			preferences,
			preview?.mode ?? (resolvedTheme === "dark" ? "dark" : "light"),
			preview?.draft,
		);
	}, [preferences, resolvedTheme, preview]);

	return (
		<SettingsContext.Provider
			value={{
				settings,
				customThemes: preferences.customThemes,
				updateSettings,
				setThemePreview,
				saveTheme,
				deleteTheme,
			}}
		>
			{children}
		</SettingsContext.Provider>
	);
};
