/**
 * @file 本地字体的名称、CSS 变量与分组目录。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：types、utils、utils/theme、components/layout、components/theme-editor、lib。
 * 调用：无模块依赖。
 * 功能：提供字体选项及可推导的 FontKey。
 * 预期结果：选择器与主题应用使用同一组已打包字体。
 */
export type FontGroup = "sans" | "mono" | "serif";

export const FONT_CONFIG = {
	geist: {
		label: "Geist",
		variable: "--font-geist-sans",
		group: "sans",
	},
	"dm-sans": {
		label: "DM Sans",
		variable: "--font-dm-sans",
		group: "sans",
	},
	figtree: {
		label: "Figtree",
		variable: "--font-figtree",
		group: "sans",
	},
	inter: {
		label: "Inter",
		variable: "--font-inter",
		group: "sans",
	},
	"noto-sans": {
		label: "Noto Sans",
		variable: "--font-noto-sans",
		group: "sans",
	},
	"nunito-sans": {
		label: "Nunito Sans",
		variable: "--font-nunito-sans",
		group: "sans",
	},
	outfit: {
		label: "Outfit",
		variable: "--font-outfit",
		group: "sans",
	},
	"public-sans": {
		label: "Public Sans",
		variable: "--font-public-sans",
		group: "sans",
	},
	raleway: {
		label: "Raleway",
		variable: "--font-raleway",
		group: "sans",
	},
	roboto: {
		label: "Roboto",
		variable: "--font-roboto",
		group: "sans",
	},
	"geist-mono": {
		label: "Geist Mono",
		variable: "--font-geist-mono",
		group: "mono",
	},
	"jetbrains-mono": {
		label: "JetBrains Mono",
		variable: "--font-jetbrains-mono",
		group: "mono",
	},
	lora: { label: "Lora", variable: "--font-lora", group: "serif" },
	merriweather: {
		label: "Merriweather",
		variable: "--font-merriweather",
		group: "serif",
	},
	"noto-serif": {
		label: "Noto Serif",
		variable: "--font-noto-serif",
		group: "serif",
	},
	"playfair-display": {
		label: "Playfair Display",
		variable: "--font-playfair-display",
		group: "serif",
	},
	"roboto-slab": {
		label: "Roboto Slab",
		variable: "--font-roboto-slab",
		group: "serif",
	},
	"geist-pixel": {
		label: "Geist Pixel",
		variable: "--font-geist-pixel-square",
		group: "mono",
	},
} as const satisfies Record<
	string,
	{ label: string; variable: `--font-${string}`; group: FontGroup }
>;

export const FONT_GROUPS: { key: FontGroup; label: string }[] = [
	{ key: "sans", label: "无衬线" },
	{ key: "mono", label: "等宽" },
	{ key: "serif", label: "衬线" },
];

export type FontKey = keyof typeof FONT_CONFIG;
