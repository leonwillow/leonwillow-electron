/**
 * @file 主题默认偏好、存储键和圆角映射。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-11-10
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：apps/web/test、contexts、utils、utils/theme、components/layout、components/theme-editor、lib。
 * 调用：types/theme。
 * 功能：给首屏、重置与持久化校验提供同一组默认值。
 * 预期结果：修改默认值不会覆盖用户已有偏好。
 */
import type { Radius, Settings } from "@/types/theme";

export const THEME_STORAGE_KEY = "aidesk-theme-settings";

export const RADIUS_VALUES: Record<Radius, string> = {
	none: "0rem",
	sm: "0.45rem",
	md: "0.625rem",
	lg: "0.875rem",
};

// 仅在没有有效偏好或主动重置时采用；修改默认值不会覆盖已有设置。
export const initialSettings: Settings = {
	mode: "system",
	themePreset: "default",
	font: "public-sans",
	radius: "md",
	scale: "md",
	sidebarMode: "docked",
};
