/**
 * @file 工作台业务、管理及个人设置入口目录。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-11-21
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：侧栏、管理中心菜单、个人菜单与搜索目录。
 * 调用：共享权限目录、@tanstack/react-router、lucide-react。
 * 功能：分别提供业务入口、侧栏可见入口、管理入口和统一的个人设置目录。
 * 预期结果：管理员与普通人员的个人设置入口一致，管理入口独立，仅暴露已启用业务模块。
 */

import { type ModuleId, modules } from "@leonwillow-electron/access";
import type { LinkProps } from "@tanstack/react-router";
import {
	BarChart3Icon,
	BellIcon,
	BookOpenIcon,
	CalculatorIcon,
	FileTextIcon,
	InboxIcon,
	type LucideIcon,
	NotebookPenIcon,
	SparklesIcon,
	SwatchBookIcon,
	TicketIcon,
	UserIcon,
	UsersIcon,
	WaypointsIcon,
} from "lucide-react";

type NavItem = {
	title: string;
	href: NonNullable<LinkProps["to"]>;
	icon: LucideIcon;
};

const moduleIcons: Record<ModuleId, LucideIcon> = {
	funds: WaypointsIcon,
	documents: FileTextIcon,
	inquiries: NotebookPenIcon,
	calculators: CalculatorIcon,
	inbox: InboxIcon,
	tickets: TicketIcon,
	contacts: UsersIcon,
	"knowledge-base": BookOpenIcon,
	"ai-agent": SparklesIcon,
	reports: BarChart3Icon,
};
export const primaryNav: (NavItem & { id: ModuleId })[] = modules
	.filter((module) => module.enabled)
	.map((module) => ({
		id: module.id,
		title: module.name,
		href: module.path,
		icon: moduleIcons[module.id],
	}));

export const sidebarNav = primaryNav;

export const adminNav: NavItem[] = [
	{ title: "人员与权限", href: "/admin/users", icon: UsersIcon },
	{ title: "组件演示", href: "/admin/showcase", icon: SwatchBookIcon },
];

export const settingsHomeHref = "/settings/profile" as const;

export const settingsNav: NavItem[] = [
	{ title: "个人资料", href: settingsHomeHref, icon: UserIcon },
	{ title: "通知设置", href: "/settings/notifications", icon: BellIcon },
];
