/**
 * @file 主题分析面板的「语义颜色」展示与双向编辑分区。
 * 创建时间：2026-11-21
 * 修改时间：2026-11-21
 * 版本作用：精简卡片信息密度，优先突出语义角色、令牌名与关键数值，用途说明收拢至悬停提示。
 * 被调用：components/theme-inspector/theme-inspector.tsx。
 * 调用：ui Badge/Button/ColorPicker/CopyText/Select/Tooltip/TooltipText、utils/theme/semantic-catalog、./dom-inspector。
 * 功能：展示背景、文字、边框与轮廓语义及交互态语义，支持切换语义令牌、混合不透明度与 ReUI 调色盘实时调色。
 * 预期结果：界面清爽紧凑无多余文字堆砌，修改全局语义色或单元素颜色即时生效。
 */
import { Badge } from "@leonwillow-electron/ui/components/badge";
import { Button } from "@leonwillow-electron/ui/components/button";
import {
	ColorPicker,
	ColorPickerContent,
	ColorPickerTrigger,
} from "@leonwillow-electron/ui/components/color-picker";
import { CopyText } from "@leonwillow-electron/ui/components/copy-text";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
} from "@leonwillow-electron/ui/components/select";
import {
	Tooltip,
	TooltipContent,
	TooltipText,
	TooltipTrigger,
} from "@leonwillow-electron/ui/components/tooltip";
import { cn } from "@leonwillow-electron/ui/lib/utils";
import { CircleQuestionMarkIcon, RotateCcwIcon } from "lucide-react";
import { useState } from "react";
import { isColorValue } from "@/lib/custom-themes";
import type { ThemeStyleProps } from "@/types/theme";
import {
	type ColorChannel,
	type ParsedStateColorMatch,
	SEMANTIC_COLOR_GROUP_LABELS,
	SEMANTIC_COLOR_GROUP_ORDER,
	SEMANTIC_COLOR_MAP,
	SEMANTIC_COLOR_TOKENS,
} from "@/utils/theme/semantic-catalog";
import { buildSemanticColorCssValue } from "./dom-inspector";
import type { InspectedColorSlot } from "./theme-inspector-types";

const OPACITY_PRESETS = [100, 80, 50, 20, 15, 10] as const;

type InspectorColorSectionProps = {
	colors: Record<ColorChannel, InspectedColorSlot>;
	stateTokens: ParsedStateColorMatch[];
	activeMode: "light" | "dark";
	draftStyles: Partial<ThemeStyleProps>;
	onUpdateGlobalToken: (key: keyof ThemeStyleProps, value: string) => void;
	onApplyElementOverride: (params: {
		cssProperty: string;
		propertyLabel: string;
		beforeSemantic: string;
		afterSemantic: string;
		value: string;
	}) => void;
	onRevertElementProperty: (cssProperty: string) => void;
};

function ContrastBadge({
	contrast,
}: {
	contrast: InspectedColorSlot["contrast"];
}) {
	if (!contrast) return null;
	const variant =
		contrast.level === "aaa" || contrast.level === "aa"
			? "success"
			: contrast.level === "aa-large"
				? "warning"
				: "destructive";
	return (
		<Badge variant={variant} className="shrink-0 font-mono text-caption">
			{contrast.label}
		</Badge>
	);
}

function ColorSlotCard({
	slot,
	draftStyles,
	onUpdateGlobalToken,
	onApplyElementOverride,
	onRevertElementProperty,
}: {
	slot: InspectedColorSlot;
	draftStyles: Partial<ThemeStyleProps>;
	onUpdateGlobalToken: (key: keyof ThemeStyleProps, value: string) => void;
	onApplyElementOverride: InspectorColorSectionProps["onApplyElementOverride"];
	onRevertElementProperty: (cssProperty: string) => void;
}) {
	const canEditGlobal = Boolean(
		slot.semanticMeta?.editable && slot.semanticMeta.styleKey,
	);
	const [editScope, setEditScope] = useState<"global" | "element">("global");
	const [pickerOpen, setPickerOpen] = useState(false);

	const effectiveScope = canEditGlobal ? editScope : "element";
	const selectedSemanticKey =
		slot.semanticMeta?.key ?? (slot.transparent ? "transparent" : "__custom__");

	const globalTokenValue = slot.semanticMeta?.styleKey
		? (draftStyles[slot.semanticMeta.styleKey] ?? slot.hex)
		: slot.hex;
	const pickerColor =
		effectiveScope === "global"
			? isColorValue(globalTokenValue)
				? globalTokenValue
				: isColorValue(slot.hex)
					? slot.hex
					: null
			: isColorValue(slot.hex)
				? slot.hex
				: null;

	const handleSemanticSelect = (nextKey: string | null) => {
		if (!nextKey || nextKey === "__custom__") return;
		if (nextKey === "transparent") {
			onApplyElementOverride({
				cssProperty: slot.cssProperty,
				propertyLabel: slot.channelLabel,
				beforeSemantic: slot.semanticLabel,
				afterSemantic: "透明 (transparent)",
				value: "transparent",
			});
			return;
		}
		const meta = SEMANTIC_COLOR_MAP.get(nextKey);
		if (!meta) return;
		const nextOpacity = slot.opacityPercent > 0 ? slot.opacityPercent : 100;
		const cssValue = buildSemanticColorCssValue(meta.key, nextOpacity);
		onApplyElementOverride({
			cssProperty: slot.cssProperty,
			propertyLabel: slot.channelLabel,
			beforeSemantic: slot.semanticLabel,
			afterSemantic:
				nextOpacity < 100
					? `${meta.label} (${meta.varName} / ${nextOpacity}%)`
					: `${meta.label} (${meta.varName})`,
			value: cssValue,
		});
	};

	const handleOpacitySelect = (pct: number) => {
		if (!slot.semanticMeta) return;
		const cssValue = buildSemanticColorCssValue(slot.semanticMeta.key, pct);
		onApplyElementOverride({
			cssProperty: slot.cssProperty,
			propertyLabel: slot.channelLabel,
			beforeSemantic: slot.semanticLabel,
			afterSemantic:
				pct < 100
					? `${slot.semanticMeta.label} (${slot.semanticMeta.varName} / ${pct}%)`
					: `${slot.semanticMeta.label} (${slot.semanticMeta.varName})`,
			value: cssValue,
		});
	};

	const hintText = [slot.semanticMeta?.description, slot.sourceNote]
		.filter(Boolean)
		.join(" · ");

	return (
		<div className="flex flex-col gap-2 rounded-lg border bg-background/60 p-2.5">
			{/* 语义角色与令牌名一行紧凑展示，说明收拢到小问号气泡 */}
			<div className="flex min-w-0 items-center justify-between gap-2">
				<div className="flex min-w-0 flex-1 items-center gap-1.5">
					<span className="shrink-0 text-caption text-muted-foreground">
						{slot.channelLabel}
					</span>
					<TooltipText content={slot.semanticLabel}>
						<span className="min-w-0 truncate font-semibold text-foreground text-xs">
							{slot.semanticLabel}
						</span>
					</TooltipText>
					{hintText && (
						<Tooltip>
							<TooltipTrigger
								render={
									<button
										type="button"
										aria-label={`${slot.channelLabel}语义说明`}
										className="inline-flex shrink-0 text-muted-foreground/70 hover:text-foreground"
									/>
								}
							>
								<CircleQuestionMarkIcon className="size-3" aria-hidden="true" />
							</TooltipTrigger>
							<TooltipContent
								data-theme-inspector="true"
								className="max-w-56 leading-relaxed"
							>
								{hintText}
							</TooltipContent>
						</Tooltip>
					)}
				</div>

				<div className="flex shrink-0 items-center gap-1">
					{slot.tokenName && (
						<CopyText
							value={slot.tokenName}
							className="rounded-sm bg-muted px-1 py-0.5 font-mono text-caption text-foreground"
						/>
					)}
					{slot.source === "override" && (
						<Button
							size="icon-xs"
							variant="ghost"
							aria-label={`还原${slot.channelLabel}`}
							onClick={() => onRevertElementProperty(slot.cssProperty)}
						>
							<RotateCcwIcon aria-hidden="true" />
						</Button>
					)}
				</div>
			</div>

			{/* 参数与对比度紧凑行 */}
			<div className="flex min-w-0 items-center justify-between gap-2 rounded-md bg-muted/50 px-2 py-1 font-mono text-caption text-muted-foreground">
				<div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
					{!slot.transparent ? (
						<>
							<CopyText value={slot.hex} className="shrink-0 text-foreground" />
							<TooltipText content={slot.oklch}>
								<span className="min-w-0 truncate">{slot.oklch}</span>
							</TooltipText>
						</>
					) : (
						<span>transparent</span>
					)}
				</div>
				{slot.contrast && <ContrastBadge contrast={slot.contrast} />}
			</div>

			{/* 切换归属语义 + 透明度档位 */}
			<div className="flex flex-col gap-1.5">
				<Select
					value={selectedSemanticKey}
					onValueChange={handleSemanticSelect}
				>
					<SelectTrigger
						size="sm"
						className="w-full"
						aria-label={`切换${slot.channelLabel}语义`}
					>
						<span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-left">
							<span
								className="theme-inspector-swatch-dot size-3 shrink-0 rounded-xs border"
								style={{
									backgroundColor: slot.transparent ? "transparent" : slot.hex,
								}}
								aria-hidden="true"
							/>
							<span className="truncate">{slot.semanticLabel}</span>
						</span>
					</SelectTrigger>
					<SelectContent data-theme-inspector="true" align="start">
						<SelectGroup>
							<SelectLabel>特殊状态</SelectLabel>
							<SelectItem value="transparent">透明（transparent）</SelectItem>
							{selectedSemanticKey === "__custom__" && (
								<SelectItem value="__custom__" disabled>
									当前自定义色值
								</SelectItem>
							)}
						</SelectGroup>
						{SEMANTIC_COLOR_GROUP_ORDER.map((group) => {
							const items = SEMANTIC_COLOR_TOKENS.filter(
								(item) => item.group === group,
							);
							return (
								<SelectGroup key={group}>
									<SelectLabel>
										{SEMANTIC_COLOR_GROUP_LABELS[group]}
									</SelectLabel>
									{items.map((item) => (
										<SelectItem key={item.key} value={item.key}>
											<span className="flex items-center gap-2">
												<span
													className="theme-inspector-swatch-dot size-3 shrink-0 rounded-xs border"
													style={{ backgroundColor: `var(${item.varName})` }}
													aria-hidden="true"
												/>
												<span>{item.label}</span>
												<span className="font-mono text-caption text-muted-foreground">
													{item.varName}
												</span>
											</span>
										</SelectItem>
									))}
								</SelectGroup>
							);
						})}
					</SelectContent>
				</Select>

				{slot.semanticMeta && (
					<div className="flex items-center justify-between gap-1">
						<span className="shrink-0 text-caption text-muted-foreground">
							不透明度
						</span>
						<div className="flex items-center gap-0.5">
							{OPACITY_PRESETS.map((pct) => (
								<button
									key={pct}
									type="button"
									onClick={() => handleOpacitySelect(pct)}
									className={cn(
										"rounded-sm px-1 py-0.5 font-mono text-caption transition-colors",
										slot.opacityPercent === pct
											? "bg-accent font-medium text-accent-foreground"
											: "text-muted-foreground hover:bg-muted hover:text-foreground",
									)}
									aria-label={`混合不透明度 ${pct}%`}
								>
									{pct}%
								</button>
							))}
						</div>
					</div>
				)}
			</div>

			{/* 调节色值参数 */}
			<div className="flex flex-col gap-1.5 border-t pt-2">
				<div className="flex items-center justify-between gap-2">
					<span className="shrink-0 text-caption text-muted-foreground">
						调色范围
					</span>
					<div className="inline-flex shrink-0 rounded-md border bg-muted/40 p-0.5">
						{canEditGlobal && (
							<button
								type="button"
								onClick={() => setEditScope("global")}
								className={cn(
									"whitespace-nowrap rounded-sm px-1.5 py-0.5 text-caption transition-colors",
									effectiveScope === "global"
										? "bg-card font-medium text-foreground shadow-2xs"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								全局语义
							</button>
						)}
						<button
							type="button"
							onClick={() => setEditScope("element")}
							className={cn(
								"whitespace-nowrap rounded-sm px-1.5 py-0.5 text-caption transition-colors",
								effectiveScope === "element"
									? "bg-card font-medium text-foreground shadow-2xs"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							仅此元素
						</button>
					</div>
				</div>

				<ColorPicker
					open={pickerOpen}
					onOpenChange={setPickerOpen}
					value={pickerColor}
					alpha
					format="hex"
					aria-label={`调整${slot.channelLabel}色值`}
					onValueChange={(nextColor) => {
						if (!nextColor) return;
						if (effectiveScope === "global" && slot.semanticMeta?.styleKey) {
							onUpdateGlobalToken(slot.semanticMeta.styleKey, nextColor);
							return;
						}
						onApplyElementOverride({
							cssProperty: slot.cssProperty,
							propertyLabel: slot.channelLabel,
							beforeSemantic: slot.semanticLabel,
							afterSemantic: `自定义色 (${nextColor})`,
							value: nextColor,
						});
					}}
				>
					<ColorPickerTrigger
						className="w-full"
						size="default"
						aria-label={`打开${slot.channelLabel}调色盘`}
					/>
					<ColorPickerContent
						data-theme-inspector="true"
						side="left"
						align="start"
						sideOffset={10}
						className="shadow-xl data-closed:animate-none data-open:animate-none"
					/>
				</ColorPicker>
			</div>
		</div>
	);
}

export function InspectorColorSection({
	colors,
	stateTokens,
	draftStyles,
	onUpdateGlobalToken,
	onApplyElementOverride,
	onRevertElementProperty,
}: InspectorColorSectionProps) {
	const [editingStateToken, setEditingStateToken] = useState<string | null>(
		null,
	);
	const [statePickerOpen, setStatePickerOpen] = useState(false);

	const activeStateMeta = editingStateToken
		? (SEMANTIC_COLOR_MAP.get(editingStateToken) ?? null)
		: null;
	const stateColorVal =
		activeStateMeta?.styleKey && draftStyles[activeStateMeta.styleKey]
			? (draftStyles[activeStateMeta.styleKey] ?? "")
			: "";

	const visibleChannels: ColorChannel[] = [
		"background",
		"color",
		...(colors.border.semanticLabel !== "无边框 (0px)" ||
		stateTokens.some((s) => s.channel === "border")
			? (["border"] as const)
			: []),
		...(colors.outline.source !== "transparent" ? (["outline"] as const) : []),
	];

	return (
		<div className="flex flex-col gap-2.5">
			{stateTokens.length > 0 && (
				<div className="flex flex-col gap-1.5 rounded-lg border border-dashed bg-muted/25 p-2">
					<div className="flex flex-wrap gap-1">
						{stateTokens.map((item) => {
							const meta = SEMANTIC_COLOR_MAP.get(item.tokenKey);
							const selected = editingStateToken === item.tokenKey;
							return (
								<Tooltip
									key={`${item.state}-${item.part}-${item.tokenKey}`}
									disableHoverablePopup
								>
									<TooltipTrigger
										render={
											<button
												type="button"
												onClick={() => {
													if (meta?.editable) {
														setEditingStateToken(
															selected ? null : item.tokenKey,
														);
													}
												}}
												className={cn(
													"inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-caption transition-colors",
													selected
														? "border-primary bg-accent text-accent-foreground"
														: "bg-card text-foreground hover:bg-muted",
												)}
											/>
										}
									>
										<span
											className="theme-inspector-swatch-dot size-2 shrink-0 rounded-full border"
											style={{ backgroundColor: `var(--${item.tokenKey})` }}
											aria-hidden="true"
										/>
										<span className="text-muted-foreground">
											{item.stateLabel}·{item.partLabel}
										</span>
										<span className="font-medium">
											{meta?.label ?? item.tokenKey}
											{item.opacityPercent < 100
												? `/${item.opacityPercent}%`
												: ""}
										</span>
									</TooltipTrigger>
									<TooltipContent
										data-theme-inspector="true"
										className="max-w-72 font-mono text-caption leading-relaxed"
									>
										<div>
											{item.rawClass} → --{item.tokenKey}
										</div>
										{meta?.editable && (
											<div className="font-sans opacity-80">
												点击可调整该全局语义色
											</div>
										)}
									</TooltipContent>
								</Tooltip>
							);
						})}
					</div>

					{activeStateMeta?.editable && activeStateMeta.styleKey && (
						<div className="flex flex-col gap-1.5 border-t pt-2">
							<div className="flex items-center justify-between gap-2 text-caption">
								<span className="truncate font-medium text-foreground">
									{activeStateMeta.label} ({activeStateMeta.varName})
								</span>
								<Button
									size="xs"
									variant="ghost"
									onClick={() => setEditingStateToken(null)}
								>
									收起
								</Button>
							</div>
							<ColorPicker
								open={statePickerOpen}
								onOpenChange={setStatePickerOpen}
								value={isColorValue(stateColorVal) ? stateColorVal : null}
								alpha
								format="hex"
								aria-label={`调整${activeStateMeta.label}`}
								onValueChange={(nextColor) => {
									if (!nextColor || !activeStateMeta.styleKey) return;
									onUpdateGlobalToken(activeStateMeta.styleKey, nextColor);
								}}
							>
								<ColorPickerTrigger className="w-full" size="default" />
								<ColorPickerContent
									data-theme-inspector="true"
									side="left"
									align="start"
									sideOffset={10}
									className="shadow-xl data-closed:animate-none data-open:animate-none"
								/>
							</ColorPicker>
						</div>
					)}
				</div>
			)}

			{visibleChannels.map((channel) => (
				<ColorSlotCard
					key={channel}
					slot={colors[channel]}
					draftStyles={draftStyles}
					onUpdateGlobalToken={onUpdateGlobalToken}
					onApplyElementOverride={onApplyElementOverride}
					onRevertElementProperty={onRevertElementProperty}
				/>
			))}
		</div>
	);
}
