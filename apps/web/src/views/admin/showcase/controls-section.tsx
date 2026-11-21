/**
 * @file 演示页的按钮、徽章、输入框与表单选择控件展示分区。
 * 创建时间：2026-11-21
 * 修改时间：2026-11-21
 * 版本作用：集中呈现全部按钮/徽章变体与尺寸、输入校验、选择器及日期时间色盘控件。
 * 被调用：views/admin/showcase/index.tsx。
 * 调用：packages/ui 全部基础表单与操作组件、lucide-react。
 * 功能：所有控件均为真实可交互状态，便于核查悬停、聚焦、选中与禁用态样式。
 * 预期结果：严格遵守共享控件尺寸和排版规范，不覆盖基础组件高度与字号。
 */
import { Badge } from "@leonwillow-electron/ui/components/badge";
import { Button } from "@leonwillow-electron/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@leonwillow-electron/ui/components/card";
import { Checkbox } from "@leonwillow-electron/ui/components/checkbox";
import {
	ColorPicker,
	ColorPickerArea,
	ColorPickerContent,
	ColorPickerEyeDropper,
	ColorPickerFields,
	ColorPickerPanel,
	ColorPickerSlider,
	ColorPickerTrigger,
} from "@leonwillow-electron/ui/components/color-picker";
import { CopyText } from "@leonwillow-electron/ui/components/copy-text";
import { DatePicker } from "@leonwillow-electron/ui/components/date-picker";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from "@leonwillow-electron/ui/components/field";
import { HelpTip } from "@leonwillow-electron/ui/components/help-tip";
import { Input } from "@leonwillow-electron/ui/components/input";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from "@leonwillow-electron/ui/components/input-group";
import { Label } from "@leonwillow-electron/ui/components/label";
import {
	RadioGroup,
	RadioGroupItem,
	RadioGroupSegmentedItem,
	RadioGroupTileItem,
} from "@leonwillow-electron/ui/components/radio-group";
import { SearchInput } from "@leonwillow-electron/ui/components/search-input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
} from "@leonwillow-electron/ui/components/select";
import { Slider } from "@leonwillow-electron/ui/components/slider";
import { Textarea } from "@leonwillow-electron/ui/components/textarea";
import { TimePicker } from "@leonwillow-electron/ui/components/time-picker";
import { TooltipIconButton } from "@leonwillow-electron/ui/components/tooltip-icon-button";
import {
	AlertTriangleIcon,
	CheckCircle2Icon,
	DownloadIcon,
	InfoIcon,
	LockIcon,
	MailIcon,
	PlusIcon,
	RefreshCwIcon,
	SearchIcon,
	SparklesIcon,
	Trash2Icon,
	XCircleIcon,
} from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

const BUTTON_VARIANTS = [
	{ variant: "default", label: "主按钮 default" },
	{ variant: "secondary", label: "次按钮 secondary" },
	{ variant: "outline", label: "描边 outline" },
	{ variant: "ghost", label: "幽灵 ghost" },
	{ variant: "link", label: "链接 link" },
	{ variant: "info", label: "信息 info" },
	{ variant: "success", label: "成功 success" },
	{ variant: "warning", label: "警告 warning" },
	{ variant: "warning-solid", label: "实心警告 warning-solid" },
	{ variant: "destructive", label: "危险 destructive" },
	{ variant: "destructive-outline", label: "危险描边 destructive-outline" },
	{ variant: "destructive-solid", label: "实心危险 destructive-solid" },
] as const;

const BADGE_VARIANTS = [
	{ variant: "default", label: "默认 default", icon: SparklesIcon },
	{ variant: "secondary", label: "次要 secondary", icon: null },
	{ variant: "outline", label: "描边 outline", icon: null },
	{ variant: "ghost", label: "幽灵 ghost", icon: null },
	{ variant: "link", label: "链接 link", icon: null },
	{ variant: "info", label: "进行中 info", icon: InfoIcon },
	{ variant: "success", label: "已完成 success", icon: CheckCircle2Icon },
	{ variant: "warning", label: "待核对 warning", icon: AlertTriangleIcon },
	{ variant: "destructive", label: "已停用 destructive", icon: XCircleIcon },
] as const;

const SELECT_OPTIONS = [
	{ value: "funds", label: "资金分析" },
	{ value: "documents", label: "文书取号" },
	{ value: "inquiries", label: "笔录整理" },
	{ value: "vat", label: "增值税计算器" },
	{ value: "late-fees", label: "滞纳金计算器" },
] as const;

export default function ControlsSection() {
	const id = useId();
	const [searchQuery, setSearchQuery] = useState("");
	const [groupValue, setGroupValue] = useState("case-2026-001");
	const [selectedModule, setSelectedModule] = useState<string>("funds");
	const [checkedA, setCheckedA] = useState(true);
	const [checkedB, setCheckedB] = useState(false);
	const [radioDefault, setRadioDefault] = useState("standard");
	const [radioTabs, setRadioTabs] = useState("all");
	const [radioSegmented, setRadioSegmented] = useState("md");
	const [radioGrid, setRadioGrid] = useState("attached");
	const [sliderValue, setSliderValue] = useState(65);
	const [dateValue, setDateValue] = useState("2026-11-21");
	const [timeValue, setTimeValue] = useState<string | null>("09:30");
	const [colorValue, setColorValue] = useState("#7367F0");

	const selectedLabel =
		SELECT_OPTIONS.find((item) => item.value === selectedModule)?.label ??
		"请选择模块";

	return (
		<section aria-labelledby="showcase-controls-heading" className="space-y-4">
			<div>
				<h2
					id="showcase-controls-heading"
					className="font-semibold text-foreground text-lg"
				>
					按钮、徽章与表单控件
				</h2>
				<p className="text-muted-foreground text-xs">
					可直接在下方悬停、点击、输入或展开下拉菜单，检验各控件的常态、悬停、聚焦、选中与禁用表现。
				</p>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>按钮（Button）全部 12 种变体与尺寸</CardTitle>
					<CardDescription>
						包含主色悬停态、语义状态按钮、纯图标按钮（TooltipIconButton）与带禁用原因提示的禁用按钮。
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="flex flex-wrap items-center gap-2">
						{BUTTON_VARIANTS.map((item) => (
							<Button key={item.variant} type="button" variant={item.variant}>
								{item.variant === "default" ? (
									<PlusIcon aria-hidden="true" />
								) : item.variant === "destructive-solid" ? (
									<Trash2Icon aria-hidden="true" />
								) : null}
								{item.label}
							</Button>
						))}
					</div>
					<div className="flex flex-wrap items-center gap-2 border-t pt-3">
						<span className="mr-1 text-muted-foreground text-xs">尺寸：</span>
						<Button type="button" size="xs">
							极小 xs
						</Button>
						<Button type="button" size="sm">
							小型 sm
						</Button>
						<Button type="button" size="default">
							标准 default
						</Button>
						<Button type="button" size="lg">
							大型 lg
						</Button>
						<TooltipIconButton
							label="极小图标按钮"
							size="icon-xs"
							variant="outline"
						>
							<PlusIcon aria-hidden="true" />
						</TooltipIconButton>
						<TooltipIconButton
							label="小型图标按钮"
							size="icon-sm"
							variant="outline"
						>
							<RefreshCwIcon aria-hidden="true" />
						</TooltipIconButton>
						<TooltipIconButton
							label="标准图标按钮"
							size="icon"
							variant="outline"
						>
							<DownloadIcon aria-hidden="true" />
						</TooltipIconButton>
						<TooltipIconButton
							label="大型图标按钮"
							size="icon-lg"
							variant="outline"
						>
							<SearchIcon aria-hidden="true" />
						</TooltipIconButton>
						<Button
							type="button"
							variant="outline"
							disabled
							disabledReason="悬停或键盘聚焦时展示禁用原因，点击不会触发提交"
						>
							<LockIcon aria-hidden="true" />
							禁用（带原因提示）
						</Button>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>徽章（Badge）与内联微件</CardTitle>
					<CardDescription>
						涵盖全部 9 种徽章变体，以及正文中常用的 CopyText 与 HelpTip。
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					<div className="flex flex-wrap items-center gap-2">
						{BADGE_VARIANTS.map((item) => (
							<Badge key={item.variant} variant={item.variant}>
								{item.icon ? <item.icon aria-hidden="true" /> : null}
								{item.label}
							</Badge>
						))}
					</div>
					<div className="flex flex-wrap items-center gap-4 border-t pt-3 text-xs">
						<div className="flex items-center gap-1.5">
							<span className="text-muted-foreground">
								点击复制（CopyText）：
							</span>
							<CopyText value="6222-0202-0001-8842-910" className="font-mono" />
						</div>
						<div className="flex items-center gap-1">
							<span className="text-muted-foreground">
								悬浮说明（HelpTip）：
							</span>
							<HelpTip
								label="查看口径说明"
								content="用于收拢业务口径与补充解释，保持页面标题区域清爽紧凑。"
							/>
						</div>
					</div>
				</CardContent>
			</Card>

			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>输入框、搜索框与文本域</CardTitle>
						<CardDescription>
							包含标准/小/大三种控件高度、禁用态、校验错误态及 InputGroup
							组合装饰。
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3">
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
							<Field>
								<FieldLabel htmlFor={`${id}-in-sm`}>小型 sm</FieldLabel>
								<Input id={`${id}-in-sm`} size="sm" placeholder="小型输入" />
							</Field>
							<Field>
								<FieldLabel htmlFor={`${id}-in-md`}>标准 default</FieldLabel>
								<Input id={`${id}-in-md`} placeholder="标准输入" />
							</Field>
							<Field>
								<FieldLabel htmlFor={`${id}-in-lg`}>大型 lg</FieldLabel>
								<Input id={`${id}-in-lg`} size="lg" placeholder="大型输入" />
							</Field>
						</div>
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
							<Field>
								<FieldLabel htmlFor={`${id}-search`}>
									搜索输入（SearchInput）
								</FieldLabel>
								<SearchInput
									id={`${id}-search`}
									aria-label="搜索演示关键词"
									placeholder="输入关键词体验一键清空"
									value={searchQuery}
									onValueChange={setSearchQuery}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor={`${id}-group`}>
									组合输入（InputGroup）
								</FieldLabel>
								<InputGroup>
									<InputGroupAddon align="inline-start">
										<MailIcon aria-hidden="true" />
									</InputGroupAddon>
									<InputGroupInput
										id={`${id}-group`}
										value={groupValue}
										onChange={(e) => setGroupValue(e.target.value)}
									/>
									<InputGroupAddon align="inline-end">
										<InputGroupButton
											type="button"
											onClick={() => toast.info(`当前编号：${groupValue}`)}
										>
											校验
										</InputGroupButton>
									</InputGroupAddon>
								</InputGroup>
							</Field>
						</div>
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
							<Field>
								<FieldLabel htmlFor={`${id}-invalid`}>校验失败态</FieldLabel>
								<Input
									id={`${id}-invalid`}
									aria-invalid
									defaultValue="错误的账号格式"
								/>
								<FieldError>
									请输入合法的账号或 18 位统一社会信用代码。
								</FieldError>
							</Field>
							<Field>
								<FieldLabel htmlFor={`${id}-disabled`}>禁用输入</FieldLabel>
								<Input
									id={`${id}-disabled`}
									disabled
									defaultValue="只读归档记录，不可编辑"
								/>
								<FieldDescription>
									使用 FieldDescription 提供辅助说明。
								</FieldDescription>
							</Field>
						</div>
						<Field>
							<FieldLabel htmlFor={`${id}-textarea`}>
								多行文本（Textarea）
							</FieldLabel>
							<Textarea
								id={`${id}-textarea`}
								rows={2}
								placeholder="支持多行备注录入，自动应用统一边框、焦点环与占位色……"
							/>
						</Field>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>选择器、勾选、单选组与滑块</CardTitle>
						<CardDescription>
							下拉列表可重点验证选中项（accent）与悬停项（muted）的视觉区分。
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
							<Field>
								<FieldLabel htmlFor={`${id}-select`}>
									分组下拉（Select）
								</FieldLabel>
								<Select
									value={selectedModule}
									onValueChange={(val) => {
										if (val) setSelectedModule(val);
									}}
								>
									<SelectTrigger id={`${id}-select`} className="w-full">
										<SelectValue>{selectedLabel}</SelectValue>
									</SelectTrigger>
									<SelectContent>
										<SelectGroup>
											<SelectLabel>业务模块</SelectLabel>
											<SelectItem value="funds">资金分析</SelectItem>
											<SelectItem value="documents">文书取号</SelectItem>
											<SelectItem value="inquiries">笔录整理</SelectItem>
										</SelectGroup>
										<SelectSeparator />
										<SelectGroup>
											<SelectLabel>专项测算</SelectLabel>
											<SelectItem value="vat">增值税计算器</SelectItem>
											<SelectItem value="late-fees">滞纳金计算器</SelectItem>
										</SelectGroup>
									</SelectContent>
								</Select>
							</Field>

							<Field>
								<FieldLabel>复选框（Checkbox）</FieldLabel>
								<div className="flex flex-wrap items-center gap-4 pt-1">
									<Label htmlFor={`${id}-cb-a`} className="cursor-pointer">
										<Checkbox
											id={`${id}-cb-a`}
											checked={checkedA}
											onCheckedChange={(v) => setCheckedA(Boolean(v))}
										/>
										已勾选
									</Label>
									<Label htmlFor={`${id}-cb-b`} className="cursor-pointer">
										<Checkbox
											id={`${id}-cb-b`}
											checked={checkedB}
											onCheckedChange={(v) => setCheckedB(Boolean(v))}
										/>
										未勾选
									</Label>
									<Label htmlFor={`${id}-cb-c`} className="opacity-60">
										<Checkbox id={`${id}-cb-c`} checked disabled />
										禁用
									</Label>
								</div>
							</Field>
						</div>

						<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
							<div className="space-y-1.5">
								<span className="font-medium text-xs">单选（default）</span>
								<RadioGroup
									value={radioDefault}
									onValueChange={(v) => setRadioDefault(String(v))}
									className="flex flex-wrap items-center gap-4"
								>
									<Label htmlFor={`${id}-r1`} className="cursor-pointer">
										<RadioGroupItem id={`${id}-r1`} value="standard" />
										标准模式
									</Label>
									<Label htmlFor={`${id}-r2`} className="cursor-pointer">
										<RadioGroupItem id={`${id}-r2`} value="compact" />
										紧凑模式
									</Label>
								</RadioGroup>
							</div>

							<div className="space-y-1.5">
								<span className="font-medium text-xs">选项卡单选（tabs）</span>
								<RadioGroup
									variant="tabs"
									value={radioTabs}
									onValueChange={(v) => setRadioTabs(String(v))}
								>
									{[
										{ value: "all", label: "全部" },
										{ value: "active", label: "生效中" },
										{ value: "archived", label: "已归档" },
									].map((opt) => (
										<Label key={opt.value} htmlFor={`${id}-rt-${opt.value}`}>
											<RadioGroupItem
												id={`${id}-rt-${opt.value}`}
												value={opt.value}
												className="sr-only"
											/>
											{opt.label}
										</Label>
									))}
								</RadioGroup>
							</div>
						</div>

						<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
							<div className="space-y-1.5">
								<span className="font-medium text-xs">
									分段单选（segmented）
								</span>
								<RadioGroup
									variant="segmented"
									className="grid-cols-3"
									value={radioSegmented}
									onValueChange={(v) => setRadioSegmented(String(v))}
								>
									<RadioGroupSegmentedItem id={`${id}-seg-sm`} value="sm">
										小
									</RadioGroupSegmentedItem>
									<RadioGroupSegmentedItem id={`${id}-seg-md`} value="md">
										中
									</RadioGroupSegmentedItem>
									<RadioGroupSegmentedItem id={`${id}-seg-lg`} value="lg">
										大
									</RadioGroupSegmentedItem>
								</RadioGroup>
							</div>

							<div className="space-y-1.5">
								<span className="font-medium text-xs">网格单选（grid）</span>
								<RadioGroup
									variant="grid"
									className="grid-cols-2"
									value={radioGrid}
									onValueChange={(v) => setRadioGrid(String(v))}
								>
									<RadioGroupTileItem id={`${id}-grid-a`} value="attached">
										贴边侧栏
									</RadioGroupTileItem>
									<RadioGroupTileItem id={`${id}-grid-b`} value="floating">
										悬浮卡片
									</RadioGroupTileItem>
								</RadioGroup>
							</div>
						</div>

						<div className="space-y-1.5">
							<div className="flex items-center justify-between text-xs">
								<span className="font-medium">滑块（Slider）</span>
								<span className="font-mono text-muted-foreground tabular-nums">
									{sliderValue}%
								</span>
							</div>
							<Slider
								aria-label="演示滑块数值"
								value={[sliderValue]}
								min={0}
								max={100}
								onValueChange={(next) => {
									const first = Array.isArray(next) ? next[0] : next;
									if (typeof first === "number") setSliderValue(first);
								}}
							/>
						</div>
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>日期、时间与取色器</CardTitle>
					<CardDescription>
						展示工作台统一封装的 DatePicker、TimePicker 与 ReUI ColorPicker
						弹层。
					</CardDescription>
				</CardHeader>
				<CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
					<Field>
						<FieldLabel htmlFor={`${id}-date`}>
							日期选择（DatePicker）
						</FieldLabel>
						<DatePicker
							id={`${id}-date`}
							aria-label="演示日期选择"
							value={dateValue}
							onValueChange={setDateValue}
							clearable
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor={`${id}-time`}>
							时间选择（TimePicker）
						</FieldLabel>
						<TimePicker
							id={`${id}-time`}
							aria-label="演示时间选择"
							value={timeValue}
							onValueChange={setTimeValue}
							minuteStep={5}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor={`${id}-color`}>
							颜色选择（ColorPicker）
						</FieldLabel>
						<ColorPicker
							id={`${id}-color`}
							value={colorValue}
							format="hex"
							onValueChange={(next) => {
								if (next) setColorValue(next);
							}}
						>
							<ColorPickerTrigger className="w-full" />
							<ColorPickerContent>
								<ColorPickerPanel>
									<ColorPickerArea />
									<div className="flex items-center gap-3">
										<ColorPickerEyeDropper />
										<div className="min-w-0 flex-1">
											<ColorPickerSlider channel="hue" />
										</div>
									</div>
									<ColorPickerFields />
								</ColorPickerPanel>
							</ColorPickerContent>
						</ColorPicker>
					</Field>
				</CardContent>
			</Card>
		</section>
	);
}
