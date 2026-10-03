// Third-party Imports
import {
	BarChart3Icon,
	BellIcon,
	BookOpenIcon,
	ClockIcon,
	CreditCardIcon,
	FileTextIcon,
	FolderIcon,
	InboxIcon,
	MessageCircleMoreIcon,
	MessageSquareTextIcon,
	SettingsIcon,
	ShieldIcon,
	SparklesIcon,
	TagIcon,
	TicketIcon,
	UserCheckIcon,
	UserIcon,
	UsersIcon,
} from "lucide-react";

// Type Imports
import type { NavGroup, NavItem } from "@/types/navigation";

// Primary modules — shown in the left icon rail
export const primaryNav: NavItem[] = [
	{ title: "收件箱", href: "/inbox", icon: InboxIcon },
	{ title: "工单", href: "/tickets", icon: TicketIcon },
	{ title: "联系人", href: "/contacts", icon: UsersIcon },
	{ title: "知识库", href: "/knowledge-base", icon: BookOpenIcon },
	{ title: "AI 助手", href: "/ai-agent", icon: SparklesIcon },
	{ title: "报表", href: "/reports", icon: BarChart3Icon },
];

// Knowledge Base sub-navigation — shown inside the /knowledge-base layout
export const knowledgeBaseNav: NavItem[] = [
	{ title: "文章", href: "/knowledge-base", icon: FileTextIcon },
	{ title: "合集", href: "/knowledge-base/collections", icon: FolderIcon },
];

// Settings sub-navigation — grouped sections shown inside the /settings layout.
// The first item's href is the settings landing route (see AppSidebar / ProfileMenu).
export const settingsNav: NavGroup[] = [
	{
		title: "工作区",
		items: [
			{ title: "通用设置", href: "/settings/general", icon: SettingsIcon },
			{ title: "团队成员", href: "/settings/teammates", icon: UsersIcon },
			{ title: "工作时间", href: "/settings/office-hours", icon: ClockIcon },
			{ title: "安全", href: "/settings/security", icon: ShieldIcon },
		],
	},
	{
		title: "收件箱",
		items: [
			{ title: "分配规则", href: "/settings/assignments", icon: UserCheckIcon },
			{
				title: "快捷回复",
				href: "/settings/saved-replies",
				icon: MessageSquareTextIcon,
			},
		],
	},
	{
		title: "渠道",
		items: [
			{
				title: "在线消息",
				href: "/settings/messenger",
				icon: MessageCircleMoreIcon,
			},
		],
	},
	{
		title: "订阅",
		items: [{ title: "账单", href: "/settings/billing", icon: CreditCardIcon }],
	},
	{
		title: "数据",
		items: [{ title: "标签", href: "/settings/tags", icon: TagIcon }],
	},
	{
		title: "个人",
		items: [
			{ title: "个人资料", href: "/settings/profile", icon: UserIcon },
			{ title: "通知", href: "/settings/notifications", icon: BellIcon },
		],
	},
];

// The default settings destination (used by the sidebar gear + profile menu).
export const settingsHomeHref = "/settings/general" as const;
