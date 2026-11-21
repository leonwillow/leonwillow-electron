/**
 * @file 主题分析工具的变更导出与 DOM 节点导航纯辅助函数。
 * 创建时间：2026-11-21
 * 修改时间：2026-11-21
 * 版本作用：将 AI 提示词组装、CSS 代码组装与父子兄弟元素导航从主会话 Hook 中拆出，保持模块体积精简。
 * 被调用：components/theme-inspector/use-theme-inspector-session.ts。
 * 调用：configs/fonts、configs/theme-settings、utils/theme/semantic-catalog、utils/theme/theme-style-generator、./dom-inspector。
 * 功能：生成包含全局令牌、元素样式与文案改动的 AI 提示词与 CSS 导出文本，并提供安全的相邻 DOM 节点定位。
 * 预期结果：导出文本语义清晰可直接粘贴使用，DOM 导航自动跳过分析器自身节点。
 */
import { FONT_CONFIG } from "@/configs/fonts";
import { RADIUS_VALUES } from "@/configs/theme-settings";
import type { ThemeDraft, ThemeStyleProps } from "@/types/theme";
import {
	formatInspectorPrompt,
	SEMANTIC_COLOR_MAP,
} from "@/utils/theme/semantic-catalog";
import { generateThemeCode } from "@/utils/theme/theme-style-generator";
import {
	isInspectorNode,
	revertElementOverride,
	writeEditableText,
} from "./dom-inspector";
import type {
	ElementOverrideItem,
	ElementTextOverrideItem,
	GlobalTokenChangeItem,
	InspectorUndoEntry,
} from "./theme-inspector-types";

/** 对比基线与当前主题草稿，输出全部全局语义令牌变更清单。 */
export function computeGlobalTokenChanges(
	baselineDraft: ThemeDraft,
	draft: ThemeDraft,
): GlobalTokenChangeItem[] {
	const changes: GlobalTokenChangeItem[] = [];
	for (const mode of ["light", "dark"] as const) {
		const baseStyles = baselineDraft.styles[mode];
		const currStyles = draft.styles[mode];
		const keys = new Set([
			...Object.keys(baseStyles),
			...Object.keys(currStyles),
		]) as Set<keyof ThemeStyleProps>;
		for (const key of keys) {
			const before = baseStyles[key] ?? "";
			const after = currStyles[key] ?? "";
			if (before !== after) {
				const meta = SEMANTIC_COLOR_MAP.get(key);
				const semanticLabel =
					meta?.label ??
					(key === "letter-spacing" ? "全局字间距" : `主题参数 ${key}`);
				changes.push({
					mode,
					styleKey: key,
					semanticLabel,
					beforeValue: before,
					afterValue: after,
				});
			}
		}
	}
	return changes;
}

/** 对 DOM 覆写映射执行撤销操作（覆盖样式与文案两类条目）。 */
export function applyDomUndoEntry(
	entry: Exclude<InspectorUndoEntry, { kind: "token" }>,
	overridesMap: Map<string, ElementOverrideItem>,
	textOverridesMap: Map<HTMLElement, ElementTextOverrideItem>,
): void {
	if (entry.kind === "text") {
		writeEditableText(entry.element, entry.textKind, entry.prevText);
		const existing = textOverridesMap.get(entry.element);
		if (existing && entry.prevText === existing.originalText) {
			textOverridesMap.delete(entry.element);
		} else if (existing) {
			textOverridesMap.set(entry.element, {
				...existing,
				currentText: entry.prevText,
			});
		}
		return;
	}
	for (const [id, item] of overridesMap.entries()) {
		if (
			item.element === entry.element &&
			item.cssProperty === entry.cssProperty
		) {
			if (entry.prevValue === null) {
				revertElementOverride(item);
				overridesMap.delete(id);
			} else {
				entry.element.style.setProperty(entry.cssProperty, entry.prevValue);
				overridesMap.set(id, {
					...item,
					appliedValue: entry.prevValue,
					afterSemantic: entry.prevSemantic,
				});
			}
			return;
		}
	}
}

/** 对 DOM 覆写映射执行重做操作（覆盖样式与文案两类条目）。 */
export function applyDomRedoEntry(
	entry: Exclude<InspectorUndoEntry, { kind: "token" }>,
	overridesMap: Map<string, ElementOverrideItem>,
	textOverridesMap: Map<HTMLElement, ElementTextOverrideItem>,
	nextId: (prefix: string) => string,
): void {
	if (entry.kind === "text") {
		writeEditableText(entry.element, entry.textKind, entry.nextText);
		const existing = textOverridesMap.get(entry.element);
		textOverridesMap.set(entry.element, {
			id: existing?.id ?? nextId("txt"),
			element: entry.element,
			elementLabel: entry.elementLabel,
			selector: entry.selector,
			kind: entry.textKind,
			originalText: existing?.originalText ?? entry.prevText,
			currentText: entry.nextText,
		});
		return;
	}
	if (entry.nextValue === null) return;
	let existingKey: string | null = null;
	let existingItem: ElementOverrideItem | null = null;
	for (const [id, item] of overridesMap.entries()) {
		if (
			item.element === entry.element &&
			item.cssProperty === entry.cssProperty
		) {
			existingKey = id;
			existingItem = item;
			break;
		}
	}
	const originalInlineValue = existingItem
		? existingItem.originalInlineValue
		: entry.element.style.getPropertyValue(entry.cssProperty);
	const originalInlinePriority = existingItem
		? existingItem.originalInlinePriority
		: entry.element.style.getPropertyPriority(entry.cssProperty);
	entry.element.style.setProperty(entry.cssProperty, entry.nextValue);
	const id = existingKey ?? nextId("ov");
	overridesMap.set(id, {
		id,
		element: entry.element,
		elementLabel: entry.elementLabel,
		selector: entry.selector,
		cssProperty: entry.cssProperty,
		propertyLabel: entry.propertyLabel,
		beforeSemantic: existingItem
			? existingItem.beforeSemantic
			: entry.prevSemantic,
		afterSemantic: entry.nextSemantic,
		originalInlineValue,
		originalInlinePriority,
		appliedValue: entry.nextValue,
	});
}

/** 根据当前会话所有改动组装 AI 提示词文本。 */
export function buildInspectorPromptExport(params: {
	presetLabel: string;
	mode: "light" | "dark";
	pathname: string;
	tokenChanges: readonly GlobalTokenChangeItem[];
	overridesList: readonly ElementOverrideItem[];
	textOverridesList: readonly ElementTextOverrideItem[];
}): string {
	const elementChanges = [
		...params.overridesList.map((item) => ({
			elementLabel: item.elementLabel,
			selector: item.selector,
			propertyLabel: item.propertyLabel,
			cssProperty: item.cssProperty,
			beforeSemantic: item.beforeSemantic,
			afterSemantic: item.afterSemantic,
			afterValue: item.appliedValue,
		})),
		...params.textOverridesList.map((item) => ({
			elementLabel: item.elementLabel,
			selector: item.selector,
			propertyLabel: "文案内容",
			cssProperty: item.kind === "input-placeholder" ? "placeholder" : "text",
			beforeSemantic: `“${item.originalText}”`,
			afterSemantic: `“${item.currentText}”`,
			afterValue: item.currentText,
		})),
	];
	return formatInspectorPrompt({
		presetLabel: params.presetLabel,
		mode: params.mode,
		pathname: params.pathname,
		tokenChanges: params.tokenChanges.map((item) => ({
			tokenKey: item.styleKey,
			semanticLabel: item.semanticLabel,
			mode: item.mode,
			before: item.beforeValue || "默认",
			after: item.afterValue,
		})),
		elementChanges,
	});
}

/** 组装全局主题变量与元素覆写的 CSS 代码文本。 */
export function buildInspectorCssExport(params: {
	draft: ThemeDraft;
	draftModified: boolean;
	tokenChanges: readonly GlobalTokenChangeItem[];
	overridesList: readonly ElementOverrideItem[];
}): string {
	const parts: string[] = [];
	if (params.tokenChanges.length > 0 || params.draftModified) {
		parts.push(
			generateThemeCode(
				{
					light: {
						...params.draft.styles.light,
						radius: RADIUS_VALUES[params.draft.radius],
						"font-sans": `var(${FONT_CONFIG[params.draft.font].variable})`,
					},
					dark: params.draft.styles.dark,
				},
				"oklch",
			),
		);
	}
	if (params.overridesList.length > 0) {
		const bySelector = new Map<string, ElementOverrideItem[]>();
		for (const item of params.overridesList) {
			const list = bySelector.get(item.selector) ?? [];
			list.push(item);
			bySelector.set(item.selector, list);
		}
		const overrideBlocks: string[] = ["/* 单元素语义与参数调整 */"];
		for (const [sel, items] of bySelector.entries()) {
			overrideBlocks.push(`${sel} {`);
			for (const it of items) {
				overrideBlocks.push(`  /* ${it.propertyLabel}: ${it.afterSemantic} */`);
				overrideBlocks.push(`  ${it.cssProperty}: ${it.appliedValue};`);
			}
			overrideBlocks.push("}");
		}
		parts.push(overrideBlocks.join("\n"));
	}
	return (
		parts.join("\n\n") ||
		"/* 当前暂无修改；修改任意语义令牌或元素属性后可导出 CSS */"
	);
}

/** 在页面 DOM 树中定位目标元素的父级、首个子元素或相邻兄弟（跳过分析器节点）。 */
export function findAdjacentDomElement(
	element: HTMLElement,
	direction: "parent" | "child" | "prev" | "next",
): HTMLElement | null {
	if (direction === "parent") {
		const p = element.parentElement;
		return p && p !== document.body && p !== document.documentElement
			? p
			: null;
	}
	if (direction === "child") {
		return (
			Array.from(element.children).find(
				(c): c is HTMLElement =>
					c instanceof HTMLElement && !isInspectorNode(c),
			) ?? null
		);
	}
	let cur =
		direction === "prev"
			? element.previousElementSibling
			: element.nextElementSibling;
	while (cur) {
		if (cur instanceof HTMLElement && !isInspectorNode(cur)) return cur;
		cur =
			direction === "prev"
				? cur.previousElementSibling
				: cur.nextElementSibling;
	}
	return null;
}
