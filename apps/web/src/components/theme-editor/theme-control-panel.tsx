/**
 * @file 一次主题编辑会话的草稿与操作面板。
 * 创建时间：未记录（现有文件尚无 Git 创建记录）
 * 修改时间：2026-11-21
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：components/theme-editor/theme-editor.tsx。
 * 调用：ui 基础组件/样式、lucide-react、next-themes、react、sonner、configs/fonts、configs/theme-settings、stores/theme-store、lib/custom-themes、types/theme、utils/theme/color-converter、utils/theme/css-import、utils/theme/theme-draft、utils/theme/theme-style-generator、./css-import-dialog、./shadow-control、./slider-with-input、./theme-color-panel、./theme-preset-select。
 * 功能：管理基础主题、浅深色预览、保存、导入导出及删除确认。
 * 预期结果：保存成功才关闭；取消恢复已保存偏好，失败保留草稿。
 */

import { Badge } from "@leonwillow-electron/ui/components/badge";
import { Button } from "@leonwillow-electron/ui/components/button";
import { ConfirmDialog } from "@leonwillow-electron/ui/components/confirm-dialog";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@leonwillow-electron/ui/components/dialog";
import {
	Field,
	FieldGroup,
	FieldLabel,
} from "@leonwillow-electron/ui/components/field";
import { Input } from "@leonwillow-electron/ui/components/input";
import {
	RadioGroup,
	RadioGroupSegmentedItem,
} from "@leonwillow-electron/ui/components/radio-group";
import { ScrollArea } from "@leonwillow-electron/ui/components/scroll-area";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
} from "@leonwillow-electron/ui/components/select";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@leonwillow-electron/ui/components/tabs";
import { Textarea } from "@leonwillow-electron/ui/components/textarea";
import { copyText } from "@leonwillow-electron/ui/lib/clipboard";
import {
	CopyIcon,
	FileInputIcon,
	MoonIcon,
	RotateCcwIcon,
	SaveIcon,
	SunIcon,
	Trash2Icon,
} from "lucide-react";
import { useTheme } from "next-themes";
import {
	type RefObject,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import { toast } from "sonner";
import {
	CURATED_FONTS,
	FONT_CONFIG,
	FONT_GROUPS,
	type FontKey,
} from "@/configs/fonts";
import { RADIUS_VALUES } from "@/configs/theme-settings";
import { isCustomThemeId } from "@/lib/custom-themes";
import { useThemeStore } from "@/stores/theme-store";
import type {
	CustomThemeId,
	Radius,
	Settings,
	ThemeStyleProps,
} from "@/types/theme";
import type { ColorFormat } from "@/utils/theme/color-converter";
import { importThemeCss } from "@/utils/theme/css-import";
import { createThemeDraft } from "@/utils/theme/theme-draft";
import { generateThemeCode } from "@/utils/theme/theme-style-generator";
import CssImportDialog from "./css-import-dialog";
import ShadowControl from "./shadow-control";
import SliderWithInput from "./slider-with-input";
import ThemeColorPanel from "./theme-color-panel";
import ThemePresetSelect from "./theme-preset-select";

export default function ThemeControlPanel({
	onClose,
	requestCloseRef,
}: {
	onClose: () => void;
	requestCloseRef?: RefObject<(() => void) | null>;
}) {
	const settings = useThemeStore((state) => state.preferences.settings);
	const customThemes = useThemeStore((state) => state.preferences.customThemes);
	const setThemePreview = useThemeStore((state) => state.setThemePreview);
	const saveTheme = useThemeStore((state) => state.saveTheme);
	const deleteTheme = useThemeStore((state) => state.deleteTheme);
	const { resolvedTheme } = useTheme();
	const [sourcePreset, setSourcePreset] = useState(settings.themePreset);
	const [draft, setDraft] = useState(() =>
		createThemeDraft({ settings, customThemes }),
	);
	const [initialDraft, setInitialDraft] = useState(draft);
	const [mode, setMode] = useState<"light" | "dark">(
		resolvedTheme === "dark" ? "dark" : "light",
	);
	const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());
	const [importOpen, setImportOpen] = useState(false);
	const [exportOpen, setExportOpen] = useState(false);
	const [deleteId, setDeleteId] = useState<CustomThemeId | null>(null);
	const [discardOpen, setDiscardOpen] = useState(false);
	// 导入或还原时重建字段局部输入，避免无效文本覆盖新的草稿。
	const [inputRevision, setInputRevision] = useState(0);
	const [format, setFormat] = useState<ColorFormat>("oklch");
	const currentStyles = draft.styles[mode];
	const savedTheme = isCustomThemeId(sourcePreset)
		? customThemes.find(
				(theme) => !theme.deletedAt && theme.id === sourcePreset,
			)
		: undefined;
	const editingSaved = !!savedTheme;
	const initialDraftJson = useMemo(
		() => JSON.stringify(initialDraft),
		[initialDraft],
	);
	const isDirty = useMemo(
		() => draft !== initialDraft && JSON.stringify(draft) !== initialDraftJson,
		[draft, initialDraft, initialDraftJson],
	);
	const visibleFonts: FontKey[] = CURATED_FONTS.includes(draft.font)
		? [...CURATED_FONTS]
		: [draft.font, ...CURATED_FONTS];
	const valid = !invalidFields.size && draft.label.trim().length > 0;

	const requestClose = () => {
		if (discardOpen) return;
		if (!isDirty) {
			onClose();
			return;
		}
		setDiscardOpen(true);
	};

	useEffect(() => {
		if (!requestCloseRef) return;
		requestCloseRef.current = requestClose;
		return () => {
			requestCloseRef.current = null;
		};
	});

	// 拖动调色盘与滑块时按渲染帧合并实时预览，避免单帧内反复重算主题变量。
	useEffect(() => {
		const frame = requestAnimationFrame(() => {
			setThemePreview({ draft, mode });
		});
		return () => cancelAnimationFrame(frame);
	}, [draft, mode, setThemePreview]);
	useEffect(() => () => setThemePreview(null), [setThemePreview]);

	const onValidityChange = useCallback(
		(key: string, nextValid: boolean) => {
			setInvalidFields((previous) => {
				const fieldKey = `${mode}:${key}`;
				const has = previous.has(fieldKey);
				if (nextValid ? !has : has) return previous;
				const next = new Set(previous);
				if (nextValid) next.delete(fieldKey);
				else next.add(fieldKey);
				return next;
			});
		},
		[mode],
	);

	const updateStyle = useCallback(
		(key: keyof ThemeStyleProps, value: string) => {
			setDraft((previous) => {
				const nextModeStyles = { ...previous.styles[mode], [key]: value };
				// 修改主色或危险色时移除预设专属派生色，避免自定义后仍残留原预设悬停或实心前景色。
				if (key === "primary") delete nextModeStyles["primary-hover"];
				if (key === "destructive")
					delete nextModeStyles["destructive-solid-foreground"];
				return {
					...previous,
					styles: {
						...previous.styles,
						[mode]: nextModeStyles,
					},
				};
			});
		},
		[mode],
	);

	const selectSource = (themePreset: Settings["themePreset"]) => {
		const saved = customThemes.find(
			(theme) => !theme.deletedAt && theme.id === themePreset,
		);
		const next = createThemeDraft({
			customThemes,
			settings: {
				...settings,
				themePreset,
				...(saved ? { font: saved.font, radius: saved.radius } : {}),
			},
		});
		setSourcePreset(themePreset);
		setDraft(next);
		setInitialDraft(next);
		setInvalidFields(new Set());
		setInputRevision((value) => value + 1);
	};

	const handleSave = (saveCopy = false) => {
		try {
			saveTheme(
				draft,
				!saveCopy && editingSaved ? (sourcePreset as CustomThemeId) : undefined,
			);
			toast.success(`主题“${draft.label.trim()}”已保存并应用。`);
			onClose();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "主题保存失败。");
		}
	};

	const exportCss = exportOpen
		? generateThemeCode(
				{
					light: {
						...draft.styles.light,
						radius: RADIUS_VALUES[draft.radius],
						"font-sans": `var(${FONT_CONFIG[draft.font].variable})`,
					},
					dark: draft.styles.dark,
				},
				format,
			)
		: "";

	return (
		<>
			<ScrollArea className="min-h-0 flex-1" contentClassName="p-4">
				<div className="flex flex-col gap-5">
					<div className="flex flex-wrap gap-2">
						<Button
							size="lg"
							variant="outline"
							onClick={() => setImportOpen(true)}
						>
							<FileInputIcon data-icon="inline-start" />
							导入 CSS
						</Button>
						<Button
							size="lg"
							variant="outline"
							onClick={() => setExportOpen(true)}
							disabled={!valid}
						>
							<CopyIcon data-icon="inline-start" />
							导出 CSS
						</Button>
						<Button
							size="lg"
							variant="outline"
							onClick={() => {
								setDraft(initialDraft);
								setInvalidFields(new Set());
								setInputRevision((value) => value + 1);
							}}
						>
							<RotateCcwIcon data-icon="inline-start" />
							还原编辑
						</Button>
					</div>
					<FieldGroup className="gap-4">
						<Field>
							<FieldLabel htmlFor="editor-source-preset">
								以此主题为基础
							</FieldLabel>
							<ThemePresetSelect
								id="editor-source-preset"
								size="lg"
								value={sourcePreset}
								mode={mode}
								onValueChange={selectSource}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="custom-theme-name">主题名称</FieldLabel>
							<Input
								id="custom-theme-name"
								size="lg"
								value={draft.label}
								maxLength={40}
								onChange={(event) =>
									setDraft((previous) => ({
										...previous,
										label: event.target.value,
									}))
								}
								placeholder="给主题起一个名字"
							/>
						</Field>
					</FieldGroup>
					<RadioGroup
						aria-label="编辑颜色模式"
						variant="segmented"
						size="lg"
						className="grid-cols-2"
						value={mode}
						onValueChange={(value) => {
							setMode(value as "light" | "dark");
							setInvalidFields(new Set());
						}}
					>
						{[
							{ value: "light", label: "编辑浅色", icon: SunIcon },
							{ value: "dark", label: "编辑深色", icon: MoonIcon },
						].map(({ value, label, icon: Icon }) => (
							<RadioGroupSegmentedItem
								key={value}
								value={value}
								className="gap-2"
							>
								<Icon aria-hidden="true" />
								{label}
							</RadioGroupSegmentedItem>
						))}
					</RadioGroup>
					<Tabs defaultValue="colors">
						<TabsList className="grid w-full grid-cols-3">
							<TabsTrigger value="colors">颜色</TabsTrigger>
							<TabsTrigger value="typography">字体</TabsTrigger>
							<TabsTrigger value="other">圆角与阴影</TabsTrigger>
						</TabsList>
						<TabsContent value="colors" keepMounted>
							<div className="mb-3 flex items-center justify-between text-caption text-muted-foreground">
								<span>当前编辑作用域</span>
								<Badge variant="outline">
									{mode === "dark" ? "仅深色生效" : "仅浅色生效"}
								</Badge>
							</div>
							<ThemeColorPanel
								key={`${sourcePreset}:${mode}:${inputRevision}`}
								currentTheme={currentStyles}
								updateColor={updateStyle}
								onValidityChange={onValidityChange}
							/>
						</TabsContent>
						<TabsContent value="typography">
							<FieldGroup className="gap-5">
								<Field>
									<div className="flex items-center justify-between gap-2">
										<div className="flex items-center gap-1.5">
											<FieldLabel htmlFor="editor-font">界面字体</FieldLabel>
											<Badge variant="secondary">浅深色共用</Badge>
										</div>
										<span className="text-caption text-muted-foreground">
											主要影响英文与数字
										</span>
									</div>
									<Select
										id="editor-font"
										items={Object.entries(FONT_CONFIG).map(
											([value, config]) => ({ value, label: config.label }),
										)}
										value={draft.font}
										onValueChange={(value) => {
											if (value)
												setDraft((previous) => ({
													...previous,
													font: value as FontKey,
												}));
										}}
									>
										<SelectTrigger size="lg" className="w-full">
											<span
												className="flex-1 text-left"
												style={{
													fontFamily: `var(${FONT_CONFIG[draft.font].variable})`,
												}}
											>
												{FONT_CONFIG[draft.font].label}
											</span>
										</SelectTrigger>
										<SelectContent>
											{FONT_GROUPS.map((group) => {
												const fonts = visibleFonts
													.map((key) => [key, FONT_CONFIG[key]] as const)
													.filter(([, config]) => config.group === group.key);
												if (fonts.length === 0) return null;
												return (
													<SelectGroup key={group.key}>
														<SelectLabel>{group.label}</SelectLabel>
														{fonts.map(([key, config]) => (
															<SelectItem key={key} value={key}>
																<span
																	style={{
																		fontFamily: `var(${config.variable})`,
																	}}
																>
																	{config.label}
																</span>
															</SelectItem>
														))}
													</SelectGroup>
												);
											})}
										</SelectContent>
									</Select>
								</Field>
								<SliderWithInput
									label="字间距"
									labelBadge={<Badge variant="secondary">浅深色共用</Badge>}
									unit="em"
									min={-0.25}
									max={0.25}
									step={0.025}
									value={Number.parseFloat(
										currentStyles["letter-spacing"] ?? "0",
									)}
									onChange={(value) =>
										setDraft((previous) => ({
											...previous,
											styles: {
												light: {
													...previous.styles.light,
													"letter-spacing": `${value}em`,
												},
												dark: {
													...previous.styles.dark,
													"letter-spacing": `${value}em`,
												},
											},
										}))
									}
								/>
							</FieldGroup>
						</TabsContent>
						<TabsContent value="other" keepMounted>
							<div className="flex flex-col gap-5">
								<Field>
									<div className="flex items-center gap-1.5">
										<FieldLabel htmlFor="editor-radius">圆角</FieldLabel>
										<Badge variant="secondary">浅深色共用</Badge>
									</div>
									<Select
										id="editor-radius"
										items={[
											{ value: "none", label: "无" },
											{ value: "sm", label: "小" },
											{ value: "md", label: "中" },
											{ value: "lg", label: "大" },
										]}
										value={draft.radius}
										onValueChange={(value) => {
											if (value)
												setDraft((previous) => ({
													...previous,
													radius: value as Radius,
												}));
										}}
									>
										<SelectTrigger size="lg" className="w-full">
											<span className="flex-1 text-left">
												{
													{ none: "无", sm: "小", md: "中", lg: "大" }[
														draft.radius
													]
												}{" "}
												· {RADIUS_VALUES[draft.radius]}
											</span>
										</SelectTrigger>
										<SelectContent>
											<SelectGroup>
												{(
													[
														{ value: "none", label: "无" },
														{ value: "sm", label: "小" },
														{ value: "md", label: "中" },
														{ value: "lg", label: "大" },
													] as const
												).map((item) => (
													<SelectItem key={item.value} value={item.value}>
														{item.label} · {RADIUS_VALUES[item.value]}
													</SelectItem>
												))}
											</SelectGroup>
										</SelectContent>
									</Select>
								</Field>
								<div className="flex items-center justify-between text-caption text-muted-foreground">
									<span>阴影作用域</span>
									<Badge variant="outline">
										{mode === "dark" ? "仅深色生效" : "仅浅色生效"}
									</Badge>
								</div>
								<ShadowControl
									key={`${sourcePreset}:${mode}:${inputRevision}`}
									shadowColor={currentStyles["shadow-color"] ?? "#000000"}
									shadowOpacity={Number.parseFloat(
										currentStyles["shadow-opacity"] ?? "0.1",
									)}
									shadowBlur={Number.parseFloat(
										currentStyles["shadow-blur"] ?? "3",
									)}
									shadowSpread={Number.parseFloat(
										currentStyles["shadow-spread"] ?? "0",
									)}
									shadowOffsetX={Number.parseFloat(
										currentStyles["shadow-offset-x"] ?? "0",
									)}
									shadowOffsetY={Number.parseFloat(
										currentStyles["shadow-offset-y"] ?? "1",
									)}
									onChange={(key, value) =>
										updateStyle(
											key as keyof ThemeStyleProps,
											key === "shadow-color"
												? String(value)
												: key === "shadow-opacity"
													? String(value)
													: `${value}px`,
										)
									}
									onValidityChange={onValidityChange}
								/>
							</div>
						</TabsContent>
					</Tabs>
				</div>
			</ScrollArea>
			<div className="flex shrink-0 flex-col gap-2 border-t p-4">
				{invalidFields.size > 0 && (
					<p className="text-destructive-foreground text-xs" role="status">
						请先修正无效的颜色值。
					</p>
				)}
				<div className="flex flex-wrap gap-2">
					{editingSaved && (
						<Button
							size="lg"
							variant="destructive-outline"
							onClick={() => setDeleteId(sourcePreset as CustomThemeId)}
						>
							<Trash2Icon data-icon="inline-start" />
							删除
						</Button>
					)}
					<Button size="lg" variant="outline" onClick={requestClose}>
						取消
					</Button>
					{editingSaved && (
						<Button
							size="lg"
							variant="outline"
							onClick={() => handleSave(true)}
							disabled={!valid}
						>
							另存为
						</Button>
					)}
					<Button
						size="lg"
						className="flex-1"
						onClick={() => handleSave()}
						disabled={!valid}
					>
						<SaveIcon data-icon="inline-start" />
						{editingSaved ? "保存修改" : "保存主题"}
					</Button>
				</div>
			</div>
			<CssImportDialog
				open={importOpen}
				onOpenChange={setImportOpen}
				onImport={(css) => {
					setDraft(importThemeCss(css, draft));
					setInvalidFields(new Set());
					setInputRevision((value) => value + 1);
				}}
			/>
			<Dialog open={exportOpen} onOpenChange={setExportOpen}>
				<DialogContent
					scrollable
					className="max-h-[90dvh] sm:max-w-xl"
					scrollContentClassName=""
				>
					<DialogHeader>
						<DialogTitle>导出 CSS 主题</DialogTitle>
					</DialogHeader>
					<Select
						items={["oklch", "hex", "hsl", "rgb"].map((value) => ({
							value,
							label: value.toUpperCase(),
						}))}
						value={format}
						onValueChange={(value) => {
							if (value) setFormat(value as ColorFormat);
						}}
					>
						<SelectTrigger
							size="lg"
							className="w-full"
							aria-label="导出颜色格式"
						>
							{format.toUpperCase()}
						</SelectTrigger>
						<SelectContent>
							<SelectGroup>
								{["oklch", "hex", "hsl", "rgb"].map((value) => (
									<SelectItem key={value} value={value}>
										{value.toUpperCase()}
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>
					<Field>
						<FieldLabel htmlFor="theme-export-css">CSS 主题变量</FieldLabel>
						<Textarea
							id="theme-export-css"
							readOnly
							value={exportCss}
							className="min-h-48 font-mono"
						/>
					</Field>
					<DialogFooter>
						<Button
							size="lg"
							onClick={async () => {
								try {
									await copyText(exportCss);
									toast.success("主题 CSS 已复制。");
								} catch {
									toast.error("复制失败，请选择文本手动复制。");
								}
							}}
						>
							<CopyIcon data-icon="inline-start" />
							复制 CSS
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			<ConfirmDialog
				open={deleteId !== null}
				title="删除主题"
				confirmLabel="删除主题"
				buttonSize="lg"
				showCloseButton
				onClose={() => setDeleteId(null)}
				onConfirm={() => {
					if (!deleteId) return;
					try {
						deleteTheme(deleteId);
						setDeleteId(null);
						selectSource("default");
						toast.success("主题已删除。");
					} catch (error) {
						toast.error(error instanceof Error ? error.message : "删除失败。");
					}
				}}
			>
				删除“{savedTheme?.label ?? draft.label}
				”？此操作会从当前浏览器的主题库中移除它。
			</ConfirmDialog>
			<ConfirmDialog
				open={discardOpen}
				title="放弃未保存的主题修改？"
				cancelLabel="继续编辑"
				confirmLabel="放弃并关闭"
				confirmVariant="warning-solid"
				buttonSize="lg"
				showCloseButton
				onClose={() => setDiscardOpen(false)}
				onConfirm={() => {
					setDiscardOpen(false);
					onClose();
				}}
			>
				当前主题草稿包含未保存修改，关闭后预览将还原为已保存的主题外观。
			</ConfirmDialog>
		</>
	);
}
