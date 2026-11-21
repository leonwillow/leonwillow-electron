/**
 * @file 管理员专属「主题分析」右下角悬浮球与不占空间悬浮分析面板。
 * 创建时间：2026-11-21
 * 修改时间：2026-11-21
 * 版本作用：参考 Naive UI 右下角悬浮球形态，收起时仅显示悬浮球且暂停分析方便切页，点击展开浮窗面板并激活悬停语义分析与文案/样式实时调整。
 * 被调用：components/theme-inspector/theme-inspector-host.tsx。
 * 调用：ui Accordion/Button/ConfirmDialog/CopyText/Dialog/Input/ScrollArea/Tabs/Textarea/Tooltip/TooltipIconButton/TooltipText、react-dom、lucide-react、./*。
 * 功能：提供右下角悬浮球、可拖动/调宽浮窗、右上角问号使用提示、元素文案编辑、语义色/排版/布局/外观编辑与剪贴板降级弹窗。
 * 预期结果：全程不挤压工作区布局，收起即暂停拾取方便切换页面，彻底关闭后完整还原临时更改。
 */
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@leonwillow-electron/ui/components/accordion";
import { Button } from "@leonwillow-electron/ui/components/button";
import { ConfirmDialog } from "@leonwillow-electron/ui/components/confirm-dialog";
import { CopyText } from "@leonwillow-electron/ui/components/copy-text";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@leonwillow-electron/ui/components/dialog";
import { Input } from "@leonwillow-electron/ui/components/input";
import { ScrollArea } from "@leonwillow-electron/ui/components/scroll-area";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@leonwillow-electron/ui/components/tabs";
import { Textarea } from "@leonwillow-electron/ui/components/textarea";
import {
	Tooltip,
	TooltipContent,
	TooltipText,
	TooltipTrigger,
} from "@leonwillow-electron/ui/components/tooltip";
import { TooltipIconButton } from "@leonwillow-electron/ui/components/tooltip-icon-button";
import {
	ArrowDownIcon,
	ArrowLeftIcon,
	ArrowRightIcon,
	ArrowUpIcon,
	BoxIcon,
	ChevronDownIcon,
	CircleQuestionMarkIcon,
	Code2Icon,
	CopyIcon,
	CrosshairIcon,
	GripHorizontalIcon,
	LayersIcon,
	LockIcon,
	Minimize2Icon,
	MoonIcon,
	MousePointerClickIcon,
	Redo2Icon,
	RotateCcwIcon,
	RulerIcon,
	SaveIcon,
	ScanEyeIcon,
	SlidersHorizontalIcon,
	SparklesIcon,
	SunIcon,
	Undo2Icon,
	UnlockIcon,
	XIcon,
} from "lucide-react";
import { createPortal } from "react-dom";
import { InspectorAppearanceSection } from "./inspector-appearance-section";
import { InspectorChangesTab } from "./inspector-changes-tab";
import { InspectorColorSection } from "./inspector-color-section";
import { InspectorLayersTab } from "./inspector-layers-tab";
import { InspectorLayoutSection } from "./inspector-layout-section";
import { InspectorTypographySection } from "./inspector-typography-section";
import { ThemeInspectorOverlay } from "./theme-inspector-overlay";
import { useThemeInspectorSession } from "./use-theme-inspector-session";
import "./theme-inspector.css";

export default function ThemeInspector() {
	const s = useThemeInspectorSession();

	return (
		<>
			{/* 仅在展开分析面板时渲染画布覆盖层与测距标尺，收起后完全消失 */}
			{s.panelOpen && (
				<ThemeInspectorOverlay
					hovered={s.hoveredSnapshot}
					locked={s.lockedSnapshot}
					picking={s.picking}
					showGuides={s.showGuides}
					showBoxModel={s.showBoxModel}
				/>
			)}

			{/* 右下角悬浮球（参考 Naive UI Theme Editor FAB） */}
			{createPortal(
				<div data-theme-inspector="true" className="theme-inspector-fab-wrap">
					<Tooltip>
						<TooltipTrigger
							render={
								<button
									type="button"
									data-active={s.panelOpen}
									aria-expanded={s.panelOpen}
									aria-label={
										s.panelOpen
											? "收起主题分析面板并暂停拾取"
											: "展开主题分析面板"
									}
									onClick={s.togglePanel}
									className="theme-inspector-fab"
								/>
							}
						>
							{s.panelOpen ? (
								<ChevronDownIcon className="size-5" aria-hidden="true" />
							) : (
								<ScanEyeIcon className="size-5" aria-hidden="true" />
							)}
							{s.totalChanges > 0 && (
								<span className="theme-inspector-fab-badge font-medium font-mono text-caption">
									{s.totalChanges}
								</span>
							)}
						</TooltipTrigger>
						<TooltipContent data-theme-inspector="true" side="left">
							{s.panelOpen
								? "收起面板（暂停拾取，方便切换页面）"
								: "点击展开主题分析"}
						</TooltipContent>
					</Tooltip>
				</div>,
				document.body,
			)}

			{/* 悬浮分析面板（fixed 定位，不占用页面布局空间） */}
			{s.panelOpen &&
				createPortal(
					<aside
						data-theme-inspector="true"
						aria-label="主题语义分析面板"
						className="theme-inspector-panel"
						style={{
							width: s.panelWidth,
							transform: `translate3d(${s.panelOffset.x}px, ${s.panelOffset.y}px, 0)`,
						}}
					>
						{/* 左侧拖宽手柄 */}
						<hr
							aria-orientation="vertical"
							aria-label="调整主题分析面板宽度"
							tabIndex={0}
							data-resizing={s.resizing}
							onPointerDown={s.startResize}
							onKeyDown={(e) => {
								if (e.key === "ArrowLeft") {
									e.preventDefault();
									s.nudgePanelWidth(16);
								} else if (e.key === "ArrowRight") {
									e.preventDefault();
									s.nudgePanelWidth(-16);
								}
							}}
							className="theme-inspector-resize-handle m-0 hidden border-0 focus-visible:outline-2 focus-visible:outline-ring sm:block"
						/>

						{/* 可拖拽顶栏 + 右上角问号提示气泡 + 收起/关闭 */}
						<div
							onPointerDown={s.startDragPanel}
							className="flex shrink-0 cursor-grab select-none items-center justify-between gap-2 border-b px-3 py-2 active:cursor-grabbing"
						>
							<div className="flex min-w-0 items-center gap-1.5">
								<GripHorizontalIcon
									className="size-3.5 shrink-0 text-muted-foreground"
									aria-hidden="true"
								/>
								<span className="truncate font-semibold text-foreground text-sm">
									主题分析
								</span>
								<TooltipText content={s.currentPresetLabel}>
									<span className="max-w-20 truncate text-caption text-muted-foreground">
										{s.currentPresetLabel}
									</span>
								</TooltipText>
							</div>

							<div className="flex shrink-0 items-center gap-0.5">
								<TooltipIconButton
									size="icon-sm"
									label={
										s.previewMode === "dark" ? "预览浅色模式" : "预览深色模式"
									}
									onClick={() =>
										s.setPreviewMode((m) => (m === "dark" ? "light" : "dark"))
									}
								>
									{s.previewMode === "dark" ? (
										<SunIcon aria-hidden="true" />
									) : (
										<MoonIcon aria-hidden="true" />
									)}
								</TooltipIconButton>

								<TooltipIconButton
									size="icon-sm"
									label="撤销 (⌘Z)"
									disabled={s.undoStack.length === 0}
									disabledReason="没有可撤销的修改"
									onClick={s.handleUndo}
								>
									<Undo2Icon aria-hidden="true" />
								</TooltipIconButton>

								<TooltipIconButton
									size="icon-sm"
									label="重做 (⇧⌘Z)"
									disabled={s.redoStack.length === 0}
									disabledReason="没有可重做的修改"
									onClick={s.handleRedo}
								>
									<Redo2Icon aria-hidden="true" />
								</TooltipIconButton>

								{/* 右上角小问号：将全部操作说明与快捷键收拢于悬停气泡 */}
								<Tooltip>
									<TooltipTrigger
										render={
											<Button
												size="icon-sm"
												variant="ghost"
												aria-label="主题分析使用说明"
											/>
										}
									>
										<CircleQuestionMarkIcon aria-hidden="true" />
									</TooltipTrigger>
									<TooltipContent
										data-theme-inspector="true"
										side="bottom"
										align="end"
										className="max-w-64 space-y-1 leading-relaxed"
									>
										<p>
											• 悬停元素即时查看中文语义与参数，点击锁定后可测距并修改
										</p>
										<p>• 颜色、排版、间距、圆角与阴影均可切换语义或微调数值</p>
										<p>• 选中带文字的元素可直接编辑文案内容</p>
										<p>
											• 按 Esc
											或点击右下角悬浮球可收起暂停分析，方便自由切换页面
										</p>
									</TooltipContent>
								</Tooltip>

								<TooltipIconButton
									size="icon-sm"
									label="收起为悬浮球 (Esc)"
									onClick={s.closePanel}
								>
									<Minimize2Icon aria-hidden="true" />
								</TooltipIconButton>

								<TooltipIconButton
									size="icon-sm"
									label="关闭主题分析悬浮球"
									onClick={s.requestDisable}
								>
									<XIcon aria-hidden="true" />
								</TooltipIconButton>
							</div>
						</div>

						{/* 精简工具栏 */}
						<div className="flex shrink-0 items-center justify-between gap-1 border-b bg-muted/25 px-2.5 py-1.5">
							<div className="flex items-center gap-0.5">
								<TooltipIconButton
									size="icon-sm"
									variant={s.picking ? "secondary" : "ghost"}
									label={
										s.picking
											? "拾取模式（点击暂停以操作页面）"
											: "页面操作中（点击恢复拾取）"
									}
									onClick={() => s.setPicking((v) => !v)}
								>
									{s.picking ? (
										<CrosshairIcon aria-hidden="true" />
									) : (
										<MousePointerClickIcon aria-hidden="true" />
									)}
								</TooltipIconButton>
								<TooltipIconButton
									size="icon-sm"
									label="父级元素"
									disabled={!s.activeElement?.parentElement}
									onClick={() => s.navigateDom("parent")}
								>
									<ArrowUpIcon aria-hidden="true" />
								</TooltipIconButton>
								<TooltipIconButton
									size="icon-sm"
									label="首个子元素"
									disabled={!s.activeElement?.firstElementChild}
									onClick={() => s.navigateDom("child")}
								>
									<ArrowDownIcon aria-hidden="true" />
								</TooltipIconButton>
								<TooltipIconButton
									size="icon-sm"
									label="上一个同级"
									disabled={!s.activeElement?.previousElementSibling}
									onClick={() => s.navigateDom("prev")}
								>
									<ArrowLeftIcon aria-hidden="true" />
								</TooltipIconButton>
								<TooltipIconButton
									size="icon-sm"
									label="下一个同级"
									disabled={!s.activeElement?.nextElementSibling}
									onClick={() => s.navigateDom("next")}
								>
									<ArrowRightIcon aria-hidden="true" />
								</TooltipIconButton>
							</div>

							<div className="flex items-center gap-0.5">
								<TooltipIconButton
									size="icon-sm"
									variant={s.showGuides ? "secondary" : "ghost"}
									label={s.showGuides ? "隐藏测距标尺" : "显示测距标尺"}
									onClick={() => s.setShowGuides((v) => !v)}
								>
									<RulerIcon aria-hidden="true" />
								</TooltipIconButton>
								<TooltipIconButton
									size="icon-sm"
									variant={s.showBoxModel ? "secondary" : "ghost"}
									label={s.showBoxModel ? "隐藏盒模型" : "显示盒模型"}
									onClick={() => s.setShowBoxModel((v) => !v)}
								>
									<BoxIcon aria-hidden="true" />
								</TooltipIconButton>
								<TooltipIconButton
									size="icon-sm"
									variant={s.showCodePreview ? "secondary" : "ghost"}
									label="语义速览"
									onClick={() => s.setShowCodePreview((v) => !v)}
								>
									<Code2Icon aria-hidden="true" />
								</TooltipIconButton>
								<TooltipIconButton
									size="icon-sm"
									label="还原全部修改"
									disabled={!s.hasUnsavedChanges}
									disabledReason="暂无未保存修改"
									onClick={s.handleResetAll}
								>
									<RotateCcwIcon aria-hidden="true" />
								</TooltipIconButton>
							</div>
						</div>

						{/* 三页签 */}
						<Tabs
							value={s.activeTab}
							onValueChange={(v) =>
								s.setActiveTab(v as "design" | "layers" | "changes")
							}
							className="flex min-h-0 flex-1 flex-col gap-0"
						>
							<div className="shrink-0 border-b px-3 py-1.5">
								<TabsList className="grid w-full grid-cols-3">
									<TabsTrigger value="design">
										<SlidersHorizontalIcon aria-hidden="true" />
										语义设计
									</TabsTrigger>
									<TabsTrigger value="layers">
										<LayersIcon aria-hidden="true" />
										层级
									</TabsTrigger>
									<TabsTrigger value="changes">
										<SparklesIcon aria-hidden="true" />
										变更{s.totalChanges > 0 ? ` (${s.totalChanges})` : ""}
									</TabsTrigger>
								</TabsList>
							</div>

							{/* 当前元素语义身份头 + 可直接修改文案内容 */}
							{s.inspectedSnapshot && s.activeTab !== "changes" && (
								<div className="flex shrink-0 flex-col gap-2 border-b bg-muted/15 px-3 py-2">
									<div className="flex min-w-0 items-center justify-between gap-2">
										<div className="min-w-0 flex-1">
											<div className="flex min-w-0 items-center gap-1.5">
												<TooltipText
													content={s.inspectedSnapshot.semanticLabel}
												>
													<span className="min-w-0 truncate font-semibold text-foreground text-sm">
														{s.inspectedSnapshot.semanticLabel}
													</span>
												</TooltipText>
												<span className="shrink-0 font-mono text-caption text-muted-foreground">
													{Math.round(s.inspectedSnapshot.rect.width)}×
													{Math.round(s.inspectedSnapshot.rect.height)}
												</span>
											</div>
											<CopyText
												value={s.inspectedSnapshot.selector}
												className="block truncate font-mono text-caption text-muted-foreground"
											/>
										</div>

										<TooltipIconButton
											size="icon-sm"
											variant={s.lockedEl ? "secondary" : "ghost"}
											label={s.lockedEl ? "已锁定（点击解锁）" : "锁定当前元素"}
											onClick={() =>
												s.setLockedEl((cur) =>
													cur ? null : (s.inspectedSnapshot?.element ?? null),
												)
											}
										>
											{s.lockedEl ? (
												<LockIcon aria-hidden="true" />
											) : (
												<UnlockIcon aria-hidden="true" />
											)}
										</TooltipIconButton>
									</div>

									{/* 元素文案内容实时编辑器（仅当该元素有可编辑文本内容时出现） */}
									{s.inspectedSnapshot.editableText !== null &&
										s.inspectedSnapshot.editableTextKind && (
											<div className="flex items-center gap-1.5">
												<span className="shrink-0 text-caption text-muted-foreground">
													内容
												</span>
												<Input
													size="sm"
													aria-label="修改元素文案内容"
													value={s.inspectedSnapshot.editableText}
													onChange={(e) => {
														const kind = s.inspectedSnapshot?.editableTextKind;
														if (kind) s.applyTextOverride(e.target.value, kind);
													}}
													className="min-w-0 flex-1"
												/>
												{s.inspectedSnapshot.hasTextOverride && (
													<Button
														size="icon-xs"
														variant="ghost"
														aria-label="还原原文案"
														onClick={s.revertCurrentTextOverride}
													>
														<RotateCcwIcon aria-hidden="true" />
													</Button>
												)}
											</div>
										)}

									{s.showCodePreview && (
										<div className="rounded-md border bg-background p-2 font-mono text-caption text-muted-foreground">
											<p>
												背景：
												{s.inspectedSnapshot.colors.background.semanticLabel}
												{s.inspectedSnapshot.colors.background.tokenName
													? ` (${s.inspectedSnapshot.colors.background.tokenName})`
													: ""}
											</p>
											<p>
												文字：{s.inspectedSnapshot.colors.color.semanticLabel}
												{s.inspectedSnapshot.colors.color.tokenName
													? ` (${s.inspectedSnapshot.colors.color.tokenName})`
													: ""}
											</p>
											<p>
												排版：{s.inspectedSnapshot.typography.sizeSemanticLabel}
											</p>
											<p>
												圆角：
												{s.inspectedSnapshot.appearance.radiusSemanticLabel}
											</p>
											<p>
												阴影：{s.inspectedSnapshot.appearance.shadowToken.label}
											</p>
										</div>
									)}
								</div>
							)}

							<ScrollArea className="min-h-0 flex-1">
								<TabsContent value="design" className="mt-0 p-3">
									{!s.inspectedSnapshot ? (
										<div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center text-muted-foreground text-xs">
											<ScanEyeIcon
												className="size-7 text-primary/55"
												aria-hidden="true"
											/>
											<p className="font-medium text-foreground">
												移动鼠标到页面任意元素即可分析
											</p>
										</div>
									) : (
										<Accordion
											multiple
											defaultValue={[
												"colors",
												"typography",
												"layout",
												"appearance",
											]}
											className="w-full gap-2 overflow-visible rounded-none border-0"
										>
											<AccordionItem
												value="colors"
												className="rounded-lg border px-2.5"
											>
												<AccordionTrigger className="cursor-pointer py-2 font-medium text-xs">
													颜色语义
												</AccordionTrigger>
												<AccordionContent className="pt-1 pb-2.5">
													<InspectorColorSection
														colors={s.inspectedSnapshot.colors}
														stateTokens={s.inspectedSnapshot.stateTokens}
														activeMode={s.previewMode}
														draftStyles={s.draft.styles[s.previewMode]}
														onUpdateGlobalToken={s.updateGlobalToken}
														onApplyElementOverride={s.applyElementOverride}
														onRevertElementProperty={s.revertElementProperty}
													/>
												</AccordionContent>
											</AccordionItem>

											<AccordionItem
												value="typography"
												className="rounded-lg border px-2.5"
											>
												<AccordionTrigger className="cursor-pointer py-2 font-medium text-xs">
													排版语义
												</AccordionTrigger>
												<AccordionContent className="pt-1 pb-2.5">
													<InspectorTypographySection
														typography={s.inspectedSnapshot.typography}
														activeFont={s.draft.font}
														globalLetterSpacing={
															s.draft.styles[s.previewMode]["letter-spacing"] ??
															"0em"
														}
														onUpdateGlobalFont={s.updateGlobalFont}
														onUpdateGlobalToken={s.updateGlobalToken}
														onApplyElementOverride={s.applyElementOverride}
													/>
												</AccordionContent>
											</AccordionItem>

											<AccordionItem
												value="layout"
												className="rounded-lg border px-2.5"
											>
												<AccordionTrigger className="cursor-pointer py-2 font-medium text-xs">
													布局与间距语义
												</AccordionTrigger>
												<AccordionContent className="pt-1 pb-2.5">
													<InspectorLayoutSection
														layout={s.inspectedSnapshot.layout}
														onApplyElementOverride={s.applyElementOverride}
													/>
												</AccordionContent>
											</AccordionItem>

											<AccordionItem
												value="appearance"
												className="rounded-lg border px-2.5"
											>
												<AccordionTrigger className="cursor-pointer py-2 font-medium text-xs">
													圆角、线宽与阴影
												</AccordionTrigger>
												<AccordionContent className="pt-1 pb-2.5">
													<InspectorAppearanceSection
														appearance={s.inspectedSnapshot.appearance}
														globalRadius={s.draft.radius}
														globalBorderWidth={
															s.preferences.settings.borderWidth
														}
														onUpdateGlobalRadius={s.updateGlobalRadius}
														onUpdateGlobalBorderWidth={
															s.updateGlobalBorderWidth
														}
														onApplyElementOverride={s.applyElementOverride}
													/>
												</AccordionContent>
											</AccordionItem>
										</Accordion>
									)}
								</TabsContent>

								<TabsContent value="layers" className="mt-0">
									<InspectorLayersTab
										layers={s.inspectedSnapshot?.layers ?? []}
										onSelectElement={(el) => {
											s.setLockedEl(el);
											s.setLastHoveredEl(el);
											s.setActiveTab("design");
											s.bumpSample();
										}}
										onHoverElement={(el) => s.setHoveredEl(el)}
									/>
								</TabsContent>

								<TabsContent value="changes" className="mt-0">
									<InspectorChangesTab
										tokenChanges={s.tokenChanges}
										elementOverrides={s.overridesList}
										textOverrides={s.textOverridesList}
										defaultThemeName={
											s.draft.label || `${s.currentPresetLabel} 调整版`
										}
										canOverwriteCurrent={s.canOverwriteCurrent}
										onRevertGlobalToken={s.revertGlobalToken}
										onRevertElementOverride={s.revertOverrideById}
										onRevertTextOverride={s.revertTextOverrideById}
										onFocusElement={(el) => {
											if (!el.isConnected) return;
											s.setLockedEl(el);
											s.setLastHoveredEl(el);
											s.setActiveTab("design");
											el.scrollIntoView({
												block: "nearest",
												inline: "nearest",
											});
											s.bumpSample();
										}}
										onSaveTheme={s.handleSaveTheme}
										onResetAll={s.handleResetAll}
									/>
								</TabsContent>
							</ScrollArea>
						</Tabs>

						{/* 底部快捷导出栏 */}
						<div className="flex shrink-0 items-center gap-1.5 border-t bg-muted/20 p-2.5">
							<Button
								size="sm"
								variant="outline"
								className="flex-1"
								onClick={() => void s.handleCopyPrompt()}
							>
								<CopyIcon data-icon="inline-start" aria-hidden="true" />
								复制为 AI 提示词
							</Button>
							<Button
								size="sm"
								variant="outline"
								onClick={() => void s.handleCopyCss()}
							>
								<Code2Icon data-icon="inline-start" aria-hidden="true" />
								CSS
							</Button>
							{s.tokenChanges.length > 0 && (
								<Button
									size="sm"
									variant="default"
									onClick={() => s.setActiveTab("changes")}
								>
									<SaveIcon data-icon="inline-start" aria-hidden="true" />
									保存
								</Button>
							)}
						</div>
					</aside>,
					document.body,
				)}

			{/* 剪贴板权限完全受限时的手动复制降级弹框 */}
			<Dialog
				open={s.manualCopyPayload !== null}
				onOpenChange={(open) => {
					if (!open) s.setManualCopyPayload(null);
				}}
			>
				<DialogContent data-theme-inspector="true" className="max-w-lg">
					<DialogHeader>
						<DialogTitle>
							{s.manualCopyPayload?.title ?? "复制内容"}
						</DialogTitle>
					</DialogHeader>
					<Textarea
						readOnly
						rows={10}
						value={s.manualCopyPayload?.content ?? ""}
						onFocus={(e) => e.currentTarget.select()}
						className="font-mono text-xs"
					/>
				</DialogContent>
			</Dialog>

			<ConfirmDialog
				open={s.exitConfirmOpen}
				title="关闭主题分析？"
				confirmLabel="放弃修改并关闭"
				cancelLabel="继续分析"
				confirmVariant="destructive-solid"
				onClose={() => s.setExitConfirmOpen(false)}
				onConfirm={() => {
					s.setExitConfirmOpen(false);
					s.disableInspector();
				}}
			>
				当前有 {s.totalChanges}{" "}
				项未保存的调整。关闭悬浮球将还原临时预览；如需保留，请先前往「变更」保存主题或复制提示词。
			</ConfirmDialog>
		</>
	);
}
