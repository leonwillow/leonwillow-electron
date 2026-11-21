/**
 * @file 主题分析工具的语义解析、令牌匹配、对比度核算与提示词导出算法。
 * 创建时间：2026-11-21
 * 修改时间：2026-11-21
 * 版本作用：纯算法聚合入口（禁止访问浏览器全局对象），汇总语义目录并提供类名/变量/计算值匹配与格式化。
 * 被调用：components/theme-inspector/*、apps/web/test/theme-inspector.test.ts。
 * 调用：chroma-js、./color-converter、./semantic-color-catalog、./semantic-ui-catalog。
 * 功能：解析 Tailwind 语义色与交互态、提取 CSS var/color-mix、匹配排版/尺寸/间距/圆角/阴影语义、计算 WCAG 对比度与导出 AI 提示词。
 * 预期结果：所有函数均为确定性纯函数，无非空断言且单文件体积可控。
 */
import chroma from "chroma-js";
import { colorFormatter } from "@/utils/theme/color-converter";
import { SEMANTIC_COLOR_MAP } from "./semantic-color-catalog";
import {
	DEFAULT_WEIGHT_TOKEN,
	SEMANTIC_CONTROL_SIZE_TOKENS,
	SEMANTIC_RADIUS_TOKENS,
	SEMANTIC_SHADOW_TOKENS,
	SEMANTIC_SPACING_TOKENS,
	SEMANTIC_TYPOGRAPHY_TOKENS,
	SEMANTIC_WEIGHT_TOKENS,
	type SemanticControlSizeToken,
	type SemanticRadiusToken,
	type SemanticShadowToken,
	type SemanticSpacingToken,
	type SemanticTypographyToken,
	type SemanticWeightToken,
	SHADOW_NONE_TOKEN,
} from "./semantic-ui-catalog";

export * from "./semantic-color-catalog";
export * from "./semantic-ui-catalog";

export type ColorChannel = "background" | "color" | "border" | "outline";

export type ColorVisualPart = "bg" | "text" | "border" | "ring" | "outline";

export type InteractionStateKind =
	| "hover"
	| "focus"
	| "selected"
	| "expanded"
	| "active"
	| "invalid"
	| "disabled";

export type ActiveDomStateFlags = {
	expanded?: boolean;
	selected?: boolean;
	active?: boolean;
	invalid?: boolean;
	disabled?: boolean;
	placeholder?: boolean;
};

export type ParsedClassColorMatch = {
	channel: ColorChannel;
	part: ColorVisualPart;
	tokenKey: string;
	opacityPercent: number;
	rawClass: string;
};

export type ParsedStateColorMatch = {
	state: InteractionStateKind;
	stateLabel: string;
	channel: ColorChannel;
	part: ColorVisualPart;
	partLabel: string;
	tokenKey: string;
	opacityPercent: number;
	rawClass: string;
};

const STATE_LABEL_MAP: Record<InteractionStateKind, string> = {
	hover: "悬停",
	focus: "聚焦",
	selected: "选中",
	expanded: "展开",
	active: "按下",
	invalid: "校验异常",
	disabled: "禁用",
};

const PART_LABEL_MAP: Record<ColorVisualPart, string> = {
	bg: "背景",
	text: "文字",
	border: "边框",
	ring: "光环",
	outline: "轮廓",
};

const CHANNEL_PREFIXES: readonly {
	prefix: string;
	channel: ColorChannel;
	part: ColorVisualPart;
}[] = [
	{ prefix: "bg-", channel: "background", part: "bg" },
	{ prefix: "text-", channel: "color", part: "text" },
	{ prefix: "border-", channel: "border", part: "border" },
	{ prefix: "ring-", channel: "outline", part: "ring" },
	{ prefix: "outline-", channel: "outline", part: "outline" },
];

const BORDER_SIDE_PREFIXES = new Set([
	"border-t",
	"border-r",
	"border-b",
	"border-l",
	"border-x",
	"border-y",
]);

function splitTailwindVariants(tokenClass: string): {
	variants: string[];
	utility: string;
} {
	const parts: string[] = [];
	let depth = 0;
	let start = 0;
	for (let i = 0; i < tokenClass.length; i++) {
		const ch = tokenClass[i];
		if (ch === "[" || ch === "(") depth++;
		else if (ch === "]" || ch === ")") depth = Math.max(0, depth - 1);
		else if (ch === ":" && depth === 0) {
			parts.push(tokenClass.slice(start, i));
			start = i + 1;
		}
	}
	return { variants: parts, utility: tokenClass.slice(start) };
}

function classifyVariantState(
	variants: string[],
	isDark: boolean,
	activeFlags?: ActiveDomStateFlags,
): {
	appliesToMode: boolean;
	isDarkSpecific: boolean;
	state: InteractionStateKind | null;
	promotedToBase: boolean;
	compoundActiveBoost: boolean;
} {
	let interactionState: "hover" | "focus" | "active" | null = null;
	let domState: "expanded" | "selected" | "invalid" | "disabled" | null = null;
	let requiresPlaceholder = false;
	let isDarkSpecific = false;

	for (const v of variants) {
		if (v === "dark") {
			if (!isDark) {
				return {
					appliesToMode: false,
					isDarkSpecific: true,
					state: null,
					promotedToBase: false,
					compoundActiveBoost: false,
				};
			}
			isDarkSpecific = true;
			continue;
		}
		if (v === "light") {
			if (isDark) {
				return {
					appliesToMode: false,
					isDarkSpecific: false,
					state: null,
					promotedToBase: false,
					compoundActiveBoost: false,
				};
			}
			continue;
		}
		if (
			v.startsWith("sm") ||
			v.startsWith("md") ||
			v.startsWith("lg") ||
			v.startsWith("xl") ||
			v.startsWith("2xl") ||
			v.startsWith("@")
		) {
			continue;
		}
		// 否定守卫（如 not-disabled、not-aria-disabled、not-aria-[haspopup]）仅作前置条件，不改变主状态归属
		if (v.startsWith("not-")) {
			continue;
		}
		if (v === "data-placeholder" || v === "data-[placeholder]") {
			requiresPlaceholder = true;
		} else if (v.includes("hover")) {
			interactionState = "hover";
		} else if (v.includes("focus")) {
			interactionState = "focus";
		} else if (v.includes("invalid")) {
			domState = "invalid";
		} else if (
			v.includes("expanded") ||
			v === "data-open" ||
			v === "data-[open]" ||
			v === "data-[state=open]"
		) {
			domState = "expanded";
		} else if (
			v.includes("selected") ||
			v.includes("checked") ||
			v.includes("current") ||
			v === "data-active" ||
			v === "data-[active]" ||
			v === "data-[active=true]"
		) {
			domState = "selected";
		} else if (v === "active") {
			interactionState = "active";
		} else if (v.includes("disabled")) {
			domState = "disabled";
		} else {
			// 子代选择器（如 [&_svg]:...、**:...、has-...、placeholder:...、group-data-...）不归入当前元素自身颜色
			return {
				appliesToMode: false,
				isDarkSpecific,
				state: null,
				promotedToBase: false,
				compoundActiveBoost: false,
			};
		}
	}

	if (requiresPlaceholder) {
		if (!activeFlags?.placeholder) {
			return {
				appliesToMode: false,
				isDarkSpecific,
				state: null,
				promotedToBase: false,
				compoundActiveBoost: false,
			};
		}
		return {
			appliesToMode: true,
			isDarkSpecific,
			state: interactionState,
			promotedToBase: interactionState === null,
			compoundActiveBoost: interactionState !== null,
		};
	}

	const isDomStateActive = Boolean(
		(domState === "expanded" && activeFlags?.expanded) ||
			(domState === "selected" && activeFlags?.selected) ||
			(domState === "invalid" && activeFlags?.invalid) ||
			(domState === "disabled" && activeFlags?.disabled),
	);

	// 复合条件（例如 data-[selected]:focus:bg-accent）：仅当前 DOM 确实处于该条件态时生效，避免覆盖常态 focus/hover 语义
	if (domState && interactionState) {
		if (!isDomStateActive) {
			return {
				appliesToMode: false,
				isDarkSpecific,
				state: null,
				promotedToBase: false,
				compoundActiveBoost: false,
			};
		}
		return {
			appliesToMode: true,
			isDarkSpecific,
			state: interactionState,
			promotedToBase: false,
			compoundActiveBoost: true,
		};
	}

	if (domState) {
		return {
			appliesToMode: true,
			isDarkSpecific,
			state: isDomStateActive ? null : domState,
			promotedToBase: isDomStateActive,
			compoundActiveBoost: false,
		};
	}

	return {
		appliesToMode: true,
		isDarkSpecific,
		state: interactionState,
		promotedToBase: false,
		compoundActiveBoost: false,
	};
}

function parseColorUtility(utility: string): {
	channel: ColorChannel;
	part: ColorVisualPart;
	tokenKey: string;
	opacityPercent: number;
	isBorderShorthand?: boolean;
} | null {
	const clean = utility.replace(/^!/, "").replace(/!$/, "");
	if (clean === "border" || BORDER_SIDE_PREFIXES.has(clean)) {
		return {
			channel: "border",
			part: "border",
			tokenKey: "border",
			opacityPercent: 100,
			isBorderShorthand: true,
		};
	}
	for (const { prefix, channel, part } of CHANNEL_PREFIXES) {
		if (!clean.startsWith(prefix)) continue;
		const rest = clean.slice(prefix.length);
		// 显式 transparent（如 bg-transparent / border-transparent）必须覆盖前面的默认色
		if (rest === "transparent") {
			return { channel, part, tokenKey: "transparent", opacityPercent: 0 };
		}
		// 支持 Tailwind 任意表达式中引用语义变量（如 bg-[color-mix(...,var(--secondary),...)]）
		if (rest.startsWith("[") && rest.includes("var(--")) {
			const extracted = extractCssVarToken(rest);
			if (extracted) {
				return {
					channel,
					part,
					tokenKey: extracted.tokenKey,
					opacityPercent: extracted.opacityPercent,
				};
			}
			continue;
		}
		const slashIdx = rest.indexOf("/");
		const candidate = slashIdx >= 0 ? rest.slice(0, slashIdx) : rest;
		if (!SEMANTIC_COLOR_MAP.has(candidate)) continue;
		let opacityPercent = 100;
		if (slashIdx >= 0) {
			const rawAlpha = rest.slice(slashIdx + 1);
			const numeric = Number.parseFloat(rawAlpha.replace(/[[\]%]/g, ""));
			if (Number.isFinite(numeric)) {
				opacityPercent =
					numeric <= 1 && rawAlpha.includes(".")
						? Math.round(numeric * 100)
						: Math.max(0, Math.min(100, Math.round(numeric)));
			}
		}
		return { channel, part, tokenKey: candidate, opacityPercent };
	}
	return null;
}

/**
 * 解析元素的 Tailwind 语义色类，准确区分常态颜色与交互态（悬停/聚焦/选中/展开/校验异常/禁用）。
 * 深色专属类优先于常规类，同状态同部位按级联去重，transparent 显式清空前序默认色。
 */
export function parseTailwindColorClasses(
	classNames: readonly string[],
	isDark: boolean,
	activeFlags?: ActiveDomStateFlags,
): {
	base: Partial<Record<ColorChannel, ParsedClassColorMatch>>;
	states: ParsedStateColorMatch[];
} {
	const baseMap = new Map<
		ColorChannel,
		{ match: ParsedClassColorMatch; priority: number }
	>();
	const stateMap = new Map<
		string,
		{ match: ParsedStateColorMatch; priority: number }
	>();

	for (const rawClass of classNames) {
		if (!rawClass) continue;
		const { variants, utility } = splitTailwindVariants(rawClass);
		const {
			appliesToMode,
			isDarkSpecific,
			state,
			promotedToBase,
			compoundActiveBoost,
		} = classifyVariantState(variants, isDark, activeFlags);
		if (!appliesToMode) continue;
		const parsed = parseColorUtility(utility);
		if (!parsed) continue;

		// 优先级：当前激活条件态/复合激活态 > 深色专属覆盖 > 常规显式色类 > 仅表宽度的 border 简写
		const baseWeight = parsed.isBorderShorthand ? 0 : isDarkSpecific ? 2 : 1;
		const priority =
			(promotedToBase || compoundActiveBoost ? 4 : 0) + baseWeight;

		if (state === null) {
			const existing = baseMap.get(parsed.channel);
			if (!existing || priority >= existing.priority) {
				baseMap.set(parsed.channel, {
					match: {
						channel: parsed.channel,
						part: parsed.part,
						tokenKey: parsed.tokenKey,
						opacityPercent: parsed.opacityPercent,
						rawClass,
					},
					priority,
				});
			}
		} else {
			if (parsed.tokenKey === "transparent") continue;
			const key = `${state}:${parsed.part}`;
			const existing = stateMap.get(key);
			if (!existing || priority >= existing.priority) {
				stateMap.set(key, {
					match: {
						state,
						stateLabel: STATE_LABEL_MAP[state],
						partLabel: PART_LABEL_MAP[parsed.part],
						channel: parsed.channel,
						part: parsed.part,
						tokenKey: parsed.tokenKey,
						opacityPercent: parsed.opacityPercent,
						rawClass,
					},
					priority,
				});
			}
		}
	}

	const base: Partial<Record<ColorChannel, ParsedClassColorMatch>> = {};
	for (const [channel, entry] of baseMap.entries()) {
		base[channel] = entry.match;
	}

	const stateOrder: readonly InteractionStateKind[] = [
		"hover",
		"focus",
		"selected",
		"expanded",
		"active",
		"invalid",
		"disabled",
	];
	const states = Array.from(stateMap.values())
		.map((entry) => entry.match)
		.sort((a, b) => stateOrder.indexOf(a.state) - stateOrder.indexOf(b.state));

	return { base, states };
}

/** 从 CSS 声明中提取项目语义变量名及混合透明度（兼容 --ui-line-color 与 color-mix）。 */
export function extractCssVarToken(cssValue: string): {
	tokenKey: string;
	opacityPercent: number;
	viaGlobalLineColor: boolean;
} | null {
	if (!cssValue) return null;
	const viaGlobalLineColor = cssValue.includes("--ui-line-color");
	const vars = [...cssValue.matchAll(/var\(\s*--([a-z0-9-]+)/gi)].map(
		(m) => m[1] ?? "",
	);
	let matchedKey: string | null = null;
	for (const rawVar of vars) {
		const stripped = rawVar.startsWith("color-")
			? rawVar.slice("color-".length)
			: rawVar;
		if (SEMANTIC_COLOR_MAP.has(stripped)) {
			matchedKey = stripped;
			break;
		}
	}
	if (!matchedKey) return null;

	let opacityPercent = 100;
	const mixMatch = cssValue.match(
		/color-mix\([^,]+,[\s_]*var\([^)]+\)[\s_]+(\d+(?:\.\d+)?)%[\s_]*,[\s_]*transparent/i,
	);
	if (mixMatch?.[1]) {
		const pct = Number.parseFloat(mixMatch[1]);
		if (Number.isFinite(pct)) {
			opacityPercent = Math.max(0, Math.min(100, Math.round(pct)));
		}
	}

	return { tokenKey: matchedKey, opacityPercent, viaGlobalLineColor };
}

/** 匹配最贴近的排版字号语义令牌（优先类名，再按根字号换算 rem 精度匹配）。 */
export function matchTypographySemantic(
	classNames: readonly string[],
	computedPx: number,
	rootFontSizePx: number,
): {
	matched: SemanticTypographyToken | null;
	rem: number;
	source: "class" | "computed" | "custom";
} {
	const safeRoot = rootFontSizePx > 0 ? rootFontSizePx : 16;
	const rem = Number((computedPx / safeRoot).toFixed(4));

	for (const cls of classNames) {
		const { variants, utility } = splitTailwindVariants(cls);
		if (variants.length > 0) continue;
		const clean = utility.split("/")[0] ?? utility;
		const found = SEMANTIC_TYPOGRAPHY_TOKENS.find((t) => t.token === clean);
		if (found) return { matched: found, rem, source: "class" };
	}

	let best: SemanticTypographyToken | null = null;
	let bestDiff = Number.POSITIVE_INFINITY;
	for (const item of SEMANTIC_TYPOGRAPHY_TOKENS) {
		const diff = Math.abs(item.rem - rem);
		if (diff < bestDiff) {
			bestDiff = diff;
			best = item;
		}
	}
	if (best && bestDiff <= 0.035) {
		return { matched: best, rem, source: "computed" };
	}
	return { matched: null, rem, source: "custom" };
}

/** 匹配字重语义。 */
export function matchWeightSemantic(weight: number): SemanticWeightToken {
	let best = DEFAULT_WEIGHT_TOKEN;
	let diff = Number.POSITIVE_INFINITY;
	for (const item of SEMANTIC_WEIGHT_TOKENS) {
		const d = Math.abs(item.weight - weight);
		if (d < diff) {
			diff = d;
			best = item;
		}
	}
	return best;
}

/** 匹配间距（Padding / Margin / Gap）语义令牌。 */
export function matchSpacingSemantic(
	px: number,
	rootFontSizePx: number,
): {
	matched: SemanticSpacingToken | null;
	rem: number;
} {
	const safeRoot = rootFontSizePx > 0 ? rootFontSizePx : 16;
	const rem = Number((px / safeRoot).toFixed(4));
	let best: SemanticSpacingToken | null = null;
	let bestDiff = Number.POSITIVE_INFINITY;
	for (const item of SEMANTIC_SPACING_TOKENS) {
		const diff = Math.abs(item.rem - rem);
		if (diff < bestDiff) {
			bestDiff = diff;
			best = item;
		}
	}
	if (best && bestDiff <= 0.04) {
		return { matched: best, rem };
	}
	return { matched: null, rem };
}

/** 匹配控件或工作区高度尺寸语义令牌。 */
export function matchControlSizeSemantic(
	heightPx: number,
	rootFontSizePx: number,
	classNames: readonly string[] = [],
): {
	matched: SemanticControlSizeToken | null;
	rem: number;
} {
	const safeRoot = rootFontSizePx > 0 ? rootFontSizePx : 16;
	const rem = Number((heightPx / safeRoot).toFixed(4));
	for (const cls of classNames) {
		const { variants, utility } = splitTailwindVariants(cls);
		if (variants.length > 0) continue;
		for (const item of SEMANTIC_CONTROL_SIZE_TOKENS) {
			if (
				utility === `h-${item.token}` ||
				utility === `min-h-${item.token}` ||
				utility === `size-${item.token}`
			) {
				return { matched: item, rem };
			}
		}
	}
	let best: SemanticControlSizeToken | null = null;
	let bestDiff = Number.POSITIVE_INFINITY;
	for (const item of SEMANTIC_CONTROL_SIZE_TOKENS) {
		const diff = Math.abs(item.rem - rem);
		if (diff < bestDiff) {
			bestDiff = diff;
			best = item;
		}
	}
	if (best && bestDiff <= 0.05) {
		return { matched: best, rem };
	}
	return { matched: null, rem };
}

/** 匹配圆角语义令牌（依据当前主题根 --radius 基准值动态核算）。 */
export function matchRadiusSemantic(
	radiusPx: number,
	rootFontSizePx: number,
	baseRadiusRem: number,
	classNames: readonly string[] = [],
): SemanticRadiusToken | null {
	for (const cls of classNames) {
		const { variants, utility } = splitTailwindVariants(cls);
		if (variants.length > 0) continue;
		const found = SEMANTIC_RADIUS_TOKENS.find((t) => t.token === utility);
		if (found) return found;
	}
	if (radiusPx <= 0.5) return SEMANTIC_RADIUS_TOKENS[0] ?? null;
	if (radiusPx >= 500) {
		return (
			SEMANTIC_RADIUS_TOKENS.find((t) => t.token === "rounded-full") ?? null
		);
	}
	if (baseRadiusRem <= 0) return null;
	const safeRoot = rootFontSizePx > 0 ? rootFontSizePx : 16;
	const rem = radiusPx / safeRoot;
	const ratio = rem / baseRadiusRem;
	let best: SemanticRadiusToken | null = null;
	let bestDiff = Number.POSITIVE_INFINITY;
	for (const item of SEMANTIC_RADIUS_TOKENS) {
		if (
			typeof item.multiplier !== "number" ||
			item.multiplier === 0 ||
			item.multiplier >= 999
		) {
			continue;
		}
		const diff = Math.abs(item.multiplier - ratio);
		if (diff < bestDiff) {
			bestDiff = diff;
			best = item;
		}
	}
	return best && bestDiff <= 0.14 ? best : null;
}

/** 匹配阴影层级语义令牌。 */
export function matchShadowSemantic(
	boxShadow: string,
	classNames: readonly string[] = [],
): SemanticShadowToken {
	for (const cls of classNames) {
		const { variants, utility } = splitTailwindVariants(cls);
		if (variants.length > 0) continue;
		const found = SEMANTIC_SHADOW_TOKENS.find((t) => t.token === utility);
		if (found) return found;
	}
	if (!boxShadow || boxShadow === "none") {
		return SHADOW_NONE_TOKEN;
	}
	// 兼容 CSS 原始写法（0 1px 3px）与浏览器 getComputedStyle 序列化写法（rgba(...) 0px 1px 3px 0px）
	const blurMatches = [
		...boxShadow.matchAll(
			/(?:^|[\s,)])(?:-?\d+(?:\.\d+)?(?:px)?\s+){2}(\d+(?:\.\d+)?)(?:px)?(?=\s|,|$)/g,
		),
	];
	const maxBlur = blurMatches.reduce(
		(acc, m) => Math.max(acc, Number.parseFloat(m[1] ?? "0")),
		0,
	);
	const pickShadow = (index: number) =>
		SEMANTIC_SHADOW_TOKENS[index] ?? SHADOW_NONE_TOKEN;
	if (maxBlur <= 0.5) return pickShadow(1);
	if (maxBlur <= 2) return pickShadow(2);
	if (maxBlur <= 4) return pickShadow(3);
	if (maxBlur <= 8) return pickShadow(4);
	if (maxBlur <= 16) return pickShadow(5);
	if (maxBlur <= 30) return pickShadow(6);
	return pickShadow(7);
}

export type ContrastInfo = {
	ratio: number;
	label: string;
	level: "aaa" | "aa" | "aa-large" | "fail";
};

/** 计算前景色与背景色的 WCAG 对比度并分级。 */
export function computeContrastInfo(
	fgColor: string,
	bgColor: string,
): ContrastInfo | null {
	try {
		const fg = chroma(fgColor);
		const bg = chroma(bgColor);
		if (fg.alpha() === 0) return null;
		const opaqueBg = bg.alpha(1);
		const blendedFg =
			fg.alpha() < 1
				? chroma.mix(opaqueBg, fg.alpha(1), fg.alpha(), "rgb")
				: fg;
		const ratio = Number(chroma.contrast(blendedFg, opaqueBg).toFixed(2));
		if (ratio >= 7) return { ratio, label: `${ratio}:1 AAA`, level: "aaa" };
		if (ratio >= 4.5) return { ratio, label: `${ratio}:1 AA`, level: "aa" };
		if (ratio >= 3)
			return { ratio, label: `${ratio}:1 大字/图标`, level: "aa-large" };
		return { ratio, label: `${ratio}:1 偏低`, level: "fail" };
	} catch {
		return null;
	}
}

/** 格式化色值为 HEX / OKLCH / RGB 与百分比不透明度。 */
export function formatColorDetails(cssColor: string): {
	hex: string;
	oklch: string;
	rgb: string;
	alphaPercent: number;
	transparent: boolean;
} {
	try {
		const parsed = chroma(cssColor);
		const alpha = parsed.alpha();
		return {
			hex: colorFormatter(cssColor, "hex").toUpperCase(),
			oklch: colorFormatter(cssColor, "oklch"),
			rgb: colorFormatter(cssColor, "rgb"),
			alphaPercent: Math.round(alpha * 100),
			transparent: alpha === 0,
		};
	} catch {
		return {
			hex: cssColor,
			oklch: cssColor,
			rgb: cssColor,
			alphaPercent: 100,
			transparent: cssColor === "transparent",
		};
	}
}

export type PromptTokenChange = {
	tokenKey: string;
	semanticLabel: string;
	mode: "light" | "dark";
	before: string;
	after: string;
};

export type PromptElementChange = {
	elementLabel: string;
	selector: string;
	propertyLabel: string;
	cssProperty: string;
	beforeSemantic: string;
	afterSemantic: string;
	afterValue: string;
};

/** 生成结构化的中文主题修改提示词，方便管理员直接复制给 AI 落盘源码。 */
export function formatInspectorPrompt(params: {
	presetLabel: string;
	mode: "light" | "dark";
	pathname: string;
	tokenChanges: readonly PromptTokenChange[];
	elementChanges: readonly PromptElementChange[];
}): string {
	const lines: string[] = [
		"# 主题与界面语义修改清单",
		`- 当前页面：\`${params.pathname}\``,
		`- 当前主题：${params.presetLabel}（${params.mode === "dark" ? "深色模式" : "浅色模式"}）`,
	];

	if (params.tokenChanges.length > 0) {
		lines.push("", "## 一、全局主题语义令牌修改");
		for (const item of params.tokenChanges) {
			lines.push(
				`- **${item.semanticLabel}** (\`--${item.tokenKey}\`, ${item.mode === "dark" ? "深色" : "浅色"}): \`${item.before}\` -> \`${item.after}\``,
			);
		}
	}

	if (params.elementChanges.length > 0) {
		lines.push("", "## 二、组件元素语义与参数修改");
		for (const item of params.elementChanges) {
			lines.push(
				`- **${item.elementLabel}** (\`${item.selector}\`) · ${item.propertyLabel} (\`${item.cssProperty}\`): ${item.beforeSemantic} -> **${item.afterSemantic}** (\`${item.afterValue}\`)`,
			);
		}
	}

	if (params.tokenChanges.length === 0 && params.elementChanges.length === 0) {
		lines.push("", "（暂无修改记录）");
	}

	return lines.join("\n");
}
