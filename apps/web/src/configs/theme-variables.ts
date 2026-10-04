/**
 * @file 主题编辑与导入允许操作的变量集合。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：utils/theme-script.ts、utils/theme/parse-css-input.ts、lib/custom-themes.ts。
 * 调用：无模块依赖。
 * 功能：区分语义色、阴影参数和生成后的阴影令牌。
 * 预期结果：导入和存储校验不会开放额外字号、间距或任意 CSS 属性。
 */
export const COLOR_KEYS = [
	"primary",
	"primary-foreground",
	"secondary",
	"secondary-foreground",
	"destructive",
	"destructive-foreground",
	"background",
	"foreground",
	"card",
	"card-foreground",
	"popover",
	"popover-foreground",
	"muted",
	"muted-foreground",
	"accent",
	"accent-foreground",
	"border",
	"input",
	"ring",
	"sidebar",
	"sidebar-foreground",
	"sidebar-primary",
	"sidebar-primary-foreground",
	"sidebar-accent",
	"sidebar-accent-foreground",
	"sidebar-border",
	"sidebar-ring",
	"chart-1",
	"chart-2",
	"chart-3",
	"chart-4",
	"chart-5",
] as const;

const SHADOW_KEYS = [
	"shadow-color",
	"shadow-opacity",
	"shadow-blur",
	"shadow-spread",
	"shadow-offset-x",
	"shadow-offset-y",
] as const;

export const SHADOW_VARS = [
	"shadow-2xs",
	"shadow-xs",
	"shadow-sm",
	"shadow",
	"shadow-md",
	"shadow-lg",
	"shadow-xl",
	"shadow-2xl",
] as const;

export const EDITABLE_STYLE_KEYS = [
	...COLOR_KEYS,
	...SHADOW_KEYS,
	"letter-spacing",
] as const;
