// Type Imports

import type { FontKey } from "@/configs/fonts";
import type { ThemePresetKey } from "@/configs/theme-presets";
// Config Imports
import themeConfig from "@/configs/themeConfig";
import type { Radius, Settings } from "@/types/theme";

/*
 * 原模板默认配置与圆角映射，在浏览器启动和主题上下文中共用。
 */

// Radius values (rem) mapped from the radius setting
export const RADIUS_VALUES: Record<Radius, string> = {
	none: "0rem",
	sm: "0.45rem",
	md: "0.625rem",
	lg: "0.875rem",
};

// Initial settings – derived from themeConfig so users only need to edit one file
export const initialSettings: Settings = {
	mode: themeConfig.mode,
	themePreset: themeConfig.themePreset as ThemePresetKey,
	font: themeConfig.font as FontKey,
	radius: themeConfig.radius,
	scale: themeConfig.scale,
};
