/**
 * @file 命令面板的搜索目录。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-11-20
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：components/layout/command-menu-dialog.tsx。
 * 调用：@tanstack/react-router、lucide-react、导航目录。
 * 功能：为已启用业务模块、个人设置和管理中心配置中文标题、图标与检索关键词。
 * 预期结果：命令面板完整覆盖真实工作台入口，不暴露未实现的模板空页面。
 */
import type { LinkProps } from "@tanstack/react-router";
import {
	BellIcon,
	CalculatorIcon,
	CalendarClockIcon,
	FileSlidersIcon,
	FileTextIcon,
	FolderKanbanIcon,
	type LucideIcon,
	NotebookPenIcon,
	UserIcon,
	UsersIcon,
	WaypointsIcon,
} from "lucide-react";
import { adminNav, settingsHomeHref } from "./navigation";

export type SearchItem = {
	icon: LucideIcon;
	name: string;
	href: NonNullable<LinkProps["to"]>;
	search?: Record<string, string>;
	adminOnly?: boolean;
	tags?: string[];
};

type SearchGroup = {
	title: string;
	data: SearchItem[];
};

export const searchData: SearchGroup[] = [
	{
		title: "工作区",
		data: [
			{
				icon: WaypointsIcon,
				name: "资金分析",
				href: "/funds",
				tags: ["资金", "资金调查", "交易", "图谱", "追踪", "流水", "funds"],
			},
			{
				icon: FileTextIcon,
				name: "文书取号",
				href: "/documents",
				tags: ["文书", "取号", "通知书", "word", "documents"],
			},
			{
				icon: NotebookPenIcon,
				name: "笔录",
				href: "/inquiries",
				tags: ["询问笔录", "调查", "问答", "inquiries"],
			},
			{
				icon: CalculatorIcon,
				name: "增值税计算器",
				href: "/calculators",
				tags: [
					"计算器",
					"增值税",
					"销项",
					"进项",
					"留抵",
					"vat",
					"calculators",
				],
			},
			{
				icon: FolderKanbanIcon,
				name: "资金案件资料",
				href: "/funds/cases",
				tags: ["案件", "导入", "清洗", "核对", "跨案", "流水", "cases"],
			},
			{
				icon: FileSlidersIcon,
				name: "文书模板管理",
				href: "/documents",
				search: { view: "templates" },
				adminOnly: true,
				tags: ["文书", "模板", "文书模板", "templates"],
			},
			{
				icon: UsersIcon,
				name: "常用询问人",
				href: "/inquiries",
				search: { inquiryView: "inquirers" },
				tags: ["笔录", "询问人", "记录人", "执法人", "inquirers"],
			},
			{
				icon: CalendarClockIcon,
				name: "滞纳金计算器",
				href: "/calculators/late-fees",
				tags: ["计算器", "滞纳金", "税款", "缴款期限", "late-fees"],
			},
		],
	},
	{
		title: "个人设置",
		data: [
			{
				icon: UserIcon,
				name: "个人资料",
				href: settingsHomeHref,
				tags: ["账号", "资料", "姓名", "头像", "profile"],
			},
			{
				icon: BellIcon,
				name: "通知设置",
				href: "/settings/notifications",
				tags: ["通知", "提醒", "偏好", "notifications"],
			},
		],
	},
	{
		title: "管理中心",
		data: [
			...adminNav.map((item) => ({
				icon: item.icon,
				name: item.title,
				href: item.href,
				tags: ["管理中心", "人员", "账号", "权限", "admin", "users"],
			})),
		],
	},
];
