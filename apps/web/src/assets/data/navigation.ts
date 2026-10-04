/**
 * @file 图标栏实际使用的主导航目录。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：components/layout/profile-menu.tsx、components/layout/app-sidebar.tsx。
 * 调用：@tanstack/react-router、lucide-react。
 * 功能：提供已挂载的入口与默认设置地址。
 * 预期结果：侧栏和个人菜单跳转到类型可检查的路由。
 */
import type { LinkProps } from "@tanstack/react-router";
import {
	BarChart3Icon,
	BookOpenIcon,
	InboxIcon,
	type LucideIcon,
	SparklesIcon,
	TicketIcon,
	UsersIcon,
} from "lucide-react";

type NavItem = {
	title: string;
	href: NonNullable<LinkProps["to"]>;
	icon: LucideIcon;
};

export const primaryNav: NavItem[] = [
	{ title: "收件箱", href: "/inbox", icon: InboxIcon },
	{ title: "工单", href: "/tickets", icon: TicketIcon },
	{ title: "联系人", href: "/contacts", icon: UsersIcon },
	{ title: "知识库", href: "/knowledge-base", icon: BookOpenIcon },
	{ title: "AI 助手", href: "/ai-agent", icon: SparklesIcon },
	{ title: "报表", href: "/reports", icon: BarChart3Icon },
];

export const settingsHomeHref = "/settings/general" as const;
