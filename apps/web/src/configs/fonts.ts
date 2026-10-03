export type FontGroup = "sans" | "mono" | "serif";

export const FONT_CONFIG = {
	geist: {
		label: "Geist",
		variable: "--font-geist-sans",
		group: "sans" as FontGroup,
	},
	"dm-sans": {
		label: "DM Sans",
		variable: "--font-dm-sans",
		group: "sans" as FontGroup,
	},
	figtree: {
		label: "Figtree",
		variable: "--font-figtree",
		group: "sans" as FontGroup,
	},
	inter: {
		label: "Inter",
		variable: "--font-inter",
		group: "sans" as FontGroup,
	},
	"noto-sans": {
		label: "Noto Sans",
		variable: "--font-noto-sans",
		group: "sans" as FontGroup,
	},
	"nunito-sans": {
		label: "Nunito Sans",
		variable: "--font-nunito-sans",
		group: "sans" as FontGroup,
	},
	outfit: {
		label: "Outfit",
		variable: "--font-outfit",
		group: "sans" as FontGroup,
	},
	"public-sans": {
		label: "Public Sans",
		variable: "--font-public-sans",
		group: "sans" as FontGroup,
	},
	raleway: {
		label: "Raleway",
		variable: "--font-raleway",
		group: "sans" as FontGroup,
	},
	roboto: {
		label: "Roboto",
		variable: "--font-roboto",
		group: "sans" as FontGroup,
	},
	"geist-mono": {
		label: "Geist Mono",
		variable: "--font-geist-mono",
		group: "mono" as FontGroup,
	},
	"jetbrains-mono": {
		label: "JetBrains Mono",
		variable: "--font-jetbrains-mono",
		group: "mono" as FontGroup,
	},
	lora: { label: "Lora", variable: "--font-lora", group: "serif" as FontGroup },
	merriweather: {
		label: "Merriweather",
		variable: "--font-merriweather",
		group: "serif" as FontGroup,
	},
	"noto-serif": {
		label: "Noto Serif",
		variable: "--font-noto-serif",
		group: "serif" as FontGroup,
	},
	"playfair-display": {
		label: "Playfair Display",
		variable: "--font-playfair-display",
		group: "serif" as FontGroup,
	},
	"roboto-slab": {
		label: "Roboto Slab",
		variable: "--font-roboto-slab",
		group: "serif" as FontGroup,
	},
	"geist-pixel": {
		label: "Geist Pixel",
		variable: "--font-geist-pixel-square",
		group: "mono" as FontGroup,
	},
} as const;

export const FONT_GROUPS: { key: FontGroup; label: string }[] = [
	{ key: "sans", label: "无衬线" },
	{ key: "mono", label: "等宽" },
	{ key: "serif", label: "衬线" },
];

export type FontKey = keyof typeof FONT_CONFIG;
