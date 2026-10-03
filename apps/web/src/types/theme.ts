// Config Imports
import type { FontKey } from "@/configs/fonts";
import type { ThemePresetKey } from "@/configs/theme-presets";

// ── Theme preset shape (CSS custom-property values per light/dark mode) ───────
export type ThemeStyleProps = {
	background: string;
	foreground: string;
	card: string;
	"card-foreground": string;
	popover: string;
	"popover-foreground": string;
	primary: string;
	"primary-foreground": string;
	secondary: string;
	"secondary-foreground": string;
	muted: string;
	"muted-foreground": string;
	accent: string;
	"accent-foreground": string;
	destructive: string;
	"destructive-foreground": string;
	border: string;
	input: string;
	ring: string;
	"chart-1": string;
	"chart-2": string;
	"chart-3": string;
	"chart-4": string;
	"chart-5": string;
	sidebar: string;
	"sidebar-foreground": string;
	"sidebar-primary": string;
	"sidebar-primary-foreground": string;
	"sidebar-accent": string;
	"sidebar-accent-foreground": string;
	"sidebar-border": string;
	"sidebar-ring": string;
	radius: string;
	"shadow-color"?: string;
	"shadow-opacity"?: string;
	"shadow-blur"?: string;
	"shadow-spread"?: string;
	"shadow-offset-x"?: string;
	"shadow-offset-y"?: string;
	"letter-spacing"?: string;
	spacing?: string;
	"font-sans"?: string;
	"font-serif"?: string;
	"font-mono"?: string;
};

export type ThemeStyles = {
	light: Partial<ThemeStyleProps>;
	dark: Partial<ThemeStyleProps>;
};

export type ThemePreset = {
	label: string;
	styles: ThemeStyles;
};

// ── Theme customizer settings ─────────────────────────────────────────────────
export type Mode = "light" | "dark" | "system";
export type Radius = "none" | "sm" | "md" | "lg";
export type Scale = "sm" | "md" | "lg" | "xl";

export type Settings = {
	mode: Mode;
	themePreset: ThemePresetKey | CustomThemeId;
	radius: Radius;
	scale: Scale;
	font: FontKey;
};

export type CustomThemeId = `custom:${string}`;

export type ThemeDraft = {
	label: string;
	styles: ThemeStyles;
	font: FontKey;
	radius: Radius;
};

export type CustomTheme = ThemeDraft & { id: CustomThemeId };

// 主题库与选择项作为一个快照保存，避免跨窗口或刷新时出现悬空选择。
export type ThemePreferences = {
	settings: Settings;
	customThemes: CustomTheme[];
};

export type ThemePreview = { draft: ThemeDraft; mode: "light" | "dark" };
