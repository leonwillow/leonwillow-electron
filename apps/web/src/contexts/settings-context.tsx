// React Imports

// Third-party Imports
import { useTheme } from "next-themes";
import type { ReactNode } from "react";
import {
	createContext,
	useEffect,
	useEffectEvent,
	useMemo,
	useRef,
} from "react";
import { FONT_CONFIG } from "@/configs/fonts";
import { themePresets } from "@/configs/theme-presets";
import { initialSettings, RADIUS_VALUES } from "@/configs/theme-settings";

// Config Imports
import themeConfig from "@/configs/themeConfig";
// Hook Imports
import { useObjectStorage } from "@/hooks/use-object-storage";
import {
	decodeStoredSettings,
	encodeStoredSettings,
} from "@/lib/theme-settings";
// Type Imports
import type { Settings } from "@/types/theme";

const PRESET_CSS_VARS = [
	"background",
	"foreground",
	"card",
	"card-foreground",
	"popover",
	"popover-foreground",
	"primary",
	"primary-foreground",
	"secondary",
	"secondary-foreground",
	"muted",
	"muted-foreground",
	"accent",
	"accent-foreground",
	"destructive",
	"destructive-foreground",
	"letter-spacing",
	"spacing",
	"border",
	"input",
	"ring",
	"chart-1",
	"chart-2",
	"chart-3",
	"chart-4",
	"chart-5",
	"sidebar",
	"sidebar-foreground",
	"sidebar-primary",
	"sidebar-primary-foreground",
	"sidebar-accent",
	"sidebar-accent-foreground",
	"sidebar-border",
	"sidebar-ring",
	"shadow-color",
	"shadow-opacity",
	"shadow-blur",
	"shadow-spread",
	"shadow-offset-x",
	"shadow-offset-y",
] as const;

type BroadcastMessage = {
	type: "SETTINGS_UPDATED";
	payload: ReturnType<typeof encodeStoredSettings>;
};

type SettingsContextProps = {
	settings: Settings;
	updateSettings: (settings: Partial<Settings>) => void;
};

type Props = {
	children: ReactNode;
	savedSettings?: Settings;
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

export const SettingsContext = createContext<SettingsContextProps | null>(null);

export const SettingsProvider = (props: Props) => {
	const { children } = props;

	const { setTheme, resolvedTheme } = useTheme();

	const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

	const [storedSettings, updateStoredSettings] = useObjectStorage<Settings>(
		themeConfig.settingsStorageKey,
		{
			...initialSettings,
			...props.savedSettings,
		},
		decodeStoredSettings,
		encodeStoredSettings,
	);

	const settings: Settings = useMemo(
		() => ({ ...initialSettings, ...storedSettings }),
		[storedSettings],
	);

	useEffect(() => {
		if (typeof window !== "undefined" && "BroadcastChannel" in window) {
			try {
				if (!broadcastChannelRef.current) {
					broadcastChannelRef.current = new BroadcastChannel(
						themeConfig.settingsStorageKey,
					);
				}

				const handleMessage = (event: MessageEvent<BroadcastMessage>) => {
					const { type, payload } = event.data;

					if (type === "SETTINGS_UPDATED") {
						updateStoredSettings(decodeStoredSettings(payload));
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

	const broadcastSettingsUpdate = (updatedSettings: Settings) => {
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
				payload: encodeStoredSettings(updatedSettings),
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

	const updateSettings = (newSettings: Partial<Settings>) => {
		const updatedSettings = { ...settings, ...newSettings };

		updateStoredSettings(updatedSettings);

		if (newSettings.mode) {
			setTheme(newSettings.mode);
		}

		broadcastSettingsUpdate(updatedSettings);
	};

	useEffect(() => {
		setTheme(settings.mode);
	}, [settings.mode, setTheme]);

	const toggleMode = useEffectEvent(() => {
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
		const root = document.documentElement;

		PRESET_CSS_VARS.forEach((key) => {
			root.style.removeProperty(`--${key}`);
		});

		if (settings.themePreset === "default") {
			root.style.setProperty("--radius", RADIUS_VALUES[settings.radius]);
			return;
		}

		const preset = themePresets[settings.themePreset];

		if (!preset) return;

		const mode = resolvedTheme === "dark" ? "dark" : "light";

		Object.entries(preset.styles[mode]).forEach(([key, value]) => {
			if (value !== undefined && key !== "radius" && key !== "spacing")
				root.style.setProperty(`--${key}`, value as string);
		});
		root.style.setProperty("--radius", RADIUS_VALUES[settings.radius]);
	}, [settings.themePreset, resolvedTheme, settings.radius]);

	useEffect(() => {
		document.documentElement.style.setProperty(
			"--radius",
			RADIUS_VALUES[settings.radius],
		);
	}, [settings.radius]);

	useEffect(() => {
		document.documentElement.setAttribute("data-theme-scale", settings.scale);
	}, [settings.scale]);

	useEffect(() => {
		const root = document.documentElement;
		const fontVar =
			FONT_CONFIG[settings.font]?.variable ?? "--font-public-sans";

		root.style.setProperty("--font-sans", `var(${fontVar})`);
		root.style.setProperty("font-family", `var(${fontVar})`);
	}, [settings.font]);

	return (
		<SettingsContext.Provider value={{ settings, updateSettings }}>
			{children}
		</SettingsContext.Provider>
	);
};
