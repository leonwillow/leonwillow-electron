/**
 * @file 主题分析工具的 DOM 颜色语义溯源、样式表变量匹配与真实对比度解析器。
 * 创建时间：2026-11-21
 * 修改时间：2026-11-21
 * 版本作用：按类名 → 样式表 CSS 变量 → 祖先继承 → 当前生效色板反查四级管线识别元素颜色归属的中文语义。
 * 被调用：components/theme-inspector/dom-inspector.ts。
 * 调用：chroma-js、utils/theme/semantic-catalog、./theme-inspector-types。
 * 功能：缓存当前生效色板与含变量样式表规则，计算合成不透明背景以准确评估 WCAG 对比度，并标注全局线条色覆盖。
 * 预期结果：悬停高频采样保持亚毫秒级开销，识别全部背景、文字、边框与轮廓语义来源。
 */
import chroma from "chroma-js";
import {
	type ColorChannel,
	computeContrastInfo,
	extractCssVarToken,
	formatColorDetails,
	parseTailwindColorClasses,
	SEMANTIC_COLOR_MAP,
	SEMANTIC_COLOR_TOKENS,
} from "@/utils/theme/semantic-catalog";
import type {
	ElementOverrideItem,
	InspectedColorSlot,
} from "./theme-inspector-types";

type CachedPalette = {
	signature: string;
	entries: { key: string; rgb: [number, number, number]; alpha: number }[];
};

let paletteCache: CachedPalette | null = null;

function readActivePalette(): CachedPalette["entries"] {
	const root = document.documentElement;
	const signature = `${root.className}|${root.style.cssText}`;
	if (paletteCache && paletteCache.signature === signature) {
		return paletteCache.entries;
	}
	const rootStyles = getComputedStyle(root);
	const entries: CachedPalette["entries"] = [];
	for (const token of SEMANTIC_COLOR_TOKENS) {
		const raw = rootStyles.getPropertyValue(token.varName).trim();
		if (!raw) continue;
		try {
			const parsed = chroma(raw);
			const [r, g, b] = parsed.rgb();
			entries.push({
				key: token.key,
				rgb: [Math.round(r), Math.round(g), Math.round(b)],
				alpha: parsed.alpha(),
			});
		} catch {
			// 忽略无法由 chroma 直接解析的动态表达式
		}
	}
	paletteCache = { signature, entries };
	return entries;
}

const PREFERRED_BY_CHANNEL: Record<ColorChannel, readonly string[]> = {
	background: [
		"card",
		"background",
		"muted",
		"sidebar",
		"popover",
		"primary",
		"secondary",
		"accent",
		"sidebar-accent",
		"destructive",
		"info",
		"success",
		"warning",
	],
	color: [
		"foreground",
		"muted-foreground",
		"card-foreground",
		"primary-foreground",
		"primary",
		"sidebar-foreground",
		"accent-foreground",
		"sidebar-accent-foreground",
		"secondary-foreground",
		"destructive-foreground",
		"info-foreground",
		"success-foreground",
		"warning-foreground",
		"popover-foreground",
	],
	border: [
		"border",
		"input",
		"sidebar-border",
		"ring",
		"primary",
		"destructive",
	],
	outline: ["ring", "sidebar-ring", "primary", "destructive", "border"],
};

function matchColorInPalette(
	cssColor: string,
	channel: ColorChannel,
): string | null {
	try {
		const target = chroma(cssColor);
		const alpha = target.alpha();
		if (alpha === 0) return null;
		const [tr, tg, tb] = target.rgb();
		const entries = readActivePalette();
		const order = PREFERRED_BY_CHANNEL[channel];
		const rank = (key: string) => {
			const idx = order.indexOf(key);
			return idx >= 0 ? idx : 999;
		};

		let bestKey: string | null = null;
		let bestScore = Number.POSITIVE_INFINITY;
		for (const item of entries) {
			if (Math.abs(item.alpha - alpha) > 0.08) continue;
			const dist =
				Math.abs(item.rgb[0] - tr) +
				Math.abs(item.rgb[1] - tg) +
				Math.abs(item.rgb[2] - tb);
			if (dist <= 6) {
				const score = dist * 1000 + rank(item.key);
				if (score < bestScore) {
					bestScore = score;
					bestKey = item.key;
				}
			}
		}
		return bestKey;
	} catch {
		return null;
	}
}

type CachedVarRule = {
	selector: string;
	declarations: Partial<Record<ColorChannel, string>>;
};

let cachedRulesSheetCount = -1;
let cachedVarRules: CachedVarRule[] = [];

function collectVarRulesFromList(
	rules: CSSRuleList,
	out: CachedVarRule[],
	parentSelector = "",
) {
	for (const rule of Array.from(rules)) {
		if (rule instanceof CSSStyleRule) {
			const rawSelector = rule.selectorText?.trim();
			if (!rawSelector || rawSelector.includes("::")) continue;
			// 跳过全局通配重置规则（如 * { border-color: var(--border); outline-color: ... }），避免误报到无边框/无轮廓元素
			const isUniversalReset = rawSelector
				.split(",")
				.every((part) => /^\*(?::(?:before|after))?$/.test(part.trim()));
			if (isUniversalReset) continue;
			if (
				/:(?:hover|active|focus|focus-visible|focus-within)\b/.test(rawSelector)
			) {
				continue;
			}
			const selector = parentSelector
				? rawSelector.includes("&")
					? rawSelector.replaceAll("&", parentSelector)
					: `${parentSelector} ${rawSelector}`
				: rawSelector;
			const bg =
				rule.style.getPropertyValue("background-color").trim() ||
				rule.style.getPropertyValue("background").trim();
			const color = rule.style.getPropertyValue("color").trim();
			const border =
				rule.style.getPropertyValue("border-color").trim() ||
				rule.style.getPropertyValue("border-top-color").trim() ||
				rule.style.getPropertyValue("border-bottom-color").trim() ||
				rule.style.getPropertyValue("border").trim();
			const outline = rule.style.getPropertyValue("outline-color").trim();

			const declarations: Partial<Record<ColorChannel, string>> = {};
			if (bg.includes("var(--")) declarations.background = bg;
			if (color.includes("var(--")) declarations.color = color;
			if (border.includes("var(--")) declarations.border = border;
			if (outline.includes("var(--")) declarations.outline = outline;

			if (Object.keys(declarations).length > 0) {
				out.push({ selector, declarations });
			}
			if (rule.cssRules?.length) {
				collectVarRulesFromList(rule.cssRules, out, selector);
			}
		} else if (
			"cssRules" in rule &&
			(rule as CSSGroupingRule).cssRules?.length
		) {
			if (
				rule instanceof CSSMediaRule &&
				!window.matchMedia(rule.conditionText).matches
			) {
				continue;
			}
			collectVarRulesFromList(
				(rule as CSSGroupingRule).cssRules,
				out,
				parentSelector,
			);
		}
	}
}

function getVarStylesheetRules(): CachedVarRule[] {
	const sheetCount = document.styleSheets.length;
	if (cachedRulesSheetCount === sheetCount && cachedVarRules.length > 0) {
		return cachedVarRules;
	}
	const out: CachedVarRule[] = [];
	for (const sheet of Array.from(document.styleSheets)) {
		try {
			if (sheet.cssRules) collectVarRulesFromList(sheet.cssRules, out);
		} catch {
			// 跨域样式表安全跳过
		}
	}
	cachedRulesSheetCount = sheetCount;
	cachedVarRules = out;
	return out;
}

export function findStylesheetVarMatches(
	element: HTMLElement,
): Partial<Record<ColorChannel, string>> {
	const matched: Partial<Record<ColorChannel, string>> = {};
	const rules = getVarStylesheetRules();
	for (const rule of rules) {
		try {
			if (element.matches(rule.selector)) {
				if (rule.declarations.background) {
					matched.background = rule.declarations.background;
				}
				if (rule.declarations.color) matched.color = rule.declarations.color;
				if (rule.declarations.border) matched.border = rule.declarations.border;
				if (rule.declarations.outline) {
					matched.outline = rule.declarations.outline;
				}
			}
		} catch {
			// 忽略非标选择器
		}
	}
	return matched;
}

/** 沿祖先链叠加半透明背景，求得元素真实可见的不透明背景色，用于准确计算 WCAG 对比度。 */
export function resolveEffectiveOpaqueBackground(element: HTMLElement): string {
	const layers: { color: chroma.Color; alpha: number }[] = [];
	let current: HTMLElement | null = element;
	while (current) {
		const bg = getComputedStyle(current).backgroundColor;
		try {
			const parsed = chroma(bg);
			const alpha = parsed.alpha();
			if (alpha > 0) {
				layers.push({ color: parsed.alpha(1), alpha });
				if (alpha >= 0.995) break;
			}
		} catch {
			// 跳过异常颜色
		}
		current = current.parentElement;
	}
	const rootBg = getComputedStyle(document.documentElement)
		.getPropertyValue("--background")
		.trim();
	let base: chroma.Color;
	try {
		base = chroma(rootBg || "#ffffff").alpha(1);
	} catch {
		base = chroma("#ffffff");
	}
	for (let i = layers.length - 1; i >= 0; i--) {
		const layer = layers[i];
		if (!layer) continue;
		base = chroma.mix(base, layer.color, layer.alpha, "rgb");
	}
	return base.hex();
}

function isTransparentColorValue(cssColor: string): boolean {
	if (!cssColor || cssColor === "transparent") return true;
	try {
		return chroma(cssColor).alpha() === 0;
	} catch {
		return false;
	}
}

export function readBorderMetrics(styles: CSSStyleDeclaration): {
	widthPx: number;
	style: string;
	color: string;
	isTransparentColor: boolean;
	hasVisibleBorder: boolean;
} {
	const sides = [
		{
			w: Number.parseFloat(styles.borderTopWidth) || 0,
			s: styles.borderTopStyle,
			c: styles.borderTopColor,
		},
		{
			w: Number.parseFloat(styles.borderBottomWidth) || 0,
			s: styles.borderBottomStyle,
			c: styles.borderBottomColor,
		},
		{
			w: Number.parseFloat(styles.borderLeftWidth) || 0,
			s: styles.borderLeftStyle,
			c: styles.borderLeftColor,
		},
		{
			w: Number.parseFloat(styles.borderRightWidth) || 0,
			s: styles.borderRightStyle,
			c: styles.borderRightColor,
		},
	];
	// 优先选择真正可见（线宽 > 0 且非透明）的边框边；若全是 transparent 则标记为占位透明边框
	const visible = sides.find(
		(side) =>
			side.w > 0 && side.s !== "none" && !isTransparentColorValue(side.c),
	);
	if (visible) {
		return {
			widthPx: visible.w,
			style: visible.s,
			color: visible.c,
			isTransparentColor: false,
			hasVisibleBorder: true,
		};
	}
	const placeholder = sides.find((side) => side.w > 0 && side.s !== "none");
	if (placeholder) {
		return {
			widthPx: placeholder.w,
			style: placeholder.s,
			color: placeholder.c,
			isTransparentColor: true,
			hasVisibleBorder: false,
		};
	}
	return {
		widthPx: 0,
		style: "none",
		color: "transparent",
		isTransparentColor: true,
		hasVisibleBorder: false,
	};
}

function findInheritedTextSemantic(
	element: HTMLElement,
	isDark: boolean,
	resolveLabel: (el: HTMLElement) => string,
): { tokenKey: string; fromLabel: string; opacityPercent: number } | null {
	let ancestor = element.parentElement;
	let hops = 0;
	while (ancestor && hops < 12) {
		const cls = Array.from(ancestor.classList);
		const parsed = parseTailwindColorClasses(cls, isDark);
		if (parsed.base.color && parsed.base.color.tokenKey !== "transparent") {
			return {
				tokenKey: parsed.base.color.tokenKey,
				fromLabel: resolveLabel(ancestor),
				opacityPercent: parsed.base.color.opacityPercent,
			};
		}
		const rules = findStylesheetVarMatches(ancestor);
		if (rules.color) {
			const extracted = extractCssVarToken(rules.color);
			if (extracted) {
				return {
					tokenKey: extracted.tokenKey,
					fromLabel: resolveLabel(ancestor),
					opacityPercent: extracted.opacityPercent,
				};
			}
		}
		ancestor = ancestor.parentElement;
		hops++;
	}
	return null;
}

export function buildColorSlot(params: {
	channel: ColorChannel;
	channelLabel: string;
	cssProperty: string;
	computedColor: string;
	element: HTMLElement;
	classMatch:
		| { tokenKey: string; opacityPercent: number; rawClass: string }
		| undefined;
	ruleDecl: string | undefined;
	overrideItem: ElementOverrideItem | undefined;
	isDark: boolean;
	resolveLabel: (el: HTMLElement) => string;
	hasVisibleBorder?: boolean;
	hasPlaceholderBorder?: boolean;
	globalLineColorActive?: boolean;
	effectiveBgForContrast?: string;
}): InspectedColorSlot {
	const details = formatColorDetails(params.computedColor);
	const contrast =
		params.channel === "color" && params.effectiveBgForContrast
			? computeContrastInfo(params.computedColor, params.effectiveBgForContrast)
			: null;

	if (params.overrideItem) {
		const extracted = extractCssVarToken(params.overrideItem.appliedValue);
		const meta = extracted
			? (SEMANTIC_COLOR_MAP.get(extracted.tokenKey) ?? null)
			: null;
		return {
			channel: params.channel,
			channelLabel: params.channelLabel,
			cssProperty: params.cssProperty,
			semanticMeta: meta,
			semanticLabel: meta ? meta.label : params.overrideItem.afterSemantic,
			tokenName: meta ? meta.varName : null,
			opacityPercent: extracted
				? extracted.opacityPercent
				: details.alphaPercent,
			source: "override",
			sourceNote: "本次分析已覆写",
			viaGlobalLineColor: false,
			rawComputed: params.computedColor,
			...details,
			contrast,
		};
	}

	const transparentDetails = {
		hex: "#00000000",
		oklch: "transparent",
		rgb: "rgba(0, 0, 0, 0)",
		alphaPercent: 0,
		transparent: true,
	};

	if (
		params.channel === "background" &&
		(details.transparent || params.classMatch?.tokenKey === "transparent")
	) {
		return {
			channel: params.channel,
			channelLabel: params.channelLabel,
			cssProperty: params.cssProperty,
			semanticMeta: null,
			semanticLabel: "透明背景（透出下层表面）",
			tokenName: null,
			opacityPercent: 0,
			source: "transparent",
			sourceNote: params.classMatch?.rawClass
				? `类名 ${params.classMatch.rawClass}`
				: "transparent",
			viaGlobalLineColor: false,
			rawComputed: params.computedColor,
			...transparentDetails,
			contrast: null,
		};
	}

	if (
		params.channel === "border" &&
		(!params.hasVisibleBorder ||
			details.transparent ||
			params.classMatch?.tokenKey === "transparent")
	) {
		const isPlaceholder = Boolean(params.hasPlaceholderBorder);
		return {
			channel: params.channel,
			channelLabel: params.channelLabel,
			cssProperty: params.cssProperty,
			semanticMeta: null,
			semanticLabel: isPlaceholder ? "透明边框（占位无边线）" : "无边框 (0px)",
			tokenName: null,
			opacityPercent: 0,
			source: "transparent",
			sourceNote: isPlaceholder
				? params.classMatch?.rawClass
					? `类名 ${params.classMatch.rawClass} · 占位防抖动`
					: "border-color: transparent"
				: "未启用边框（border-width: 0px）",
			viaGlobalLineColor: false,
			rawComputed: params.computedColor,
			...transparentDetails,
			contrast: null,
		};
	}

	if (
		params.channel === "outline" &&
		(details.transparent || params.classMatch?.tokenKey === "transparent")
	) {
		return {
			channel: params.channel,
			channelLabel: params.channelLabel,
			cssProperty: params.cssProperty,
			semanticMeta: null,
			semanticLabel: "无常驻轮廓",
			tokenName: null,
			opacityPercent: 0,
			source: "transparent",
			sourceNote: "常态无轮廓（聚焦光环见上方交互态）",
			viaGlobalLineColor: false,
			rawComputed: params.computedColor,
			...transparentDetails,
			contrast: null,
		};
	}

	if (
		params.channel === "color" &&
		(details.transparent || params.classMatch?.tokenKey === "transparent")
	) {
		return {
			channel: params.channel,
			channelLabel: params.channelLabel,
			cssProperty: params.cssProperty,
			semanticMeta: null,
			semanticLabel: "透明文字",
			tokenName: null,
			opacityPercent: 0,
			source: "transparent",
			sourceNote: params.classMatch?.rawClass
				? `类名 ${params.classMatch.rawClass}`
				: "transparent",
			viaGlobalLineColor: false,
			rawComputed: params.computedColor,
			...transparentDetails,
			contrast: null,
		};
	}

	const globalLineApplies =
		params.channel === "border" &&
		Boolean(params.globalLineColorActive) &&
		Boolean(params.hasVisibleBorder);

	if (params.classMatch && params.classMatch.tokenKey !== "transparent") {
		const meta = SEMANTIC_COLOR_MAP.get(params.classMatch.tokenKey) ?? null;
		const opacitySuffix =
			params.classMatch.opacityPercent < 100
				? ` / ${params.classMatch.opacityPercent}%`
				: "";
		const noteParts = [`类名 ${params.classMatch.rawClass}`];
		if (params.channel === "border" && !params.hasVisibleBorder) {
			noteParts.push("当前 0px 未显示");
		}
		if (
			globalLineApplies &&
			(params.classMatch.tokenKey === "border" ||
				params.classMatch.tokenKey === "input" ||
				params.classMatch.tokenKey === "sidebar-border")
		) {
			noteParts.push("受全局线条色覆盖");
		}
		return {
			channel: params.channel,
			channelLabel: params.channelLabel,
			cssProperty: params.cssProperty,
			semanticMeta: meta,
			semanticLabel: meta
				? `${meta.label}${opacitySuffix}`
				: params.classMatch.tokenKey,
			tokenName: meta ? meta.varName : null,
			opacityPercent: params.classMatch.opacityPercent,
			source: "class",
			sourceNote: noteParts.join(" · "),
			viaGlobalLineColor: globalLineApplies,
			rawComputed: params.computedColor,
			...details,
			contrast,
		};
	}

	if (params.ruleDecl) {
		const extracted = extractCssVarToken(params.ruleDecl);
		if (extracted) {
			const meta = SEMANTIC_COLOR_MAP.get(extracted.tokenKey) ?? null;
			const opacitySuffix =
				extracted.opacityPercent < 100 ? ` / ${extracted.opacityPercent}%` : "";
			return {
				channel: params.channel,
				channelLabel: params.channelLabel,
				cssProperty: params.cssProperty,
				semanticMeta: meta,
				semanticLabel: meta
					? `${meta.label}${opacitySuffix}`
					: extracted.tokenKey,
				tokenName: meta ? meta.varName : null,
				opacityPercent: extracted.opacityPercent,
				source: "stylesheet",
				sourceNote:
					extracted.viaGlobalLineColor && globalLineApplies
						? "共享样式规则 · 全局线条色生效"
						: "共享样式规则",
				viaGlobalLineColor: extracted.viaGlobalLineColor && globalLineApplies,
				rawComputed: params.computedColor,
				...details,
				contrast,
			};
		}
	}

	if (params.channel === "color") {
		const inherited = findInheritedTextSemantic(
			params.element,
			params.isDark,
			params.resolveLabel,
		);
		if (inherited) {
			const meta = SEMANTIC_COLOR_MAP.get(inherited.tokenKey) ?? null;
			if (meta) {
				return {
					channel: params.channel,
					channelLabel: params.channelLabel,
					cssProperty: params.cssProperty,
					semanticMeta: meta,
					semanticLabel: meta.label,
					tokenName: meta.varName,
					opacityPercent: inherited.opacityPercent,
					source: "inherited",
					sourceNote: `继承自 ${inherited.fromLabel}`,
					viaGlobalLineColor: false,
					rawComputed: params.computedColor,
					...details,
					contrast,
				};
			}
		}
	}

	const matchedKey = matchColorInPalette(params.computedColor, params.channel);
	if (matchedKey) {
		const meta = SEMANTIC_COLOR_MAP.get(matchedKey) ?? null;
		if (meta) {
			return {
				channel: params.channel,
				channelLabel: params.channelLabel,
				cssProperty: params.cssProperty,
				semanticMeta: meta,
				semanticLabel: meta.label,
				tokenName: meta.varName,
				opacityPercent: details.alphaPercent,
				source: "palette-match",
				sourceNote:
					params.channel === "border" && !params.hasVisibleBorder
						? "色板语义匹配（当前无可见边框）"
						: "与当前主题色板匹配",
				viaGlobalLineColor: globalLineApplies,
				rawComputed: params.computedColor,
				...details,
				contrast,
			};
		}
	}

	return {
		channel: params.channel,
		channelLabel: params.channelLabel,
		cssProperty: params.cssProperty,
		semanticMeta: null,
		semanticLabel:
			params.channel === "border" && !params.hasVisibleBorder
				? "无可见边框"
				: params.channel === "outline" && details.transparent
					? "无常驻轮廓"
					: "自定义色值（未绑定语义令牌）",
		tokenName: null,
		opacityPercent: details.alphaPercent,
		source: details.transparent ? "transparent" : "custom",
		sourceNote: details.transparent ? "未激活" : "建议切换为语义色令牌",
		viaGlobalLineColor: false,
		rawComputed: params.computedColor,
		...details,
		contrast,
	};
}
