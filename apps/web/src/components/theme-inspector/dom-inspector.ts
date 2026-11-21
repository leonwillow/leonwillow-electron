/**
 * @file 主题分析工具的 DOM 语义探测、盒模型测距、层级树构建与元素覆写还原入口。
 * 创建时间：2026-11-21
 * 修改时间：2026-11-21
 * 版本作用：浏览器端元素快照生成器，整合身份语义、颜色语义、排版/布局/外观语义与测距算法。
 * 被调用：components/theme-inspector/use-theme-inspector-session.ts、theme-inspector-overlay.tsx、inspector-color-section.tsx。
 * 调用：configs/fonts、utils/theme/semantic-catalog、./dom-color-resolver、./theme-inspector-types。
 * 功能：识别任意元素的语义角色、生成完整快照、计算两元素/父子对齐标尺、构造 oklab 混合色与还原覆写。
 * 预期结果：退场或撤销后完整还原元素原有内联样式且不残留 DOM 污染。
 */
import { FONT_CONFIG } from "@/configs/fonts";
import {
	type ActiveDomStateFlags,
	type ColorChannel,
	HTML_TAG_SEMANTICS,
	matchControlSizeSemantic,
	matchRadiusSemantic,
	matchShadowSemantic,
	matchSpacingSemantic,
	matchTypographySemantic,
	matchWeightSemantic,
	PROJECT_CLASS_LABELS,
	parseTailwindColorClasses,
	SEMANTIC_SLOT_LABELS,
} from "@/utils/theme/semantic-catalog";
import {
	buildColorSlot,
	findStylesheetVarMatches,
	readBorderMetrics,
	resolveEffectiveOpaqueBackground,
} from "./dom-color-resolver";
import type {
	BoxSpacingValues,
	DistanceGuide,
	EditableTextKind,
	ElementOverrideItem,
	ElementTextOverrideItem,
	InspectedAppearance,
	InspectedColorSlot,
	InspectedElementSnapshot,
	InspectedLayout,
	InspectedTypography,
	LayerTreeNode,
	RectSnapshot,
} from "./theme-inspector-types";

const INSPECTOR_ATTR = "data-theme-inspector";

/** 判断节点是否属于主题分析器自身或全局通知，拾取时应忽略。 */
export function isInspectorNode(node: EventTarget | null): boolean {
	if (!node || !(node instanceof Element)) return false;
	return Boolean(
		node.closest(`[${INSPECTOR_ATTR}]`) ||
			node.closest("[data-sonner-toaster]") ||
			node.closest("[data-sonner-toast]"),
	);
}

/** 判断主题分析面板是否正有展开的弹层（如调色盘或下拉菜单），展开期间暂停背景拾取。 */
export function hasOpenInspectorPopup(): boolean {
	return Boolean(
		document.querySelector(
			`[${INSPECTOR_ATTR}][data-slot="popover-content"], [${INSPECTOR_ATTR}][data-slot="select-content"], [${INSPECTOR_ATTR}][data-slot="dialog-content"]`,
		),
	);
}

const FOCUSABLE_TAGS = new Set([
	"button",
	"a",
	"input",
	"textarea",
	"select",
	"summary",
]);

const FOCUSABLE_ROLES = new Set([
	"button",
	"link",
	"tab",
	"menuitem",
	"menuitemcheckbox",
	"menuitemradio",
	"option",
	"checkbox",
	"radio",
	"switch",
	"combobox",
	"slider",
	"treeitem",
	"gridcell",
]);

function isElementFocusable(element: HTMLElement, tagLower: string): boolean {
	if (FOCUSABLE_TAGS.has(tagLower)) return true;
	const tabIndex = element.getAttribute("tabindex");
	if (tabIndex !== null && tabIndex !== "-1") return true;
	if (element.isContentEditable) return true;
	const role = element.getAttribute("role");
	return role !== null && FOCUSABLE_ROLES.has(role);
}

const FORM_CONTROL_SLOTS = new Set([
	"input",
	"textarea",
	"select-trigger",
	"checkbox",
	"radio-group-item",
	"switch",
	"input-group",
	"input-group-control",
	"combobox-trigger",
	"combobox-chips",
	"input-otp",
	"time-picker-input",
	"slider",
]);

function formatIconButtonHint(element: HTMLElement, baseLabel: string): string {
	const visibleText = (element.textContent ?? "").trim();
	if (visibleText.length > 0) return baseLabel;
	const ariaLabel = element.getAttribute("aria-label")?.trim();
	if (!ariaLabel) return baseLabel;
	const shortHint =
		ariaLabel.length > 12 ? `${ariaLabel.slice(0, 12)}…` : ariaLabel;
	return `${baseLabel} · ${shortHint}`;
}

function classifyButtonVariantLabel(
	element: HTMLElement,
	classList: readonly string[],
): string | null {
	let variantLabel: string | null = null;
	if (classList.includes("bg-primary")) {
		variantLabel = "主操作按钮";
	} else if (classList.includes("bg-destructive")) {
		variantLabel = "危险实心按钮";
	} else if (classList.includes("bg-warning")) {
		variantLabel = "警告实心按钮";
	} else if (classList.includes("bg-secondary")) {
		variantLabel = "次要操作按钮";
	} else if (
		classList.includes("border-destructive/30") ||
		(classList.includes("bg-destructive/10") &&
			classList.includes("text-destructive-foreground"))
	) {
		variantLabel = "危险浅底按钮";
	} else if (classList.includes("text-info-foreground")) {
		variantLabel = "信息幽灵按钮";
	} else if (classList.includes("text-success-foreground")) {
		variantLabel = "成功幽灵按钮";
	} else if (classList.includes("text-warning-foreground")) {
		variantLabel = "警告幽灵按钮";
	} else if (classList.includes("text-destructive-foreground")) {
		variantLabel = "危险幽灵按钮";
	} else if (classList.includes("border-border")) {
		variantLabel = "描边按钮";
	} else if (
		classList.includes("text-primary") &&
		classList.includes("underline-offset-4")
	) {
		variantLabel = "链接按钮";
	} else if (classList.includes("group/button")) {
		variantLabel = "幽灵按钮";
	}
	return variantLabel ? formatIconButtonHint(element, variantLabel) : null;
}

/** 解析单个元素的中文语义角色与分类。 */
export function resolveElementSemanticIdentity(element: HTMLElement): {
	semanticLabel: string;
	category: string;
	dataSlot: string | null;
} {
	const dataSlot = element.getAttribute("data-slot");
	const classList = Array.from(element.classList);

	for (const item of PROJECT_CLASS_LABELS) {
		if (classList.includes(item.className)) {
			return {
				semanticLabel: item.label,
				category: item.category,
				dataSlot,
			};
		}
	}

	// TooltipIconButton / PopoverTrigger 等包裹 <Button> 时会覆写 data-slot 为 *-trigger，仍按真实按钮变体识别
	if (
		element.tagName === "BUTTON" &&
		(dataSlot === "button" || classList.includes("group/button"))
	) {
		const buttonLabel = classifyButtonVariantLabel(element, classList);
		if (buttonLabel) {
			return {
				semanticLabel: buttonLabel,
				category: "基础控件",
				dataSlot,
			};
		}
	}

	if (dataSlot) {
		const slotInfo = SEMANTIC_SLOT_LABELS[dataSlot];
		if (slotInfo) {
			const label =
				element.tagName === "BUTTON"
					? formatIconButtonHint(element, slotInfo.label)
					: slotInfo.label;
			return {
				semanticLabel: label,
				category: slotInfo.category,
				dataSlot,
			};
		}
		return {
			semanticLabel: `组件槽位 · ${dataSlot}`,
			category: "语义组件",
			dataSlot,
		};
	}

	const role = element.getAttribute("role");
	if (role === "grid") {
		return { semanticLabel: "数据网格", category: "数据展示", dataSlot: null };
	}
	if (role === "columnheader") {
		return { semanticLabel: "表格列头", category: "数据展示", dataSlot: null };
	}
	if (role === "gridcell") {
		return {
			semanticLabel: "表格单元格",
			category: "数据展示",
			dataSlot: null,
		};
	}
	if (role === "dialog") {
		return { semanticLabel: "对话框", category: "弹层组件", dataSlot: null };
	}
	if (role === "tablist") {
		return {
			semanticLabel: "页签导航栏",
			category: "导航切换",
			dataSlot: null,
		};
	}
	if (role === "tab") {
		return { semanticLabel: "页签选项", category: "导航切换", dataSlot: null };
	}

	const tag = element.tagName.toLowerCase();
	const tagMeta = HTML_TAG_SEMANTICS[tag];
	if (tagMeta) {
		return {
			semanticLabel: tagMeta.label,
			category: tagMeta.category,
			dataSlot: null,
		};
	}
	return {
		semanticLabel: `元素 <${tag}>`,
		category: "页面元素",
		dataSlot: null,
	};
}

/** 生成可读的精简选择器标识。 */
export function buildCompactSelector(element: HTMLElement): string {
	const tag = element.tagName.toLowerCase();
	const dataSlot = element.getAttribute("data-slot");
	if (dataSlot) return `${tag}[data-slot="${dataSlot}"]`;
	if (element.id) return `${tag}#${element.id}`;
	const semanticClass = Array.from(element.classList).find((cls) =>
		/^(?:workspace-|lg-|funds-|inquiry-|vat-|late-fee-|menu-)/.test(cls),
	);
	if (semanticClass) return `${tag}.${semanticClass}`;
	const firstClass = Array.from(element.classList).find(
		(cls) => !cls.includes(":") && !cls.includes("[") && cls.length <= 24,
	);
	return firstClass ? `${tag}.${firstClass}` : tag;
}

function summarizeBoxSpacing(
	box: BoxSpacingValues,
	rootFontSizePx: number,
): string {
	if (box.top === 0 && box.right === 0 && box.bottom === 0 && box.left === 0) {
		return "零留白 (0)";
	}
	const uniform =
		Math.abs(box.top - box.right) < 0.5 &&
		Math.abs(box.top - box.bottom) < 0.5 &&
		Math.abs(box.top - box.left) < 0.5;
	if (uniform) {
		const m = matchSpacingSemantic(box.top, rootFontSizePx);
		return m.matched
			? `四向统一 · ${m.matched.label}`
			: `四向统一 · 自定义 (${Math.round(box.top)}px)`;
	}
	const symmetric =
		Math.abs(box.top - box.bottom) < 0.5 &&
		Math.abs(box.left - box.right) < 0.5;
	if (symmetric) {
		const my = matchSpacingSemantic(box.top, rootFontSizePx);
		const mx = matchSpacingSemantic(box.left, rootFontSizePx);
		const yText = my.matched ? my.matched.token : `${Math.round(box.top)}px`;
		const xText = mx.matched ? mx.matched.token : `${Math.round(box.left)}px`;
		return `横 ${xText} / 纵 ${yText}`;
	}
	return `${Math.round(box.top)} / ${Math.round(box.right)} / ${Math.round(box.bottom)} / ${Math.round(box.left)} px`;
}

function resolveDisplaySemantic(
	display: string,
	flexDirection: string,
): string {
	if (display === "flex" || display === "inline-flex") {
		return flexDirection.startsWith("column")
			? "纵向弹性布局 (flex-col)"
			: "横向弹性布局 (flex-row)";
	}
	if (display === "grid" || display === "inline-grid") {
		return "网格布局 (grid)";
	}
	if (display === "inline-block") return "行内块容器 (inline-block)";
	if (display === "inline") return "行内流 (inline)";
	if (display === "block") return "块级容器 (block)";
	return display;
}

function resolveFontFamilySemantic(
	fontFamilyRaw: string,
	classList: readonly string[],
	activeFontKey: string,
): { semantic: string; token: string | null } {
	if (fontFamilyRaw.includes("Inquiry FangSong")) {
		return { semantic: "公文打印仿宋字体", token: "Inquiry FangSong" };
	}
	if (
		classList.includes("font-mono") ||
		/geist mono|ui-monospace|monospace|sfmono/i.test(fontFamilyRaw)
	) {
		return { semantic: "等宽数字/代码字体", token: "--font-mono" };
	}
	const label =
		FONT_CONFIG[activeFontKey as keyof typeof FONT_CONFIG]?.label ??
		"界面无衬线字体";
	return { semantic: `全局界面字体 · ${label}`, token: "--font-sans" };
}

function buildLayerTree(element: HTMLElement): LayerTreeNode[] {
	const ancestors: HTMLElement[] = [];
	let cur = element.parentElement;
	while (cur && cur !== document.body && cur !== document.documentElement) {
		ancestors.push(cur);
		if (cur.classList.contains("workspace-shell")) break;
		cur = cur.parentElement;
	}
	ancestors.reverse();
	const trimmedAncestors = ancestors.slice(-8);

	const toNode = (
		el: HTMLElement,
		depth: number,
		relation: LayerTreeNode["relation"],
	): LayerTreeNode => {
		const id = resolveElementSemanticIdentity(el);
		const hints = Array.from(el.classList)
			.filter((c) =>
				/^(?:bg-|text-|border-|rounded-|shadow-|p-|px-|py-|gap-)/.test(c),
			)
			.slice(0, 3);
		return {
			element: el,
			semanticLabel: id.semanticLabel,
			category: id.category,
			tagLabel: buildCompactSelector(el),
			tokenHints: hints,
			depth,
			relation,
		};
	};

	const nodes: LayerTreeNode[] = trimmedAncestors.map((el, idx) =>
		toNode(el, idx, "ancestor"),
	);
	const currentDepth = nodes.length;
	nodes.push(toNode(element, currentDepth, "current"));

	const children = Array.from(element.children)
		.filter((child): child is HTMLElement => child instanceof HTMLElement)
		.filter((child) => !isInspectorNode(child))
		.slice(0, 12);
	for (const child of children) {
		nodes.push(toNode(child, currentDepth + 1, "child"));
	}
	return nodes;
}

/** 读取元素直接可编辑的文本内容（保留按钮内的 SVG 图标等子元素，不破坏结构）。 */
export function readEditableText(element: HTMLElement): {
	text: string | null;
	kind: EditableTextKind | null;
} {
	if (
		element instanceof HTMLInputElement ||
		element instanceof HTMLTextAreaElement
	) {
		if (element.value.length > 0) {
			return { text: element.value, kind: "input-value" };
		}
		if (element.placeholder.length > 0) {
			return { text: element.placeholder, kind: "input-placeholder" };
		}
		return { text: "", kind: "input-value" };
	}
	const directTextNodes = Array.from(element.childNodes).filter(
		(node): node is Text =>
			node.nodeType === Node.TEXT_NODE &&
			(node.nodeValue ?? "").trim().length > 0,
	);
	if (directTextNodes.length > 0) {
		return {
			text: directTextNodes.map((n) => n.nodeValue ?? "").join(""),
			kind: "text-node",
		};
	}
	// 无子元素且仅包含单个文本节点（或被编辑为空的纯文本节点）
	if (element.childElementCount === 0 && element.textContent !== null) {
		const trimmed = element.textContent.trim();
		if (trimmed.length > 0) {
			return { text: element.textContent, kind: "text-node" };
		}
	}
	return { text: null, kind: null };
}

/** 安全改写元素的直接文本内容，保留图标等子元素结构。 */
export function writeEditableText(
	element: HTMLElement,
	kind: EditableTextKind,
	nextText: string,
): void {
	if (
		element instanceof HTMLInputElement ||
		element instanceof HTMLTextAreaElement
	) {
		if (kind === "input-placeholder") {
			element.placeholder = nextText;
		} else {
			element.value = nextText;
		}
		return;
	}
	const textNodes = Array.from(element.childNodes).filter(
		(node): node is Text => node.nodeType === Node.TEXT_NODE,
	);
	const primary =
		textNodes.find((n) => (n.nodeValue ?? "").trim().length > 0) ??
		textNodes[0];
	if (primary) {
		primary.nodeValue = nextText;
		for (const extra of textNodes) {
			if (extra !== primary && (extra.nodeValue ?? "").trim().length > 0) {
				extra.nodeValue = "";
			}
		}
		return;
	}
	element.appendChild(document.createTextNode(nextText));
}

/** 还原元素的文本内容修改。 */
export function revertTextOverride(item: ElementTextOverrideItem): void {
	writeEditableText(item.element, item.kind, item.originalText);
}

/** 采集指定元素的完整语义快照。 */
export function inspectElement(
	element: HTMLElement,
	options: {
		mode: "light" | "dark";
		activeFontKey: string;
		overridesByKey: ReadonlyMap<string, ElementOverrideItem>;
		textOverridesByElement?: ReadonlyMap<HTMLElement, ElementTextOverrideItem>;
	},
): InspectedElementSnapshot {
	const styles = getComputedStyle(element);
	const rootStyles = getComputedStyle(document.documentElement);
	const rootFontSizePx = Number.parseFloat(rootStyles.fontSize) || 16;
	const baseRadiusRaw = rootStyles.getPropertyValue("--radius").trim();
	const baseRadiusRem = baseRadiusRaw.endsWith("rem")
		? Number.parseFloat(baseRadiusRaw) || 0.625
		: (Number.parseFloat(baseRadiusRaw) || 10) / rootFontSizePx;
	const globalBorderWidthPx =
		Number.parseFloat(rootStyles.getPropertyValue("--ui-border-width")) || 1;
	const globalLineColorActive =
		rootStyles.getPropertyValue("--ui-line-color").trim().length > 0;

	const identity = resolveElementSemanticIdentity(element);
	const classList = Array.from(element.classList);
	const isDark = options.mode === "dark";
	const activeFlags: ActiveDomStateFlags = {
		expanded:
			element.getAttribute("aria-expanded") === "true" ||
			element.hasAttribute("data-open") ||
			element.getAttribute("data-state") === "open",
		selected:
			element.getAttribute("aria-selected") === "true" ||
			element.hasAttribute("data-selected") ||
			element.hasAttribute("data-active") ||
			element.hasAttribute("data-checked") ||
			element.getAttribute("data-state") === "checked" ||
			Boolean(element.getAttribute("aria-current")),
		invalid:
			element.getAttribute("aria-invalid") === "true" ||
			element.hasAttribute("data-invalid"),
		disabled:
			element.hasAttribute("disabled") ||
			element.getAttribute("aria-disabled") === "true" ||
			element.hasAttribute("data-disabled"),
		placeholder: element.hasAttribute("data-placeholder"),
	};
	const twParsed = parseTailwindColorClasses(classList, isDark, activeFlags);
	const tagLower = element.tagName.toLowerCase();
	const isFormControl =
		tagLower === "input" ||
		tagLower === "textarea" ||
		tagLower === "select" ||
		(identity.dataSlot !== null && FORM_CONTROL_SLOTS.has(identity.dataSlot));
	const isFocusable = isElementFocusable(element, tagLower);
	// 过滤无法触发的防御类：非表单控件隐藏 aria-invalid；不可聚焦静态元素（如 <span> Badge）隐藏 focus-visible
	const filteredStateTokens = twParsed.states.filter((item) => {
		if (item.state === "invalid") {
			return Boolean(activeFlags.invalid) || isFormControl;
		}
		if (item.state === "focus") {
			return isFocusable;
		}
		return true;
	});
	const ruleMatches = findStylesheetVarMatches(element);
	const borderMetrics = readBorderMetrics(styles);
	const effectiveBg = resolveEffectiveOpaqueBackground(element);
	const resolveLabel = (el: HTMLElement) =>
		resolveElementSemanticIdentity(el).semanticLabel;

	const getOverride = (cssProperty: string) => {
		for (const item of options.overridesByKey.values()) {
			if (item.element === element && item.cssProperty === cssProperty) {
				return item;
			}
		}
		return undefined;
	};

	const colors: Record<ColorChannel, InspectedColorSlot> = {
		background: buildColorSlot({
			channel: "background",
			channelLabel: "背景表面色",
			cssProperty: "background-color",
			computedColor: styles.backgroundColor,
			element,
			classMatch: twParsed.base.background,
			ruleDecl: ruleMatches.background,
			overrideItem: getOverride("background-color"),
			isDark,
			resolveLabel,
		}),
		color: buildColorSlot({
			channel: "color",
			channelLabel: "文字 / 图标前景",
			cssProperty: "color",
			computedColor: styles.color,
			element,
			classMatch: twParsed.base.color,
			ruleDecl: ruleMatches.color,
			overrideItem: getOverride("color"),
			isDark,
			resolveLabel,
			effectiveBgForContrast: effectiveBg,
		}),
		border: buildColorSlot({
			channel: "border",
			channelLabel: "边框线条色",
			cssProperty: "border-color",
			computedColor: borderMetrics.color,
			element,
			classMatch: twParsed.base.border,
			ruleDecl: ruleMatches.border,
			overrideItem: getOverride("border-color"),
			isDark,
			resolveLabel,
			hasVisibleBorder: borderMetrics.hasVisibleBorder,
			hasPlaceholderBorder:
				borderMetrics.widthPx > 0 && borderMetrics.isTransparentColor,
			globalLineColorActive,
		}),
		outline: buildColorSlot({
			channel: "outline",
			channelLabel: "焦点轮廓 / 环",
			cssProperty: "outline-color",
			computedColor:
				styles.outlineStyle !== "none" &&
				Number.parseFloat(styles.outlineWidth) > 0
					? styles.outlineColor
					: "transparent",
			element,
			classMatch: twParsed.base.outline,
			ruleDecl: ruleMatches.outline,
			overrideItem: getOverride("outline-color"),
			isDark,
			resolveLabel,
		}),
	};

	const computedSizePx = Number.parseFloat(styles.fontSize) || rootFontSizePx;
	const typoMatch = matchTypographySemantic(
		classList,
		computedSizePx,
		rootFontSizePx,
	);
	const computedWeight = Number.parseInt(styles.fontWeight, 10) || 400;
	const weightToken = matchWeightSemantic(computedWeight);
	const rawLineHeight = styles.lineHeight;
	const computedLineHeightPx =
		rawLineHeight === "normal"
			? Number((computedSizePx * 1.45).toFixed(1))
			: Number.parseFloat(rawLineHeight) || computedSizePx * 1.45;
	const lineHeightRatio = Number(
		(computedLineHeightPx / computedSizePx).toFixed(2),
	);
	const fontFam = resolveFontFamilySemantic(
		styles.fontFamily,
		classList,
		options.activeFontKey,
	);

	const typography: InspectedTypography = {
		sizeToken: typoMatch.matched,
		sizeSemanticLabel: typoMatch.matched
			? `${typoMatch.matched.label} (${typoMatch.matched.token})`
			: "非标准自定义字号",
		sizeSource: typoMatch.source,
		computedSizePx: Number(computedSizePx.toFixed(1)),
		computedSizeRem: Number(typoMatch.rem.toFixed(3)),
		weightToken,
		computedWeight,
		computedLineHeightPx: Number(computedLineHeightPx.toFixed(1)),
		lineHeightRatio,
		letterSpacingText:
			styles.letterSpacing === "normal" ? "0em (normal)" : styles.letterSpacing,
		fontFamilySemantic: fontFam.semantic,
		fontFamilyToken: fontFam.token,
		fontFamilyRaw: styles.fontFamily,
		textAlign: styles.textAlign,
		tabularNums:
			styles.fontVariantNumeric.includes("tabular-nums") ||
			classList.includes("tabular-nums"),
	};

	const domRect = element.getBoundingClientRect();
	const rect: RectSnapshot = {
		left: domRect.left,
		top: domRect.top,
		width: domRect.width,
		height: domRect.height,
		right: domRect.right,
		bottom: domRect.bottom,
	};
	const controlMatch = matchControlSizeSemantic(
		rect.height,
		rootFontSizePx,
		classList,
	);
	const gapPx =
		Number.parseFloat(styles.gap) ||
		Number.parseFloat(styles.rowGap) ||
		Number.parseFloat(styles.columnGap) ||
		0;
	const gapMatch = matchSpacingSemantic(gapPx, rootFontSizePx);
	const padding: BoxSpacingValues = {
		top: Number((Number.parseFloat(styles.paddingTop) || 0).toFixed(1)),
		right: Number((Number.parseFloat(styles.paddingRight) || 0).toFixed(1)),
		bottom: Number((Number.parseFloat(styles.paddingBottom) || 0).toFixed(1)),
		left: Number((Number.parseFloat(styles.paddingLeft) || 0).toFixed(1)),
	};
	const margin: BoxSpacingValues = {
		top: Number((Number.parseFloat(styles.marginTop) || 0).toFixed(1)),
		right: Number((Number.parseFloat(styles.marginRight) || 0).toFixed(1)),
		bottom: Number((Number.parseFloat(styles.marginBottom) || 0).toFixed(1)),
		left: Number((Number.parseFloat(styles.marginLeft) || 0).toFixed(1)),
	};

	const layout: InspectedLayout = {
		display: styles.display,
		displaySemantic: resolveDisplaySemantic(
			styles.display,
			styles.flexDirection,
		),
		flexDirection: styles.flexDirection,
		justifyContent: styles.justifyContent,
		alignItems: styles.alignItems,
		widthPx: Number(rect.width.toFixed(1)),
		heightPx: Number(rect.height.toFixed(1)),
		controlSizeToken: controlMatch.matched,
		controlSizeLabel: controlMatch.matched
			? controlMatch.matched.label
			: "内容自适应 / 自定义高度",
		gapPx: Number(gapPx.toFixed(1)),
		gapSemantic: gapMatch.matched,
		padding,
		paddingSemanticSummary: summarizeBoxSpacing(padding, rootFontSizePx),
		margin,
		marginSemanticSummary: summarizeBoxSpacing(margin, rootFontSizePx),
	};

	const radiusPx = Number.parseFloat(styles.borderTopLeftRadius) || 0;
	const radiusToken = matchRadiusSemantic(
		radiusPx,
		rootFontSizePx,
		baseRadiusRem,
		classList,
	);
	const usesGlobalBorderWidth =
		borderMetrics.hasVisibleBorder &&
		Math.abs(borderMetrics.widthPx - globalBorderWidthPx) < 0.25;
	const borderWidthSemanticLabel =
		borderMetrics.widthPx === 0
			? "无边框 (0px)"
			: borderMetrics.isTransparentColor
				? `透明占位边框 (${borderMetrics.widthPx}px transparent)`
				: usesGlobalBorderWidth
					? `全局界面线宽 (--ui-border-width · ${globalBorderWidthPx}px)`
					: Math.abs(borderMetrics.widthPx - 2) < 0.25
						? "强调 / 选中描边 (2px)"
						: `自定义线宽 (${borderMetrics.widthPx}px)`;
	const shadowToken = matchShadowSemantic(styles.boxShadow, classList);
	const opacityPercent = Math.round(
		(Number.parseFloat(styles.opacity) || 1) * 100,
	);

	const appearance: InspectedAppearance = {
		radiusPx: Number(radiusPx.toFixed(1)),
		radiusToken,
		radiusSemanticLabel: radiusToken
			? radiusToken.label
			: `自定义圆角 (${radiusPx.toFixed(1)}px)`,
		borderWidthPx: Number(borderMetrics.widthPx.toFixed(1)),
		borderStyle: borderMetrics.style,
		borderWidthSemanticLabel,
		usesGlobalBorderWidth,
		shadowToken,
		shadowRaw: styles.boxShadow,
		opacityPercent,
	};

	const rawText = (element.textContent ?? "").replace(/\s+/g, " ").trim();
	const textPreview =
		rawText.length > 36 ? `${rawText.slice(0, 36)}…` : rawText;
	const existingTextOverride = options.textOverridesByElement?.get(element);
	const detectedText = existingTextOverride
		? {
				text: existingTextOverride.currentText,
				kind: existingTextOverride.kind,
			}
		: readEditableText(element);

	return {
		element,
		semanticLabel: identity.semanticLabel,
		category: identity.category,
		tagName: element.tagName.toLowerCase(),
		dataSlot: identity.dataSlot,
		selector: buildCompactSelector(element),
		textPreview,
		editableText: detectedText.text,
		editableTextKind: detectedText.kind,
		hasTextOverride: Boolean(existingTextOverride),
		classList,
		rect,
		colors,
		stateTokens: filteredStateTokens,
		typography,
		layout,
		appearance,
		layers: buildLayerTree(element),
	};
}

/** 计算两个矩形之间的对齐辅助线与像素间距标尺（包含父子包含关系与兄弟分离关系）。 */
export function computeDistanceGuides(
	target: RectSnapshot,
	reference: RectSnapshot,
): DistanceGuide[] {
	const guides: DistanceGuide[] = [];
	const midX = target.left + target.width / 2;
	const midY = target.top + target.height / 2;

	const isInside =
		target.left >= reference.left - 1 &&
		target.right <= reference.right + 1 &&
		target.top >= reference.top - 1 &&
		target.bottom <= reference.bottom + 1;

	if (isInside) {
		const topDist = Math.round(target.top - reference.top);
		const bottomDist = Math.round(reference.bottom - target.bottom);
		const leftDist = Math.round(target.left - reference.left);
		const rightDist = Math.round(reference.right - target.right);

		if (topDist > 1) {
			guides.push({
				axis: "vertical",
				x1: midX,
				y1: reference.top,
				x2: midX,
				y2: target.top,
				distancePx: topDist,
				labelX: midX,
				labelY: reference.top + topDist / 2,
			});
		}
		if (bottomDist > 1) {
			guides.push({
				axis: "vertical",
				x1: midX,
				y1: target.bottom,
				x2: midX,
				y2: reference.bottom,
				distancePx: bottomDist,
				labelX: midX,
				labelY: target.bottom + bottomDist / 2,
			});
		}
		if (leftDist > 1) {
			guides.push({
				axis: "horizontal",
				x1: reference.left,
				y1: midY,
				x2: target.left,
				y2: midY,
				distancePx: leftDist,
				labelX: reference.left + leftDist / 2,
				labelY: midY,
			});
		}
		if (rightDist > 1) {
			guides.push({
				axis: "horizontal",
				x1: target.right,
				y1: midY,
				x2: reference.right,
				y2: midY,
				distancePx: rightDist,
				labelX: target.right + rightDist / 2,
				labelY: midY,
			});
		}
		return guides;
	}

	if (target.right < reference.left) {
		const dist = Math.round(reference.left - target.right);
		if (dist > 0) {
			guides.push({
				axis: "horizontal",
				x1: target.right,
				y1: midY,
				x2: reference.left,
				y2: midY,
				distancePx: dist,
				labelX: target.right + dist / 2,
				labelY: midY,
			});
		}
	} else if (reference.right < target.left) {
		const dist = Math.round(target.left - reference.right);
		if (dist > 0) {
			guides.push({
				axis: "horizontal",
				x1: reference.right,
				y1: midY,
				x2: target.left,
				y2: midY,
				distancePx: dist,
				labelX: reference.right + dist / 2,
				labelY: midY,
			});
		}
	}

	if (target.bottom < reference.top) {
		const dist = Math.round(reference.top - target.bottom);
		if (dist > 0) {
			guides.push({
				axis: "vertical",
				x1: midX,
				y1: target.bottom,
				x2: midX,
				y2: reference.top,
				distancePx: dist,
				labelX: midX,
				labelY: target.bottom + dist / 2,
			});
		}
	} else if (reference.bottom < target.top) {
		const dist = Math.round(target.top - reference.bottom);
		if (dist > 0) {
			guides.push({
				axis: "vertical",
				x1: midX,
				y1: reference.bottom,
				x2: midX,
				y2: target.top,
				distancePx: dist,
				labelX: midX,
				labelY: reference.bottom + dist / 2,
			});
		}
	}

	return guides;
}

/** 构造语义色 + 混合不透明度的标准 CSS 值（统一使用 oklab 避免低彩度色相偏移）。 */
export function buildSemanticColorCssValue(
	tokenKey: string,
	opacityPercent = 100,
): string {
	if (tokenKey === "transparent") return "transparent";
	if (opacityPercent >= 100) return `var(--${tokenKey})`;
	return `color-mix(in oklab, var(--${tokenKey}) ${opacityPercent}%, transparent)`;
}

/** 还原单条元素内联覆写。 */
export function revertElementOverride(item: ElementOverrideItem): void {
	if (item.originalInlineValue) {
		item.element.style.setProperty(
			item.cssProperty,
			item.originalInlineValue,
			item.originalInlinePriority,
		);
	} else {
		item.element.style.removeProperty(item.cssProperty);
	}
}
