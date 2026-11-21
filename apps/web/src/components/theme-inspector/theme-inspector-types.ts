/**
 * @file 主题分析工具的视图与快照共享类型定义。
 * 创建时间：2026-11-21
 * 修改时间：2026-11-21
 * 版本作用：统一 DOM 检查引擎、画布覆盖层、各语义编辑分区与变更历史的数据契约。
 * 被调用：components/theme-inspector/*。
 * 调用：types/theme、utils/theme/semantic-catalog。
 * 功能：声明元素语义快照、颜色/排版/布局/外观语义结构、元素级覆写与历史撤销栈类型。
 * 预期结果：各子组件类型严格对齐，不引入跨模块循环引用。
 */
import type { ThemeStyleProps } from "@/types/theme";
import type {
	ColorChannel,
	ContrastInfo,
	ParsedStateColorMatch,
	SemanticColorTokenMeta,
	SemanticControlSizeToken,
	SemanticRadiusToken,
	SemanticShadowToken,
	SemanticSpacingToken,
	SemanticTypographyToken,
	SemanticWeightToken,
} from "@/utils/theme/semantic-catalog";

export type RectSnapshot = {
	left: number;
	top: number;
	width: number;
	height: number;
	right: number;
	bottom: number;
};

export type BoxSpacingValues = {
	top: number;
	right: number;
	bottom: number;
	left: number;
};

export type SemanticColorResolutionSource =
	| "override"
	| "class"
	| "stylesheet"
	| "inherited"
	| "palette-match"
	| "transparent"
	| "custom";

export type InspectedColorSlot = {
	channel: ColorChannel;
	channelLabel: string;
	cssProperty: string;
	semanticMeta: SemanticColorTokenMeta | null;
	semanticLabel: string;
	tokenName: string | null;
	opacityPercent: number;
	source: SemanticColorResolutionSource;
	sourceNote: string;
	viaGlobalLineColor: boolean;
	rawComputed: string;
	hex: string;
	oklch: string;
	rgb: string;
	alphaPercent: number;
	transparent: boolean;
	contrast: ContrastInfo | null;
};

export type InspectedTypography = {
	sizeToken: SemanticTypographyToken | null;
	sizeSemanticLabel: string;
	sizeSource: "class" | "computed" | "custom";
	computedSizePx: number;
	computedSizeRem: number;
	weightToken: SemanticWeightToken;
	computedWeight: number;
	computedLineHeightPx: number;
	lineHeightRatio: number;
	letterSpacingText: string;
	fontFamilySemantic: string;
	fontFamilyToken: string | null;
	fontFamilyRaw: string;
	textAlign: string;
	tabularNums: boolean;
};

export type InspectedLayout = {
	display: string;
	displaySemantic: string;
	flexDirection: string;
	justifyContent: string;
	alignItems: string;
	widthPx: number;
	heightPx: number;
	controlSizeToken: SemanticControlSizeToken | null;
	controlSizeLabel: string;
	gapPx: number;
	gapSemantic: SemanticSpacingToken | null;
	padding: BoxSpacingValues;
	paddingSemanticSummary: string;
	margin: BoxSpacingValues;
	marginSemanticSummary: string;
};

export type InspectedAppearance = {
	radiusPx: number;
	radiusToken: SemanticRadiusToken | null;
	radiusSemanticLabel: string;
	borderWidthPx: number;
	borderStyle: string;
	borderWidthSemanticLabel: string;
	usesGlobalBorderWidth: boolean;
	shadowToken: SemanticShadowToken;
	shadowRaw: string;
	opacityPercent: number;
};

export type LayerTreeNode = {
	element: HTMLElement;
	semanticLabel: string;
	category: string;
	tagLabel: string;
	tokenHints: string[];
	depth: number;
	relation: "ancestor" | "current" | "child";
};

export type EditableTextKind =
	| "text-node"
	| "input-value"
	| "input-placeholder";

export type InspectedElementSnapshot = {
	element: HTMLElement;
	semanticLabel: string;
	category: string;
	tagName: string;
	dataSlot: string | null;
	selector: string;
	textPreview: string;
	editableText: string | null;
	editableTextKind: EditableTextKind | null;
	hasTextOverride: boolean;
	classList: string[];
	rect: RectSnapshot;
	colors: Record<ColorChannel, InspectedColorSlot>;
	stateTokens: ParsedStateColorMatch[];
	typography: InspectedTypography;
	layout: InspectedLayout;
	appearance: InspectedAppearance;
	layers: LayerTreeNode[];
};

export type DistanceGuide = {
	axis: "horizontal" | "vertical";
	x1: number;
	y1: number;
	x2: number;
	y2: number;
	distancePx: number;
	labelX: number;
	labelY: number;
};

export type ElementOverrideItem = {
	id: string;
	element: HTMLElement;
	elementLabel: string;
	selector: string;
	cssProperty: string;
	propertyLabel: string;
	beforeSemantic: string;
	afterSemantic: string;
	originalInlineValue: string;
	originalInlinePriority: string;
	appliedValue: string;
};

export type GlobalTokenChangeItem = {
	mode: "light" | "dark";
	styleKey: keyof ThemeStyleProps;
	semanticLabel: string;
	beforeValue: string;
	afterValue: string;
};

export type ElementTextOverrideItem = {
	id: string;
	element: HTMLElement;
	elementLabel: string;
	selector: string;
	kind: EditableTextKind;
	originalText: string;
	currentText: string;
};

export type InspectorUndoEntry =
	| {
			kind: "element";
			element: HTMLElement;
			elementLabel: string;
			selector: string;
			cssProperty: string;
			propertyLabel: string;
			prevSemantic: string;
			nextSemantic: string;
			prevValue: string | null;
			nextValue: string | null;
	  }
	| {
			kind: "text";
			element: HTMLElement;
			elementLabel: string;
			selector: string;
			textKind: EditableTextKind;
			prevText: string;
			nextText: string;
			wasOriginal: boolean;
	  }
	| {
			kind: "token";
			mode: "light" | "dark";
			styleKey: keyof ThemeStyleProps;
			prevValue: string | undefined;
			nextValue: string;
	  };
