import type { LinkProps } from "@tanstack/react-router";
// Third-party Imports
import {
	BarChart3Icon,
	BellIcon,
	BookOpenIcon,
	ClockIcon,
	CreditCardIcon,
	InboxIcon,
	type LucideProps,
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
// React Imports
import type { ForwardRefExoticComponent, RefAttributes } from "react";

export type SearchData = {
	title: string;
	data: {
		icon: ForwardRefExoticComponent<
			Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>
		>;
		name: string;
		href: NonNullable<LinkProps["to"]>;
		shortcut?: string;
		openInNewTab?: boolean;
		tags?: string[];
	}[];
};

export const searchData: SearchData[] = [
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
		title: "设置",
		data: [
			{
				icon: SettingsIcon,
				name: "通用设置",
				href: "/settings/general",
				tags: ["workspace", "branding", "preferences"],
			},
			{
				icon: UsersIcon,
				name: "团队成员",
				href: "/settings/teammates",
				tags: ["workspace", "team", "agents", "invite"],
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
			{
				icon: UserIcon,
				name: "个人资料",
				href: "/settings/profile",
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
];
