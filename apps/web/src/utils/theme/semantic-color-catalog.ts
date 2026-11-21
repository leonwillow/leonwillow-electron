/**
 * @file 主题分析工具的语义颜色目录（全量基础色、状态语义色、侧栏色与图表色）。
 * 创建时间：2026-11-21
 * 修改时间：2026-11-21
 * 版本作用：纯静态语义色元数据表，为颜色语义溯源、中文释义、配对提示与语义切换下拉提供单一来源。
 * 被调用：utils/theme/semantic-catalog.ts。
 * 调用：configs/theme-variables、types/theme。
 * 功能：映射全部 40+ 项目颜色令牌的中文名称、分组、用途描述、配对前景/背景与是否支持全局主题编辑。
 * 预期结果：所有颜色展示均先显示中文语义角色与用途，再显示参数数值。
 */
import { EDITABLE_STYLE_KEYS } from "@/configs/theme-variables";
import type { ThemeStyleProps } from "@/types/theme";

export type SemanticColorGroup =
	| "brand"
	| "status"
	| "surface"
	| "interactive"
	| "border"
	| "sidebar"
	| "chart";

export type SemanticColorTokenMeta = {
	key: string;
	varName: string;
	label: string;
	group: SemanticColorGroup;
	groupLabel: string;
	description: string;
	editable: boolean;
	styleKey?: keyof ThemeStyleProps;
	pairedToken?: string;
};

const EDITABLE_KEY_SET = new Set<string>(EDITABLE_STYLE_KEYS);

function defineColorMeta(
	item: Omit<SemanticColorTokenMeta, "varName" | "editable" | "styleKey">,
): SemanticColorTokenMeta {
	const editable = EDITABLE_KEY_SET.has(item.key);
	return {
		...item,
		varName: `--${item.key}`,
		editable,
		...(editable ? { styleKey: item.key as keyof ThemeStyleProps } : {}),
	};
}

export const SEMANTIC_COLOR_GROUP_LABELS: Record<SemanticColorGroup, string> = {
	brand: "品牌与操作",
	status: "业务状态语义",
	surface: "基础表面层级",
	interactive: "交互悬停与选中",
	border: "边框与焦点轮廓",
	sidebar: "侧栏专属语义",
	chart: "图表数据色板",
};

export const SEMANTIC_COLOR_GROUP_ORDER: readonly SemanticColorGroup[] = [
	"brand",
	"status",
	"surface",
	"interactive",
	"border",
	"sidebar",
	"chart",
];

export const SEMANTIC_COLOR_TOKENS: readonly SemanticColorTokenMeta[] = [
	defineColorMeta({
		key: "primary",
		label: "品牌主色",
		group: "brand",
		groupLabel: "品牌与操作",
		description: "主要操作按钮、核心选中强调与导航激活主色",
		pairedToken: "primary-foreground",
	}),
	defineColorMeta({
		key: "primary-foreground",
		label: "主色前景文字",
		group: "brand",
		groupLabel: "品牌与操作",
		description: "叠加在品牌主色实心背景上的文字与图标",
		pairedToken: "primary",
	}),
	defineColorMeta({
		key: "primary-hover",
		label: "主色悬停态",
		group: "brand",
		groupLabel: "品牌与操作",
		description: "主按钮悬停时的加深/提亮反馈色（未显式配置时自动派生）",
		pairedToken: "primary-foreground",
	}),
	defineColorMeta({
		key: "secondary",
		label: "次要按钮底色",
		group: "brand",
		groupLabel: "品牌与操作",
		description: "次级操作按钮、次要标签与低权重操作底色",
		pairedToken: "secondary-foreground",
	}),
	defineColorMeta({
		key: "secondary-foreground",
		label: "次要前景文字",
		group: "brand",
		groupLabel: "品牌与操作",
		description: "次要底色上的文字与图标颜色",
		pairedToken: "secondary",
	}),
	defineColorMeta({
		key: "destructive",
		label: "危险操作主色",
		group: "brand",
		groupLabel: "品牌与操作",
		description: "删除确认、错误描边、危险实心按钮与失败提示色",
		pairedToken: "destructive-solid-foreground",
	}),
	defineColorMeta({
		key: "destructive-foreground",
		label: "危险浅底文字",
		group: "brand",
		groupLabel: "品牌与操作",
		description: "表单报错、危险浅底标签与危险文字按钮前景色",
		pairedToken: "destructive",
	}),
	defineColorMeta({
		key: "destructive-solid-foreground",
		label: "危险实心前景",
		group: "brand",
		groupLabel: "品牌与操作",
		description: "危险实心按钮（destructive-solid）内部的文字与图标",
		pairedToken: "destructive",
	}),
	defineColorMeta({
		key: "info",
		label: "信息状态色",
		group: "status",
		groupLabel: "业务状态语义",
		description: "说明提示、同步进行中与编辑操作强调色",
		pairedToken: "info-foreground",
	}),
	defineColorMeta({
		key: "info-foreground",
		label: "信息浅底文字",
		group: "status",
		groupLabel: "业务状态语义",
		description: "信息浅底徽章、提示通知与幽灵按钮文字色",
		pairedToken: "info",
	}),
	defineColorMeta({
		key: "success",
		label: "成功状态色",
		group: "status",
		groupLabel: "业务状态语义",
		description: "完成态、校验通过、在线启用与正向指标色",
		pairedToken: "success-foreground",
	}),
	defineColorMeta({
		key: "success-foreground",
		label: "成功浅底文字",
		group: "status",
		groupLabel: "业务状态语义",
		description: "成功浅底徽章、通过通知与正向操作文字色",
		pairedToken: "success",
	}),
	defineColorMeta({
		key: "warning",
		label: "警告状态色",
		group: "status",
		groupLabel: "业务状态语义",
		description: "待核对、归档风险、滞纳金预警与注意提示色",
		pairedToken: "warning-foreground",
	}),
	defineColorMeta({
		key: "warning-foreground",
		label: "警告浅底文字",
		group: "status",
		groupLabel: "业务状态语义",
		description: "警告浅底徽章、预警金额与归档按钮文字色",
		pairedToken: "warning",
	}),
	defineColorMeta({
		key: "warning-solid-foreground",
		label: "警告实心前景",
		group: "status",
		groupLabel: "业务状态语义",
		description: "实心警告按钮（warning-solid）内部文字前景色",
		pairedToken: "warning",
	}),
	defineColorMeta({
		key: "background",
		label: "页面画布背景",
		group: "surface",
		groupLabel: "基础表面层级",
		description: "应用最底层页面画布底色",
		pairedToken: "foreground",
	}),
	defineColorMeta({
		key: "foreground",
		label: "正文默认文字",
		group: "surface",
		groupLabel: "基础表面层级",
		description: "页面标题、主正文与默认图标前景色",
		pairedToken: "background",
	}),
	defineColorMeta({
		key: "card",
		label: "卡片纸面背景",
		group: "surface",
		groupLabel: "基础表面层级",
		description: "卡片、表格正文区、正文面板等抬升容器底色",
		pairedToken: "card-foreground",
	}),
	defineColorMeta({
		key: "card-foreground",
		label: "卡片前景文字",
		group: "surface",
		groupLabel: "基础表面层级",
		description: "卡片容器内的标题与正文颜色",
		pairedToken: "card",
	}),
	defineColorMeta({
		key: "popover",
		label: "浮层弹框背景",
		group: "surface",
		groupLabel: "基础表面层级",
		description: "下拉菜单、右键菜单、Popover 与浮动面板底色",
		pairedToken: "popover-foreground",
	}),
	defineColorMeta({
		key: "popover-foreground",
		label: "浮层前景文字",
		group: "surface",
		groupLabel: "基础表面层级",
		description: "弹层与菜单内的文字与图标颜色",
		pairedToken: "popover",
	}),
	defineColorMeta({
		key: "invert",
		label: "反色提示背景",
		group: "surface",
		groupLabel: "基础表面层级",
		description: "Tooltip 气泡等反色高对比提示底色",
		pairedToken: "invert-foreground",
	}),
	defineColorMeta({
		key: "invert-foreground",
		label: "反色提示文字",
		group: "surface",
		groupLabel: "基础表面层级",
		description: "反色气泡内部的文字颜色",
		pairedToken: "invert",
	}),
	defineColorMeta({
		key: "overlay",
		label: "模态遮罩层",
		group: "surface",
		groupLabel: "基础表面层级",
		description: "Dialog 与 Sheet 后方统一的半透明背景遮罩",
	}),
	defineColorMeta({
		key: "muted",
		label: "弱化 / 悬停底色",
		group: "interactive",
		groupLabel: "交互悬停与选中",
		description: "表头、分组底、输入框弱背景及菜单普通悬停反馈底色",
		pairedToken: "muted-foreground",
	}),
	defineColorMeta({
		key: "muted-foreground",
		label: "辅助说明文字",
		group: "interactive",
		groupLabel: "交互悬停与选中",
		description: "占位提示、副标题、时间戳、表头说明与次要图标色",
		pairedToken: "muted",
	}),
	defineColorMeta({
		key: "accent",
		label: "菜单选中强调底",
		group: "interactive",
		groupLabel: "交互悬停与选中",
		description: "下拉选项、日历项与列表项的选中强调底色",
		pairedToken: "accent-foreground",
	}),
	defineColorMeta({
		key: "accent-foreground",
		label: "选中强调前景",
		group: "interactive",
		groupLabel: "交互悬停与选中",
		description: "叠加在强调底色（accent）上的文字与图标颜色",
		pairedToken: "accent",
	}),
	defineColorMeta({
		key: "border",
		label: "常规界面边框",
		group: "border",
		groupLabel: "边框与焦点轮廓",
		description: "卡片外框、分割线、表格网格线与容器边线",
	}),
	defineColorMeta({
		key: "input",
		label: "输入框描边",
		group: "border",
		groupLabel: "边框与焦点轮廓",
		description: "文本输入、Select 触发器与表单控件边框色",
	}),
	defineColorMeta({
		key: "ring",
		label: "键盘焦点环",
		group: "border",
		groupLabel: "边框与焦点轮廓",
		description: "键盘 focus-visible 聚焦轮廓与激活框高亮色",
	}),
	defineColorMeta({
		key: "sidebar",
		label: "侧栏背景",
		group: "sidebar",
		groupLabel: "侧栏专属语义",
		description: "左侧主导航栏与工作台二级目录背景底色",
		pairedToken: "sidebar-foreground",
	}),
	defineColorMeta({
		key: "sidebar-foreground",
		label: "侧栏文字",
		group: "sidebar",
		groupLabel: "侧栏专属语义",
		description: "侧栏导航条目与二级目录默认文字颜色",
		pairedToken: "sidebar",
	}),
	defineColorMeta({
		key: "sidebar-primary",
		label: "侧栏品牌主色",
		group: "sidebar",
		groupLabel: "侧栏专属语义",
		description: "侧栏品牌标识与主入口高亮色",
		pairedToken: "sidebar-primary-foreground",
	}),
	defineColorMeta({
		key: "sidebar-primary-foreground",
		label: "侧栏主色前景",
		group: "sidebar",
		groupLabel: "侧栏专属语义",
		description: "侧栏主色填充内部的前景图标/文字色",
		pairedToken: "sidebar-primary",
	}),
	defineColorMeta({
		key: "sidebar-accent",
		label: "侧栏选中底色",
		group: "sidebar",
		groupLabel: "侧栏专属语义",
		description: "管理中心与二级目录当前路由选中项底色",
		pairedToken: "sidebar-accent-foreground",
	}),
	defineColorMeta({
		key: "sidebar-accent-foreground",
		label: "侧栏选中前景",
		group: "sidebar",
		groupLabel: "侧栏专属语义",
		description: "侧栏选中项内部的文字与图标颜色",
		pairedToken: "sidebar-accent",
	}),
	defineColorMeta({
		key: "sidebar-border",
		label: "侧栏分隔边框",
		group: "sidebar",
		groupLabel: "侧栏专属语义",
		description: "主侧栏与二级目录外框及内部分割线颜色",
	}),
	defineColorMeta({
		key: "sidebar-ring",
		label: "侧栏焦点轮廓",
		group: "sidebar",
		groupLabel: "侧栏专属语义",
		description: "侧栏区域键盘聚焦轮廓色",
	}),
	defineColorMeta({
		key: "chart-1",
		label: "图表序列色 1",
		group: "chart",
		groupLabel: "图表数据色板",
		description: "数据可视化与图谱第 1 序列主题色",
	}),
	defineColorMeta({
		key: "chart-2",
		label: "图表序列色 2",
		group: "chart",
		groupLabel: "图表数据色板",
		description: "数据可视化与图谱第 2 序列主题色",
	}),
	defineColorMeta({
		key: "chart-3",
		label: "图表序列色 3",
		group: "chart",
		groupLabel: "图表数据色板",
		description: "数据可视化与图谱第 3 序列主题色",
	}),
	defineColorMeta({
		key: "chart-4",
		label: "图表序列色 4",
		group: "chart",
		groupLabel: "图表数据色板",
		description: "数据可视化与图谱第 4 序列主题色",
	}),
	defineColorMeta({
		key: "chart-5",
		label: "图表序列色 5",
		group: "chart",
		groupLabel: "图表数据色板",
		description: "数据可视化与图谱第 5 序列主题色",
	}),
];

export const SEMANTIC_COLOR_MAP: ReadonlyMap<string, SemanticColorTokenMeta> =
	new Map(SEMANTIC_COLOR_TOKENS.map((item) => [item.key, item]));
