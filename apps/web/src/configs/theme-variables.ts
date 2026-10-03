// shadcn Studio ThemeColorPanel 的五组语义变量；补充当前模板的危险操作前景色。
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

export const SHADOW_KEYS = [
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
