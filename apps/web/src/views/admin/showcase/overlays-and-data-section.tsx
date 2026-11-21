/**
 * @file 演示页的数据展示、导航状态、下拉/右键菜单、弹层与通知分区。
 * 创建时间：2026-11-21
 * 修改时间：2026-11-21
 * 版本作用：呈现选项卡、折叠面板、卡片、头像、数据表格、菜单层级、弹窗抽屉及 Sonner 通知。
 * 被调用：views/admin/showcase/index.tsx。
 * 调用：packages/ui 数据展示与浮层组件、sonner、lucide-react。
 * 功能：覆盖业务界面高频出现的复杂复合组件，所有浮层与通知均可直接点击预览。
 * 预期结果：一目了然地检视边框、背景、选中态、悬停态与语义通知在不同主题下的协调度。
 */
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@leonwillow-electron/ui/components/accordion";
import {
	Avatar,
	AvatarBadge,
	AvatarFallback,
	AvatarGroup,
} from "@leonwillow-electron/ui/components/avatar";
import { Badge } from "@leonwillow-electron/ui/components/badge";
import { Button } from "@leonwillow-electron/ui/components/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@leonwillow-electron/ui/components/card";
import { ConfirmDialog } from "@leonwillow-electron/ui/components/confirm-dialog";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuGroup,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
	ContextMenuTrigger,
} from "@leonwillow-electron/ui/components/context-menu";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@leonwillow-electron/ui/components/dialog";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@leonwillow-electron/ui/components/dropdown-menu";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@leonwillow-electron/ui/components/hover-card";
import {
	Popover,
	PopoverContent,
	PopoverDescription,
	PopoverHeader,
	PopoverTitle,
	PopoverTrigger,
} from "@leonwillow-electron/ui/components/popover";
import { Separator } from "@leonwillow-electron/ui/components/separator";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@leonwillow-electron/ui/components/sheet";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@leonwillow-electron/ui/components/table";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@leonwillow-electron/ui/components/tabs";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@leonwillow-electron/ui/components/tooltip";
import { cn } from "@leonwillow-electron/ui/lib/utils";
import {
	BellIcon,
	ChevronDownIcon,
	CopyIcon,
	FileTextIcon,
	FolderKanbanIcon,
	MoreHorizontalIcon,
	MousePointerClickIcon,
	PanelRightOpenIcon,
	PencilIcon,
	ShieldCheckIcon,
	Trash2Icon,
	UsersIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type DemoRecord = {
	id: string;
	name: string;
	owner: string;
	amount: string;
	status: "info" | "success" | "warning" | "destructive";
	statusLabel: string;
};

const DEMO_ROWS: readonly DemoRecord[] = [
	{
		id: "AJ-2026-01",
		name: "华东贸易资金流向核查",
		owner: "林清",
		amount: "¥ 2,480,000.00",
		status: "info",
		statusLabel: "核查中",
	},
	{
		id: "AJ-2026-02",
		name: "星河科技增值税进项复核",
		owner: "陈默",
		amount: "¥ 645,320.50",
		status: "success",
		statusLabel: "已归档",
	},
	{
		id: "AJ-2026-03",
		name: "南港物流异常大额回流",
		owner: "周远",
		amount: "¥ 918,700.00",
		status: "warning",
		statusLabel: "待补证",
	},
	{
		id: "AJ-2026-04",
		name: "旧版模板历史文书作废",
		owner: "管理员",
		amount: "¥ 0.00",
		status: "destructive",
		statusLabel: "已停用",
	},
];

export default function OverlaysAndDataSection() {
	const [selectedRowId, setSelectedRowId] = useState<string>("AJ-2026-01");
	const [menuChecked, setMenuChecked] = useState(true);
	const [menuSort, setMenuSort] = useState("updated");
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [warningConfirmOpen, setWarningConfirmOpen] = useState(false);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [sheetOpen, setSheetOpen] = useState(false);

	return (
		<section aria-labelledby="showcase-overlays-heading" className="space-y-4">
			<div>
				<h2
					id="showcase-overlays-heading"
					className="font-semibold text-foreground text-lg"
				>
					数据展示、导航态、菜单与弹层
				</h2>
				<p className="text-muted-foreground text-xs">
					汇总页面容器、表格、菜单项层次、右键菜单、对话框、侧滑抽屉与全局消息提示。
				</p>
			</div>

			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>选项卡（Tabs）</CardTitle>
						<CardDescription>
							同时展示胶囊底色（default）与底部指示线（line）两种风格。
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<Tabs defaultValue="overview">
							<TabsList>
								<TabsTrigger value="overview">概览</TabsTrigger>
								<TabsTrigger value="members">成员权限</TabsTrigger>
								<TabsTrigger value="audit">操作审计</TabsTrigger>
							</TabsList>
							<TabsContent value="overview" className="rounded-md border p-3">
								默认风格 Tabs：选中项使用背景卡片色并在深色下附带微描边。
							</TabsContent>
							<TabsContent value="members" className="rounded-md border p-3">
								成员权限视图内容，支持键盘左右方向键无缝切换。
							</TabsContent>
							<TabsContent value="audit" className="rounded-md border p-3">
								操作审计记录内容，保留完整焦距与焦点环。
							</TabsContent>
						</Tabs>

						<Separator />

						<Tabs defaultValue="basic">
							<TabsList variant="line">
								<TabsTrigger value="basic">基础信息</TabsTrigger>
								<TabsTrigger value="timeline">流转记录</TabsTrigger>
								<TabsTrigger value="export">导出设置</TabsTrigger>
							</TabsList>
							<TabsContent value="basic" className="pt-2 text-muted-foreground">
								线性风格 Tabs（variant="line"）：底部指示条清晰标示当前分组。
							</TabsContent>
							<TabsContent
								value="timeline"
								className="pt-2 text-muted-foreground"
							>
								流转记录时间线与关键节点状态。
							</TabsContent>
							<TabsContent
								value="export"
								className="pt-2 text-muted-foreground"
							>
								导出格式与附件命名规则。
							</TabsContent>
						</Tabs>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>折叠面板（Accordion）与头像（Avatar）</CardTitle>
						<CardDescription>
							展开时自动柔和着色，头像支持三种尺寸、在线角标与叠放分组。
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<Accordion defaultValue={["item-1"]}>
							<AccordionItem value="item-1">
								<AccordionTrigger>颜色令牌与明暗模式联动说明</AccordionTrigger>
								<AccordionContent>
									页面与共享基础组件全部读取语义变量，切换内置预设（如
									Vuexy、Claude）或编辑自定义色板时无需刷新页面。
								</AccordionContent>
							</AccordionItem>
							<AccordionItem value="item-2">
								<AccordionTrigger>侧栏与二级菜单状态区分</AccordionTrigger>
								<AccordionContent>
									悬停使用柔和的 muted 底色，已选中菜单项采用更高辨识度的 accent
									/ sidebar-accent，避免浅色与深色下状态糊成一片。
								</AccordionContent>
							</AccordionItem>
						</Accordion>

						<div className="flex flex-wrap items-center justify-between gap-4 rounded-md border p-3">
							<div className="flex items-center gap-3">
								<Avatar size="sm">
									<AvatarFallback>林</AvatarFallback>
									<AvatarBadge />
								</Avatar>
								<Avatar size="default">
									<AvatarFallback>陈默</AvatarFallback>
									<AvatarBadge />
								</Avatar>
								<Avatar size="lg">
									<AvatarFallback>管理</AvatarFallback>
									<AvatarBadge />
								</Avatar>
							</div>
							<AvatarGroup>
								<Avatar>
									<AvatarFallback>林</AvatarFallback>
								</Avatar>
								<Avatar>
									<AvatarFallback>陈</AvatarFallback>
								</Avatar>
								<Avatar>
									<AvatarFallback>周</AvatarFallback>
								</Avatar>
								<Avatar>
									<AvatarFallback>+4</AvatarFallback>
								</Avatar>
							</AvatarGroup>
						</div>
					</CardContent>
				</Card>
			</div>

			<div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
				<Card className="lg:col-span-2">
					<CardHeader>
						<CardTitle>数据表格（Table）</CardTitle>
						<CardDescription>
							点击任意行可切换选中状态（data-state="selected"），右侧包含行级下拉操作。
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="overflow-hidden rounded-md border">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>编号</TableHead>
										<TableHead>事项名称</TableHead>
										<TableHead>负责人</TableHead>
										<TableHead>状态</TableHead>
										<TableHead className="text-right">涉及金额</TableHead>
										<TableHead className="w-12 text-right">操作</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{DEMO_ROWS.map((row) => {
										const selected = row.id === selectedRowId;
										return (
											<TableRow
												key={row.id}
												data-state={selected ? "selected" : undefined}
												className="cursor-pointer"
												onClick={() => setSelectedRowId(row.id)}
											>
												<TableCell className="font-mono text-muted-foreground">
													{row.id}
												</TableCell>
												<TableCell className="font-medium text-foreground">
													{row.name}
												</TableCell>
												<TableCell>{row.owner}</TableCell>
												<TableCell>
													<Badge variant={row.status}>{row.statusLabel}</Badge>
												</TableCell>
												<TableCell className="text-right font-mono tabular-nums">
													{row.amount}
												</TableCell>
												<TableCell
													className="text-right"
													onClick={(e) => e.stopPropagation()}
												>
													<DropdownMenu>
														<DropdownMenuTrigger
															render={
																<Button
																	type="button"
																	variant="ghost"
																	size="icon-xs"
																	aria-label={`操作 ${row.name}`}
																/>
															}
														>
															<MoreHorizontalIcon aria-hidden="true" />
														</DropdownMenuTrigger>
														<DropdownMenuContent align="end">
															<DropdownMenuItem
																onClick={() =>
																	toast.info(`已选择查看：${row.name}`)
																}
															>
																<PencilIcon aria-hidden="true" />
																编辑记录
															</DropdownMenuItem>
															<DropdownMenuItem
																onClick={() =>
																	toast.success(`已复制编号 ${row.id}`)
																}
															>
																<CopyIcon aria-hidden="true" />
																复制编号
															</DropdownMenuItem>
															<DropdownMenuSeparator />
															<DropdownMenuItem
																variant="destructive"
																onClick={() => setConfirmOpen(true)}
															>
																<Trash2Icon aria-hidden="true" />
																删除记录
															</DropdownMenuItem>
														</DropdownMenuContent>
													</DropdownMenu>
												</TableCell>
											</TableRow>
										);
									})}
								</TableBody>
							</Table>
						</div>
					</CardContent>
				</Card>

				<Card size="sm">
					<CardHeader className="border-b">
						<CardTitle>紧凑卡片与侧栏条目态</CardTitle>
						<CardDescription>
							使用 Card size="sm" 与模拟二级菜单列表验证侧栏配色。
						</CardDescription>
						<CardAction>
							<Badge variant="info">size="sm"</Badge>
						</CardAction>
					</CardHeader>
					<CardContent className="space-y-3">
						<div className="rounded-lg border bg-sidebar p-2 text-sidebar-foreground">
							<p className="px-2 pb-1.5 font-medium text-caption text-muted-foreground">
								侧栏容器（bg-sidebar）
							</p>
							<div className="flex flex-col gap-1">
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="w-full justify-start"
								>
									<FolderKanbanIcon aria-hidden="true" />
									常态列表项（悬停见 muted）
								</Button>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									aria-current="page"
									className="w-full justify-start bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
								>
									<UsersIcon aria-hidden="true" />
									当前选中项（sidebar-accent）
								</Button>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									aria-current="location"
									className="workspace-nav-item w-full justify-start"
								>
									<ShieldCheckIcon aria-hidden="true" />
									主导航激活态（workspace-nav-item）
								</Button>
							</div>
						</div>
					</CardContent>
					<CardFooter className="justify-between border-t">
						<span className="text-caption text-muted-foreground">
							卡片页脚分隔线
						</span>
						<Button
							type="button"
							size="xs"
							variant="outline"
							onClick={() => toast.info("已触发卡片页脚操作")}
						>
							示例操作
						</Button>
					</CardFooter>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>浮层、菜单、对话框与消息通知（Sonner）</CardTitle>
					<CardDescription>
						点击按钮或右键指定区域，实时检查浮层背景、边框、阴影、勾选态与危险项色彩。
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="flex flex-wrap items-center gap-2">
						<Tooltip>
							<TooltipTrigger
								render={
									<Button type="button" variant="outline">
										悬停提示 Tooltip
									</Button>
								}
							/>
							<TooltipContent>这是共享 Tooltip 提示浮层</TooltipContent>
						</Tooltip>

						<HoverCard>
							<HoverCardTrigger
								render={
									<Button type="button" variant="outline">
										预览卡片 HoverCard
									</Button>
								}
							/>
							<HoverCardContent className="space-y-1.5">
								<p className="font-medium text-foreground text-sm">
									HoverCard 摘要预览
								</p>
								<p className="text-muted-foreground text-xs">
									用于目录条目详情与二级菜单浮层，自动适配 popover 背景与描边。
								</p>
							</HoverCardContent>
						</HoverCard>

						<Popover>
							<PopoverTrigger
								render={
									<Button type="button" variant="outline">
										气泡弹层 Popover
									</Button>
								}
							/>
							<PopoverContent>
								<PopoverHeader>
									<PopoverTitle>快速筛选设置</PopoverTitle>
									<PopoverDescription>
										点击触发、Esc 或点击外部即可关闭。
									</PopoverDescription>
								</PopoverHeader>
								<div className="flex justify-end gap-2">
									<Button
										type="button"
										size="xs"
										variant="secondary"
										onClick={() => toast.info("已重置筛选条件")}
									>
										重置
									</Button>
									<Button
										type="button"
										size="xs"
										onClick={() => toast.success("已应用筛选条件")}
									>
										应用
									</Button>
								</div>
							</PopoverContent>
						</Popover>

						<DropdownMenu>
							<DropdownMenuTrigger
								render={
									<Button type="button" variant="outline">
										下拉菜单 DropdownMenu
										<ChevronDownIcon aria-hidden="true" />
									</Button>
								}
							/>
							<DropdownMenuContent className="w-52">
								<DropdownMenuGroup>
									<DropdownMenuLabel>视图操作</DropdownMenuLabel>
									<DropdownMenuItem
										aria-current="page"
										className="bg-accent text-accent-foreground"
									>
										<FileTextIcon aria-hidden="true" />
										当前激活项（accent）
									</DropdownMenuItem>
									<DropdownMenuItem
										onClick={() => toast.info("点击了普通菜单项")}
									>
										<PencilIcon aria-hidden="true" />
										普通悬停项（muted）
									</DropdownMenuItem>
								</DropdownMenuGroup>
								<DropdownMenuSeparator />
								<DropdownMenuCheckboxItem
									checked={menuChecked}
									onCheckedChange={(v) => setMenuChecked(Boolean(v))}
								>
									显示辅助网格线
								</DropdownMenuCheckboxItem>
								<DropdownMenuSeparator />
								<DropdownMenuRadioGroup
									value={menuSort}
									onValueChange={setMenuSort}
								>
									<DropdownMenuRadioItem value="updated">
										按更新时间排序
									</DropdownMenuRadioItem>
									<DropdownMenuRadioItem value="name">
										按名称拼音排序
									</DropdownMenuRadioItem>
								</DropdownMenuRadioGroup>
								<DropdownMenuSeparator />
								<DropdownMenuSub>
									<DropdownMenuSubTrigger>更多导出格式</DropdownMenuSubTrigger>
									<DropdownMenuSubContent>
										<DropdownMenuItem
											onClick={() => toast.success("已触发 PDF 导出示例")}
										>
											导出为 PDF
										</DropdownMenuItem>
										<DropdownMenuItem
											onClick={() => toast.success("已触发 CSV 导出示例")}
										>
											导出为 CSV
										</DropdownMenuItem>
									</DropdownMenuSubContent>
								</DropdownMenuSub>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									variant="destructive"
									onClick={() => setConfirmOpen(true)}
								>
									<Trash2Icon aria-hidden="true" />
									危险删除项
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>

						<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
							<DialogTrigger
								render={
									<Button type="button" variant="outline">
										标准对话框 Dialog
									</Button>
								}
							/>
							<DialogContent>
								<DialogHeader>
									<DialogTitle>标准对话框外观演示</DialogTitle>
									<DialogDescription>
										用于检视遮罩层（bg-overlay）、弹窗表面、标题排版及底部按钮间距。
									</DialogDescription>
								</DialogHeader>
								<p className="text-muted-foreground text-xs leading-relaxed">
									对话框内部支持表单、提示及自定义页脚，按下 Esc
									或点击右上角关闭按钮即可返回页面。
								</p>
								<DialogFooter>
									<Button
										type="button"
										variant="outline"
										onClick={() => setDialogOpen(false)}
									>
										取消
									</Button>
									<Button
										type="button"
										onClick={() => {
											setDialogOpen(false);
											toast.success("已确认示例对话框");
										}}
									>
										确认保存
									</Button>
								</DialogFooter>
							</DialogContent>
						</Dialog>

						<Button
							type="button"
							variant="destructive-outline"
							onClick={() => setConfirmOpen(true)}
						>
							危险确认框 ConfirmDialog
						</Button>

						<Button
							type="button"
							variant="warning"
							onClick={() => setWarningConfirmOpen(true)}
						>
							警告确认框
						</Button>

						<Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
							<SheetTrigger
								render={
									<Button type="button" variant="outline">
										<PanelRightOpenIcon aria-hidden="true" />
										侧滑抽屉 Sheet
									</Button>
								}
							/>
							<SheetContent side="right">
								<SheetHeader>
									<SheetTitle>侧滑详情抽屉（Sheet）</SheetTitle>
									<SheetDescription>
										用于展示详情面板或辅助配置，不离开当前页面上下文。
									</SheetDescription>
								</SheetHeader>
								<div className="flex-1 space-y-3 px-4 text-xs">
									<div className="rounded-md border bg-muted/40 p-3">
										抽屉背景与分隔边线自动跟随当前主题预设与明暗模式。
									</div>
								</div>
								<div className="flex justify-end border-t p-4">
									<Button
										type="button"
										variant="outline"
										onClick={() => setSheetOpen(false)}
									>
										关闭
									</Button>
								</div>
							</SheetContent>
						</Sheet>
					</div>

					<ContextMenu>
						<ContextMenuTrigger
							className={cn(
								"flex h-20 cursor-context-menu items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/30 px-4 text-center text-muted-foreground text-xs transition-colors hover:bg-muted/50",
							)}
						>
							<MousePointerClickIcon
								className="size-4 shrink-0"
								aria-hidden="true"
							/>
							右键菜单演示区（ContextMenu）：在此区域点击鼠标右键预览主菜单与二级子菜单样式
						</ContextMenuTrigger>
						<ContextMenuContent className="w-48">
							<ContextMenuGroup>
								<ContextMenuItem onClick={() => toast.info("已执行右键刷新")}>
									<PencilIcon aria-hidden="true" />
									刷新此区域
								</ContextMenuItem>
								<ContextMenuItem
									onClick={() => toast.success("已复制当前示例标识")}
								>
									<CopyIcon aria-hidden="true" />
									复制示例标识
								</ContextMenuItem>
							</ContextMenuGroup>
							<ContextMenuSeparator />
							<ContextMenuSub>
								<ContextMenuSubTrigger>更多操作</ContextMenuSubTrigger>
								<ContextMenuSubContent>
									<ContextMenuItem
										onClick={() => toast.info("已触发子菜单示例 1")}
									>
										定位至顶部
									</ContextMenuItem>
									<ContextMenuItem
										onClick={() => toast.info("已触发子菜单示例 2")}
									>
										重置演示状态
									</ContextMenuItem>
								</ContextMenuSubContent>
							</ContextMenuSub>
							<ContextMenuSeparator />
							<ContextMenuItem
								className="text-destructive-foreground focus:bg-destructive/10 focus:text-destructive-foreground"
								onClick={() => setConfirmOpen(true)}
							>
								<Trash2Icon aria-hidden="true" />
								移除示例项
							</ContextMenuItem>
						</ContextMenuContent>
					</ContextMenu>

					<div className="flex flex-wrap items-center gap-2 border-t pt-3">
						<span className="flex items-center gap-1 text-muted-foreground text-xs">
							<BellIcon className="size-3.5" aria-hidden="true" />
							消息通知（Sonner）：
						</span>
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={() => toast("普通消息提示：当前样式已同步更新")}
						>
							普通通知
						</Button>
						<Button
							type="button"
							size="sm"
							variant="info"
							onClick={() =>
								toast.info("信息通知", {
									description: "可切换深浅模式对比通知气泡的可读性。",
								})
							}
						>
							信息 Info
						</Button>
						<Button
							type="button"
							size="sm"
							variant="success"
							onClick={() =>
								toast.success("操作成功", {
									description: "配置已保存并应用到工作台。",
								})
							}
						>
							成功 Success
						</Button>
						<Button
							type="button"
							size="sm"
							variant="warning"
							onClick={() =>
								toast.warning("警告提示", {
									description: "检测到未保存的本地草稿，请注意核对。",
								})
							}
						>
							警告 Warning
						</Button>
						<Button
							type="button"
							size="sm"
							variant="destructive"
							onClick={() =>
								toast.error("操作失败", {
									description: "此为错误通知样式示例，未修改任何真实数据。",
								})
							}
						>
							错误 Error
						</Button>
					</div>
				</CardContent>
			</Card>

			<ConfirmDialog
				open={confirmOpen}
				title="删除确认示例"
				confirmLabel="确认删除"
				onClose={() => setConfirmOpen(false)}
				onConfirm={() => {
					setConfirmOpen(false);
					toast.success("已关闭危险确认演示弹窗（未删除任何数据）");
				}}
			>
				此弹窗展示默认 destructive-solid
				确认按钮与取消按钮的对比度，点击确认不会影响任何业务数据。
			</ConfirmDialog>

			<ConfirmDialog
				open={warningConfirmOpen}
				title="高风险覆盖警告示例"
				confirmLabel="继续执行"
				confirmVariant="warning-solid"
				onClose={() => setWarningConfirmOpen(false)}
				onConfirm={() => {
					setWarningConfirmOpen(false);
					toast.warning("已关闭警告确认演示弹窗");
				}}
			>
				此弹窗展示 warning-solid 实心警告按钮（含专用深色前景字）的视觉表现。
			</ConfirmDialog>
		</section>
	);
}
