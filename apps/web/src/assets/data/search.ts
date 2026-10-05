/**
 * @file 命令面板的搜索目录。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：components/layout/command-menu.tsx。
 * 调用：@tanstack/react-router、lucide-react、导航目录。
 * 功能：为入口配置中文标题、图标与检索关键词，分开个人设置和管理中心。
 * 预期结果：命令面板按匹配程度展示并执行页面跳转。
 */
import type { LinkProps } from "@tanstack/react-router";
import {
	BarChart3Icon,
	BellIcon,
	BookOpenIcon,
	ClockIcon,
	CreditCardIcon,
	InboxIcon,
	type LucideIcon,
	MessageCircleMoreIcon,
	MessageSquareIcon,
	SettingsIcon,
	ShieldIcon,
	SparklesIcon,
	TagIcon,
	TicketIcon,
	UserCheckIcon,
	UserIcon,
	UsersIcon,
} from "lucide-react";
import { adminNav, settingsHomeHref } from "./navigation";

type SearchGroup = {
	title: string;
	data: {
		icon: LucideIcon;
		name: string;
		href: NonNullable<LinkProps["to"]>;
		tags?: string[];
	}[];
};

export const searchData: SearchGroup[] = [
	{
		title: "工作区",
		data: [
			{
				icon: InboxIcon,
				name: "收件箱",
				href: "/inbox",
				tags: ["conversations", "messages", "chat"],
			},
			{
				icon: TicketIcon,
				name: "工单",
				href: "/tickets",
				tags: ["issues", "requests", "support"],
			},
			{
				icon: UsersIcon,
				name: "联系人",
				href: "/contacts",
				tags: ["people", "customers", "leads"],
			},
			{
				icon: BookOpenIcon,
				name: "知识库",
				href: "/knowledge-base",
				tags: ["articles", "docs", "help"],
			},
			{
				icon: SparklesIcon,
				name: "AI 助手",
				href: "/ai-agent",
				tags: ["ai", "automation", "bot", "assistant"],
			},
			{
				icon: BarChart3Icon,
				name: "报表",
				href: "/reports",
				tags: ["analytics", "metrics", "dashboard"],
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
				tags: ["account", "name", "avatar", "away"],
			},
			{
				icon: BellIcon,
				name: "通知",
				href: "/settings/notifications",
				tags: ["email", "alerts", "preferences"],
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
				tags: ["管理中心", "admin", "permissions"],
			})),
			{
				icon: SettingsIcon,
				name: "通用设置",
				href: "/settings/general",
				tags: ["workspace", "branding", "preferences"],
			},
			{
				icon: ClockIcon,
				name: "工作时间",
				href: "/settings/office-hours",
				tags: ["availability", "schedule", "hours", "timezone"],
			},
			{
				icon: ShieldIcon,
				name: "安全",
				href: "/settings/security",
				tags: ["password", "2fa", "sessions", "authentication"],
			},
			{
				icon: UserCheckIcon,
				name: "分配规则",
				href: "/settings/assignments",
				tags: ["inbox", "routing", "auto-assign"],
			},
			{
				icon: MessageSquareIcon,
				name: "快捷回复",
				href: "/settings/saved-replies",
				tags: ["inbox", "macros", "canned", "templates"],
			},
			{
				icon: MessageCircleMoreIcon,
				name: "在线消息",
				href: "/settings/messenger",
				tags: ["channels", "widget", "chat"],
			},
			{
				icon: CreditCardIcon,
				name: "账单",
				href: "/settings/billing",
				tags: ["subscription", "plan", "invoices", "payment"],
			},
			{
				icon: TagIcon,
				name: "标签",
				href: "/settings/tags",
				tags: ["labels", "data", "categorize"],
			},
		],
	},
];
