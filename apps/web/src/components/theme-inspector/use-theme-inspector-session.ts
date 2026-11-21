/**
 * @file 主题分析工具的交互会话 Hook：管理悬浮球展开态拾取、草稿预览、样式/文案覆写、撤销重做、拖拽与导出。
 * 创建时间：2026-11-21
 * 修改时间：2026-11-21
 * 版本作用：将有状态 DOM 监听与编辑会话逻辑从视图拆出，收起为悬浮球时自动暂停拾取与覆盖层。
 * 被调用：components/theme-inspector/theme-inspector.tsx。
 * 调用：react、next-themes、sonner、@tanstack/react-router、ui clipboard、stores/theme-*、utils/theme/*、./dom-inspector。
 * 功能：协调悬停采样、点击锁定、文案修改、全局语义令牌预览、单元素覆写、撤销栈、浮窗拖动/调宽、Esc 收起与导出。
 * 预期结果：收起为悬浮球后页面 100% 恢复正常交互；关闭工具时完整还原所有临时样式、文案与未保存预览。
 */
import { copyText } from "@leonwillow-electron/ui/lib/clipboard";
import { useLocation } from "@tanstack/react-router";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { FontKey } from "@/configs/fonts";
import { type ThemePresetKey, themePresets } from "@/configs/theme-presets";
import { isCustomThemeId } from "@/lib/custom-themes";
import { useThemeInspectorStore } from "@/stores/theme-inspector-store";
import { useThemeStore } from "@/stores/theme-store";
import type {
	BorderWidth,
	CustomThemeId,
	Radius,
	ThemeDraft,
	ThemeStyleProps,
} from "@/types/theme";
import { createThemeDraft } from "@/utils/theme/theme-draft";
import {
	hasOpenInspectorPopup,
	inspectElement,
	isInspectorNode,
	revertElementOverride,
	revertTextOverride,
	writeEditableText,
} from "./dom-inspector";
import {
	applyDomRedoEntry,
	applyDomUndoEntry,
	buildInspectorCssExport,
	buildInspectorPromptExport,
	computeGlobalTokenChanges,
	findAdjacentDomElement,
} from "./inspector-export";
import type {
	EditableTextKind,
	ElementOverrideItem,
	ElementTextOverrideItem,
	GlobalTokenChangeItem,
	InspectedElementSnapshot,
	InspectorUndoEntry,
} from "./theme-inspector-types";

export const DEFAULT_INSPECTOR_WIDTH = 368;
export const MIN_INSPECTOR_WIDTH = 304;
export const MAX_INSPECTOR_WIDTH = 520;

/** 从事件目标向上解析最近的 HTMLElement，避免悬停在按钮内部 SVG/path 上时误拾取矢量子节点。 */
function resolveInspectableHtmlElement(
	target: EventTarget | null,
): HTMLElement | null {
	if (target instanceof HTMLElement) return target;
	let cur: Element | null = target instanceof Element ? target : null;
	while (cur) {
		if (cur instanceof HTMLElement) return cur;
		cur = cur.parentElement;
	}
	return null;
}

export function useThemeInspectorSession() {
	const panelOpen = useThemeInspectorStore((state) => state.panelOpen);
	const openPanel = useThemeInspectorStore((state) => state.openPanel);
	const closePanel = useThemeInspectorStore((state) => state.closePanel);
	const togglePanel = useThemeInspectorStore((state) => state.togglePanel);
	const disableInspector = useThemeInspectorStore((state) => state.disable);
	const preferences = useThemeStore((state) => state.preferences);
	const setThemePreview = useThemeStore((state) => state.setThemePreview);
	const saveTheme = useThemeStore((state) => state.saveTheme);
	const updateSettings = useThemeStore((state) => state.updateSettings);
	const { resolvedTheme } = useTheme();
	const pathname = useLocation({ select: (location) => location.pathname });

	const initialMode: "light" | "dark" =
		resolvedTheme === "dark" ? "dark" : "light";
	const [previewMode, setPreviewMode] = useState<"light" | "dark">(initialMode);
	const [draft, setDraft] = useState<ThemeDraft>(() =>
		createThemeDraft(preferences),
	);
	const [baselineDraft, setBaselineDraft] = useState<ThemeDraft>(() =>
		createThemeDraft(preferences),
	);
	const [draftModified, setDraftModified] = useState(false);

	const [panelWidth, setPanelWidth] = useState(DEFAULT_INSPECTOR_WIDTH);
	const [panelOffset, setPanelOffset] = useState({ x: 0, y: 0 });
	const [resizing, setResizing] = useState(false);
	const [picking, setPicking] = useState(true);
	const [showGuides, setShowGuides] = useState(true);
	const [showBoxModel, setShowBoxModel] = useState(true);
	const [showCodePreview, setShowCodePreview] = useState(false);
	const [activeTab, setActiveTab] = useState<"design" | "layers" | "changes">(
		"design",
	);
	const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
	const [manualCopyPayload, setManualCopyPayload] = useState<{
		title: string;
		content: string;
	} | null>(null);

	const [hoveredEl, setHoveredEl] = useState<HTMLElement | null>(null);
	const [lockedEl, setLockedEl] = useState<HTMLElement | null>(null);
	const [lastHoveredEl, setLastHoveredEl] = useState<HTMLElement | null>(null);
	const [sampleTick, setSampleTick] = useState(0);

	const overridesRef = useRef<Map<string, ElementOverrideItem>>(new Map());
	const textOverridesRef = useRef<Map<HTMLElement, ElementTextOverrideItem>>(
		new Map(),
	);
	const [overridesList, setOverridesList] = useState<ElementOverrideItem[]>([]);
	const [textOverridesList, setTextOverridesList] = useState<
		ElementTextOverrideItem[]
	>([]);
	const [undoStack, setUndoStack] = useState<InspectorUndoEntry[]>([]);
	const [redoStack, setRedoStack] = useState<InspectorUndoEntry[]>([]);
	const overrideSeqRef = useRef(0);

	const bumpSample = useCallback(() => {
		setSampleTick((v) => v + 1);
	}, []);

	// 收起为悬浮球时清理悬停/锁定指示，避免切页后残留旧引用
	useEffect(() => {
		if (!panelOpen) {
			setHoveredEl(null);
			setLockedEl(null);
		}
	}, [panelOpen]);

	useEffect(() => {
		if (!draftModified && previewMode === initialMode) {
			setThemePreview(null);
			return;
		}
		const frame = requestAnimationFrame(() => {
			setThemePreview({ draft, mode: previewMode });
			bumpSample();
		});
		return () => cancelAnimationFrame(frame);
	}, [
		draft,
		draftModified,
		initialMode,
		previewMode,
		setThemePreview,
		bumpSample,
	]);

	// 彻底关闭悬浮球卸载时，完整还原所有临时内联样式、文案修改与主题预览
	useEffect(() => {
		return () => {
			for (const item of overridesRef.current.values()) {
				revertElementOverride(item);
			}
			overridesRef.current.clear();
			for (const item of textOverridesRef.current.values()) {
				revertTextOverride(item);
			}
			textOverridesRef.current.clear();
			setThemePreview(null);
		};
	}, [setThemePreview]);

	// 锁定元素期间挂接临时属性，保持 .menu-row-actions 等悬停显现容器可见，移入分析面板或滚动面板时不丢焦、不归零
	useEffect(() => {
		if (!panelOpen || !lockedEl?.isConnected) return;
		lockedEl.setAttribute("data-theme-inspector-locked", "true");
		const revealedDisplay: HTMLElement[] = [];
		const revealedVisible: HTMLElement[] = [];

		let cur: HTMLElement | null = lockedEl;
		let hops = 0;
		while (cur && cur !== document.body && hops < 6) {
			const classes = Array.from(cur.classList);
			const hasHoverReveal = classes.some((cls) => cls.includes("hover"));
			if (hasHoverReveal) {
				if (classes.includes("hidden")) {
					const currentDisplay = getComputedStyle(cur).display;
					if (
						currentDisplay === "flex" ||
						currentDisplay === "inline-flex" ||
						currentDisplay === "block" ||
						currentDisplay === "grid"
					) {
						cur.setAttribute(
							"data-theme-inspector-reveal-display",
							currentDisplay,
						);
						revealedDisplay.push(cur);
					}
				}
				if (classes.includes("opacity-0") || classes.includes("invisible")) {
					cur.setAttribute("data-theme-inspector-reveal-visible", "true");
					revealedVisible.push(cur);
				}
			}
			cur = cur.parentElement;
			hops++;
		}

		return () => {
			lockedEl.removeAttribute("data-theme-inspector-locked");
			for (const node of revealedDisplay) {
				node.removeAttribute("data-theme-inspector-reveal-display");
			}
			for (const node of revealedVisible) {
				node.removeAttribute("data-theme-inspector-reveal-visible");
			}
		};
	}, [panelOpen, lockedEl]);

	useEffect(() => {
		if (!panelOpen) return;
		let frame = 0;
		const schedule = () => {
			if (frame) return;
			frame = requestAnimationFrame(() => {
				frame = 0;
				bumpSample();
			});
		};
		const onScroll = (event: Event) => {
			// 滚动主题分析面板自身内容时不触发页面元素重采样
			if (isInspectorNode(event.target)) return;
			schedule();
		};
		const observer = new MutationObserver(schedule);
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: [
				"class",
				"style",
				"data-theme-radius",
				"data-theme-scale",
			],
		});
		window.addEventListener("scroll", onScroll, true);
		window.addEventListener("resize", schedule);
		return () => {
			if (frame) cancelAnimationFrame(frame);
			observer.disconnect();
			window.removeEventListener("scroll", onScroll, true);
			window.removeEventListener("resize", schedule);
		};
	}, [panelOpen, bumpSample]);

	// 仅在面板展开且处于拾取态时监听悬停与点击，收起后完全零拦截
	useEffect(() => {
		if (!panelOpen || !picking) {
			setHoveredEl(null);
			return;
		}
		let moveFrame = 0;
		let pendingTarget: HTMLElement | null = null;

		const onPointerMove = (event: PointerEvent) => {
			if (hasOpenInspectorPopup()) return;
			if (isInspectorNode(event.target)) {
				if (moveFrame) {
					cancelAnimationFrame(moveFrame);
					moveFrame = 0;
				}
				pendingTarget = null;
				setHoveredEl(null);
				return;
			}
			const target = resolveInspectableHtmlElement(event.target);
			if (
				!target ||
				target === document.body ||
				target === document.documentElement
			) {
				return;
			}
			pendingTarget = target;
			if (moveFrame) return;
			moveFrame = requestAnimationFrame(() => {
				moveFrame = 0;
				if (!pendingTarget?.isConnected) return;
				setHoveredEl(pendingTarget);
				setLastHoveredEl(pendingTarget);
			});
		};

		const onClickCapture = (event: MouseEvent) => {
			if (hasOpenInspectorPopup() || isInspectorNode(event.target)) return;
			const target = resolveInspectableHtmlElement(event.target);
			if (
				!target ||
				target === document.body ||
				target === document.documentElement
			) {
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			setLockedEl(target);
			setLastHoveredEl(target);
			bumpSample();
		};

		document.addEventListener("pointermove", onPointerMove, { passive: true });
		document.addEventListener("click", onClickCapture, true);
		return () => {
			if (moveFrame) cancelAnimationFrame(moveFrame);
			document.removeEventListener("pointermove", onPointerMove);
			document.removeEventListener("click", onClickCapture, true);
		};
	}, [panelOpen, picking, bumpSample]);

	const tokenChanges = useMemo<GlobalTokenChangeItem[]>(
		() => computeGlobalTokenChanges(baselineDraft, draft),
		[baselineDraft, draft],
	);

	const totalChanges =
		tokenChanges.length + overridesList.length + textOverridesList.length;

	const hasUnsavedChanges =
		totalChanges > 0 ||
		draft.font !== baselineDraft.font ||
		draft.radius !== baselineDraft.radius;

	const requestDisable = useCallback(() => {
		if (hasUnsavedChanges) {
			setExitConfirmOpen(true);
			return;
		}
		disableInspector();
	}, [hasUnsavedChanges, disableInspector]);

	const activeElement = useMemo(() => {
		if (!panelOpen) return null;
		if (lockedEl?.isConnected) return lockedEl;
		if (hoveredEl?.isConnected) return hoveredEl;
		if (lastHoveredEl?.isConnected) return lastHoveredEl;
		return null;
	}, [panelOpen, lockedEl, hoveredEl, lastHoveredEl]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: sampleTick 与覆写列表主动触发重采样
	const inspectedSnapshot = useMemo<InspectedElementSnapshot | null>(() => {
		if (!panelOpen || !activeElement?.isConnected) return null;
		return inspectElement(activeElement, {
			mode: previewMode,
			activeFontKey: draft.font,
			overridesByKey: overridesRef.current,
			textOverridesByElement: textOverridesRef.current,
		});
	}, [
		panelOpen,
		activeElement,
		previewMode,
		draft.font,
		sampleTick,
		overridesList,
		textOverridesList,
	]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: sampleTick 驱动悬停框重测坐标
	const hoveredSnapshot = useMemo<InspectedElementSnapshot | null>(() => {
		if (!panelOpen || !hoveredEl?.isConnected) return null;
		if (hoveredEl === activeElement && inspectedSnapshot) {
			return inspectedSnapshot;
		}
		return inspectElement(hoveredEl, {
			mode: previewMode,
			activeFontKey: draft.font,
			overridesByKey: overridesRef.current,
			textOverridesByElement: textOverridesRef.current,
		});
	}, [
		panelOpen,
		hoveredEl,
		activeElement,
		inspectedSnapshot,
		previewMode,
		draft.font,
		sampleTick,
	]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: sampleTick 驱动锁定框重测坐标
	const lockedSnapshot = useMemo<InspectedElementSnapshot | null>(() => {
		if (!panelOpen || !lockedEl?.isConnected) return null;
		if (lockedEl === activeElement && inspectedSnapshot) {
			return inspectedSnapshot;
		}
		return inspectElement(lockedEl, {
			mode: previewMode,
			activeFontKey: draft.font,
			overridesByKey: overridesRef.current,
			textOverridesByElement: textOverridesRef.current,
		});
	}, [
		panelOpen,
		lockedEl,
		activeElement,
		inspectedSnapshot,
		previewMode,
		draft.font,
		sampleTick,
	]);

	const syncOverridesState = useCallback(() => {
		setOverridesList(Array.from(overridesRef.current.values()));
		setTextOverridesList(Array.from(textOverridesRef.current.values()));
		bumpSample();
	}, [bumpSample]);

	const applyElementOverride = useCallback(
		(params: {
			cssProperty: string;
			propertyLabel: string;
			beforeSemantic: string;
			afterSemantic: string;
			value: string;
		}) => {
			if (!activeElement?.isConnected) return;
			setLockedEl(activeElement);

			let existingKey: string | null = null;
			let existingItem: ElementOverrideItem | null = null;
			for (const [k, item] of overridesRef.current.entries()) {
				if (
					item.element === activeElement &&
					item.cssProperty === params.cssProperty
				) {
					existingKey = k;
					existingItem = item;
					break;
				}
			}

			const prevValue = existingItem ? existingItem.appliedValue : null;
			const prevSemantic = existingItem
				? existingItem.afterSemantic
				: params.beforeSemantic;
			const originalInlineValue = existingItem
				? existingItem.originalInlineValue
				: activeElement.style.getPropertyValue(params.cssProperty);
			const originalInlinePriority = existingItem
				? existingItem.originalInlinePriority
				: activeElement.style.getPropertyPriority(params.cssProperty);

			activeElement.style.setProperty(params.cssProperty, params.value);

			const id = existingKey ?? `ov-${++overrideSeqRef.current}`;
			const nextItem: ElementOverrideItem = {
				id,
				element: activeElement,
				elementLabel:
					inspectedSnapshot?.semanticLabel ??
					activeElement.tagName.toLowerCase(),
				selector:
					inspectedSnapshot?.selector ?? activeElement.tagName.toLowerCase(),
				cssProperty: params.cssProperty,
				propertyLabel: params.propertyLabel,
				beforeSemantic: existingItem
					? existingItem.beforeSemantic
					: params.beforeSemantic,
				afterSemantic: params.afterSemantic,
				originalInlineValue,
				originalInlinePriority,
				appliedValue: params.value,
			};
			overridesRef.current.set(id, nextItem);
			setUndoStack((prev) => [
				...prev.slice(-49),
				{
					kind: "element",
					element: activeElement,
					elementLabel: nextItem.elementLabel,
					selector: nextItem.selector,
					cssProperty: params.cssProperty,
					propertyLabel: params.propertyLabel,
					prevSemantic,
					nextSemantic: params.afterSemantic,
					prevValue,
					nextValue: params.value,
				},
			]);
			setRedoStack([]);
			syncOverridesState();
		},
		[activeElement, inspectedSnapshot, syncOverridesState],
	);

	/** 修改元素直接文本内容（保留图标等子元素）。 */
	const applyTextOverride = useCallback(
		(nextText: string, kind: EditableTextKind) => {
			if (!activeElement?.isConnected) return;
			setLockedEl(activeElement);
			const existing = textOverridesRef.current.get(activeElement);
			const originalText = existing
				? existing.originalText
				: (inspectedSnapshot?.editableText ?? "");
			const prevText = existing ? existing.currentText : originalText;
			if (prevText === nextText) return;

			writeEditableText(activeElement, kind, nextText);
			if (nextText === originalText) {
				textOverridesRef.current.delete(activeElement);
			} else {
				textOverridesRef.current.set(activeElement, {
					id: existing?.id ?? `txt-${++overrideSeqRef.current}`,
					element: activeElement,
					elementLabel:
						inspectedSnapshot?.semanticLabel ??
						activeElement.tagName.toLowerCase(),
					selector:
						inspectedSnapshot?.selector ?? activeElement.tagName.toLowerCase(),
					kind,
					originalText,
					currentText: nextText,
				});
			}
			setUndoStack((prev) => [
				...prev.slice(-49),
				{
					kind: "text",
					element: activeElement,
					elementLabel:
						inspectedSnapshot?.semanticLabel ??
						activeElement.tagName.toLowerCase(),
					selector:
						inspectedSnapshot?.selector ?? activeElement.tagName.toLowerCase(),
					textKind: kind,
					prevText,
					nextText,
					wasOriginal: !existing,
				},
			]);
			setRedoStack([]);
			syncOverridesState();
		},
		[activeElement, inspectedSnapshot, syncOverridesState],
	);

	const revertCurrentTextOverride = useCallback(() => {
		if (!activeElement) return;
		const item = textOverridesRef.current.get(activeElement);
		if (!item) return;
		revertTextOverride(item);
		textOverridesRef.current.delete(activeElement);
		syncOverridesState();
	}, [activeElement, syncOverridesState]);

	const revertTextOverrideById = useCallback(
		(id: string) => {
			for (const [el, item] of textOverridesRef.current.entries()) {
				if (item.id === id) {
					revertTextOverride(item);
					textOverridesRef.current.delete(el);
					syncOverridesState();
					return;
				}
			}
		},
		[syncOverridesState],
	);

	const revertElementProperty = useCallback(
		(cssProperty: string) => {
			if (!activeElement) return;
			for (const [id, item] of overridesRef.current.entries()) {
				if (
					item.element === activeElement &&
					item.cssProperty === cssProperty
				) {
					revertElementOverride(item);
					overridesRef.current.delete(id);
					syncOverridesState();
					return;
				}
			}
		},
		[activeElement, syncOverridesState],
	);

	const revertOverrideById = useCallback(
		(id: string) => {
			const item = overridesRef.current.get(id);
			if (!item) return;
			revertElementOverride(item);
			overridesRef.current.delete(id);
			syncOverridesState();
		},
		[syncOverridesState],
	);

	const updateGlobalToken = useCallback(
		(key: keyof ThemeStyleProps, value: string) => {
			setDraftModified(true);
			setDraft((previous) => {
				const prevValue = previous.styles[previewMode][key];
				if (prevValue === value) return previous;
				setUndoStack((stack) => [
					...stack.slice(-49),
					{
						kind: "token",
						mode: previewMode,
						styleKey: key,
						prevValue,
						nextValue: value,
					},
				]);
				setRedoStack([]);
				const nextModeStyles = {
					...previous.styles[previewMode],
					[key]: value,
				};
				if (key === "primary") delete nextModeStyles["primary-hover"];
				if (key === "destructive") {
					delete nextModeStyles["destructive-solid-foreground"];
				}
				return {
					...previous,
					styles: {
						...previous.styles,
						[previewMode]: nextModeStyles,
					},
				};
			});
		},
		[previewMode],
	);

	const revertGlobalToken = useCallback(
		(mode: "light" | "dark", key: keyof ThemeStyleProps) => {
			setDraft((previous) => {
				const baseVal = baselineDraft.styles[mode][key];
				const nextModeStyles = { ...previous.styles[mode] };
				if (baseVal === undefined) delete nextModeStyles[key];
				else nextModeStyles[key] = baseVal;
				return {
					...previous,
					styles: {
						...previous.styles,
						[mode]: nextModeStyles,
					},
				};
			});
		},
		[baselineDraft],
	);

	const handleUndo = useCallback(() => {
		const last = undoStack[undoStack.length - 1];
		if (!last) return;
		setUndoStack((prev) => prev.slice(0, -1));
		setRedoStack((prev) => [...prev, last]);

		if (last.kind === "token") {
			setDraft((previous) => {
				const nextModeStyles = { ...previous.styles[last.mode] };
				if (last.prevValue === undefined) delete nextModeStyles[last.styleKey];
				else nextModeStyles[last.styleKey] = last.prevValue;
				return {
					...previous,
					styles: {
						...previous.styles,
						[last.mode]: nextModeStyles,
					},
				};
			});
			return;
		}

		applyDomUndoEntry(last, overridesRef.current, textOverridesRef.current);
		syncOverridesState();
	}, [undoStack, syncOverridesState]);

	const handleRedo = useCallback(() => {
		const entry = redoStack[redoStack.length - 1];
		if (!entry) return;
		setRedoStack((prev) => prev.slice(0, -1));
		setUndoStack((prev) => [...prev, entry]);

		if (entry.kind === "token") {
			setDraftModified(true);
			setDraft((previous) => ({
				...previous,
				styles: {
					...previous.styles,
					[entry.mode]: {
						...previous.styles[entry.mode],
						[entry.styleKey]: entry.nextValue,
					},
				},
			}));
			return;
		}

		applyDomRedoEntry(
			entry,
			overridesRef.current,
			textOverridesRef.current,
			(prefix) => `${prefix}-${++overrideSeqRef.current}`,
		);
		syncOverridesState();
	}, [redoStack, syncOverridesState]);

	const handleResetAll = useCallback(() => {
		for (const item of overridesRef.current.values()) {
			revertElementOverride(item);
		}
		overridesRef.current.clear();
		for (const item of textOverridesRef.current.values()) {
			revertTextOverride(item);
		}
		textOverridesRef.current.clear();
		const fresh = createThemeDraft(preferences);
		setDraft(fresh);
		setBaselineDraft(fresh);
		setDraftModified(false);
		setPreviewMode(initialMode);
		setThemePreview(null);
		setUndoStack([]);
		setRedoStack([]);
		syncOverridesState();
		toast.success("已还原全部语义、样式与文案调整");
	}, [preferences, initialMode, setThemePreview, syncOverridesState]);

	// 键盘快捷键：Esc 收起为悬浮球（暂停分析，保留草稿便于切页）；⌘Z 撤销重做
	useEffect(() => {
		if (!panelOpen) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.defaultPrevented) return;
			if (event.key === "Escape") {
				if (exitConfirmOpen || manualCopyPayload || hasOpenInspectorPopup()) {
					return;
				}
				if (document.querySelector('[role="dialog"]')) return;
				event.preventDefault();
				closePanel();
				return;
			}
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
				const target = event.target as HTMLElement | null;
				if (
					target &&
					(target.tagName === "INPUT" ||
						target.tagName === "TEXTAREA" ||
						target.isContentEditable)
				) {
					return;
				}
				event.preventDefault();
				if (event.shiftKey) handleRedo();
				else handleUndo();
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [
		panelOpen,
		exitConfirmOpen,
		manualCopyPayload,
		closePanel,
		handleUndo,
		handleRedo,
	]);

	const startResize = (event: React.PointerEvent<HTMLElement>) => {
		event.preventDefault();
		setResizing(true);
		const startX = event.clientX;
		const startWidth = panelWidth;
		const onMove = (moveEvent: PointerEvent) => {
			const delta = startX - moveEvent.clientX;
			setPanelWidth(
				Math.max(
					MIN_INSPECTOR_WIDTH,
					Math.min(MAX_INSPECTOR_WIDTH, startWidth + delta),
				),
			);
		};
		const onUp = () => {
			setResizing(false);
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
		};
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
	};

	const startDragPanel = (event: React.PointerEvent<HTMLElement>) => {
		if (
			(event.target as HTMLElement).closest("button, input, [role='button']")
		) {
			return;
		}
		event.preventDefault();
		const startX = event.clientX;
		const startY = event.clientY;
		const initial = panelOffset;
		const onMove = (moveEvent: PointerEvent) => {
			const dx = moveEvent.clientX - startX;
			const dy = moveEvent.clientY - startY;
			const maxLeft = Math.max(0, window.innerWidth - panelWidth - 40);
			setPanelOffset({
				x: Math.max(-maxLeft, Math.min(12, initial.x + dx)),
				y: Math.max(-window.innerHeight + 220, Math.min(48, initial.y + dy)),
			});
		};
		const onUp = () => {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
		};
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
	};

	const nudgePanelWidth = (delta: number) => {
		setPanelWidth((w) =>
			Math.max(MIN_INSPECTOR_WIDTH, Math.min(MAX_INSPECTOR_WIDTH, w + delta)),
		);
	};

	const navigateDom = (direction: "parent" | "child" | "prev" | "next") => {
		if (!activeElement) return;
		const next = findAdjacentDomElement(activeElement, direction);
		if (next) {
			setLockedEl(next);
			setLastHoveredEl(next);
			bumpSample();
		}
	};

	const currentPreset = preferences.settings.themePreset;
	const currentPresetLabel =
		currentPreset === "default"
			? "默认主题"
			: currentPreset in themePresets
				? themePresets[currentPreset as Exclude<ThemePresetKey, "default">]
						.label
				: (preferences.customThemes.find(
						(t) => !t.deletedAt && t.id === currentPreset,
					)?.label ?? "自定义主题");
	const canOverwriteCurrent = isCustomThemeId(currentPreset);

	const handleSaveTheme = (label: string, saveAsCopy: boolean) => {
		try {
			const nextDraft: ThemeDraft = { ...draft, label };
			saveTheme(
				nextDraft,
				!saveAsCopy && canOverwriteCurrent
					? (currentPreset as CustomThemeId)
					: undefined,
			);
			setBaselineDraft(nextDraft);
			setDraft(nextDraft);
			setDraftModified(false);
			toast.success(`主题「${label}」已保存并应用`);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "保存主题失败");
		}
	};

	const handleCopyPrompt = async () => {
		const promptText = buildInspectorPromptExport({
			presetLabel: currentPresetLabel,
			mode: previewMode,
			pathname,
			tokenChanges,
			overridesList,
			textOverridesList,
		});
		try {
			await copyText(promptText);
			toast.success("已复制语义修改提示词");
		} catch {
			setManualCopyPayload({
				title: "手动复制 AI 提示词",
				content: promptText,
			});
		}
	};

	const handleCopyCss = async () => {
		const cssOut = buildInspectorCssExport({
			draft,
			draftModified,
			tokenChanges,
			overridesList,
		});
		try {
			await copyText(cssOut);
			toast.success("已复制 CSS 样式代码");
		} catch {
			setManualCopyPayload({ title: "手动复制 CSS 代码", content: cssOut });
		}
	};

	return {
		panelOpen,
		openPanel,
		closePanel,
		togglePanel,
		disableInspector,
		preferences,
		previewMode,
		setPreviewMode,
		draft,
		panelWidth,
		panelOffset,
		resizing,
		picking,
		setPicking,
		showGuides,
		setShowGuides,
		showBoxModel,
		setShowBoxModel,
		showCodePreview,
		setShowCodePreview,
		activeTab,
		setActiveTab,
		exitConfirmOpen,
		setExitConfirmOpen,
		manualCopyPayload,
		setManualCopyPayload,
		lockedEl,
		setLockedEl,
		setHoveredEl,
		setLastHoveredEl,
		activeElement,
		inspectedSnapshot,
		hoveredSnapshot,
		lockedSnapshot,
		overridesList,
		textOverridesList,
		tokenChanges,
		totalChanges,
		undoStack,
		redoStack,
		hasUnsavedChanges,
		currentPresetLabel,
		canOverwriteCurrent,
		bumpSample,
		requestDisable,
		applyElementOverride,
		applyTextOverride,
		revertCurrentTextOverride,
		revertTextOverrideById,
		revertElementProperty,
		revertOverrideById,
		updateGlobalToken,
		revertGlobalToken,
		handleUndo,
		handleRedo,
		handleResetAll,
		startResize,
		startDragPanel,
		nudgePanelWidth,
		navigateDom,
		handleSaveTheme,
		handleCopyPrompt,
		handleCopyCss,
		updateGlobalFont: (font: FontKey) => {
			setDraftModified(true);
			setDraft((prev) => ({ ...prev, font }));
		},
		updateGlobalRadius: (radius: Radius) => {
			setDraftModified(true);
			setDraft((prev) => ({ ...prev, radius }));
		},
		updateGlobalBorderWidth: (width: BorderWidth) => {
			updateSettings({ borderWidth: width });
			bumpSample();
		},
	};
}
