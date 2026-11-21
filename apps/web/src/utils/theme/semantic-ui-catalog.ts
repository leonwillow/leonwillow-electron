/**
 * @file 主题分析工具的排版、间距、控件尺寸、圆角、阴影与组件槽位中文语义目录。
 * 创建时间：2026-11-21
 * 修改时间：2026-11-21
 * 版本作用：纯静态语义字典，统一管理非颜色维度的设计系统中文名称、令牌映射与用途说明。
 * 被调用：utils/theme/semantic-catalog.ts。
 * 调用：无模块依赖。
 * 功能：覆盖字号阶梯、字重、间距步进、控件高度、圆角与阴影阶梯，以及全站 data-slot、业务类名与 HTML 地标语义。
 * 预期结果：排版、布局、边框、圆角与阴影均能准确给出中文语义归属与用途描述。
 */

export type SemanticTypographyToken = {
	token: string;
	label: string;
	cssVar?: string;
	rem: number;
	leading: number;
	description: string;
};

export const SEMANTIC_TYPOGRAPHY_TOKENS: readonly SemanticTypographyToken[] = [
	{
		token: "text-caption",
		label: "辅助小字 / 快捷键",
		cssVar: "--text-caption",
		rem: 0.6875,
		leading: 1.4,
		description: "时间戳、辅助标注、快捷键徽章与微缩元数据",
	},
	{
		token: "text-xs",
		label: "紧凑正文",
		cssVar: "--text-xs",
		rem: 0.75,
		leading: 1.333,
		description: "表单说明、紧凑卡片文本与表格辅助信息",
	},
	{
		token: "text-control",
		label: "标准控件文字",
		cssVar: "--text-control",
		rem: 0.8125,
		leading: 1.45,
		description: "按钮、输入框、下拉框、目录与表格统一控件字号",
	},
	{
		token: "text-sm",
		label: "标准正文",
		cssVar: "--text-sm",
		rem: 0.875,
		leading: 1.43,
		description: "主要阅读正文、表单字段值与卡片摘要",
	},
	{
		token: "text-base",
		label: "模块 / 卡片标题",
		cssVar: "--text-base",
		rem: 1,
		leading: 1.5,
		description: "工作区顶栏标题、二级菜单标题与区块标题",
	},
	{
		token: "text-lg",
		label: "二级分区标题",
		cssVar: "--text-lg",
		rem: 1.125,
		leading: 1.55,
		description: "页面大分区标题与弹窗主标题",
	},
	{
		token: "text-xl",
		label: "页面主标题",
		cssVar: "--text-xl",
		rem: 1.25,
		leading: 1.4,
		description: "页面大标题与关键统计数字",
	},
	{
		token: "text-2xl",
		label: "汇总大数字",
		cssVar: "--text-2xl",
		rem: 1.5,
		leading: 1.33,
		description: "KPI 指标卡核心金额与大号汇总展示",
	},
	{
		token: "text-3xl",
		label: "展示级标题",
		cssVar: "--text-3xl",
		rem: 1.875,
		leading: 1.2,
		description: "引导页与大屏核心视觉标题",
	},
];

export type SemanticWeightToken = {
	weight: number;
	token: string;
	label: string;
};

export const DEFAULT_WEIGHT_TOKEN: SemanticWeightToken = {
	weight: 400,
	token: "font-normal",
	label: "常规体",
};

export const SEMANTIC_WEIGHT_TOKENS: readonly SemanticWeightToken[] = [
	DEFAULT_WEIGHT_TOKEN,
	{ weight: 500, token: "font-medium", label: "中等强调" },
	{ weight: 600, token: "font-semibold", label: "半粗标题" },
	{ weight: 700, token: "font-bold", label: "粗体数值" },
];

export type SemanticSpacingToken = {
	token: string;
	cssValue: string;
	label: string;
	rem: number;
	description: string;
};

export const SEMANTIC_SPACING_TOKENS: readonly SemanticSpacingToken[] = [
	{
		token: "0",
		cssValue: "0px",
		label: "零间距",
		rem: 0,
		description: "紧贴排布，无额外留白",
	},
	{
		token: "0.5",
		cssValue: "0.125rem",
		label: "微缝间距 (0.5)",
		rem: 0.125,
		description: "极紧凑元素间微弱分隔",
	},
	{
		token: "1",
		cssValue: "0.25rem",
		label: "极紧凑间距 (1)",
		rem: 0.25,
		description: "图标与文字微距、紧密徽章组",
	},
	{
		token: "1.5",
		cssValue: "0.375rem",
		label: "细密间距 (1.5)",
		rem: 0.375,
		description: "字段标签与控件间的垂直间距",
	},
	{
		token: "2",
		cssValue: "0.5rem",
		label: "组内紧凑间距 (2)",
		rem: 0.5,
		description: "工具栏按钮组、表单行内元素间距",
	},
	{
		token: "2.5",
		cssValue: "0.625rem",
		label: "舒适控件间距 (2.5)",
		rem: 0.625,
		description: "中等卡片内留白与导航图文间距",
	},
	{
		token: "workspace-gutter",
		cssValue: "var(--spacing-workspace-gutter)",
		label: "工作区标准间距 (gutter)",
		rem: 0.75,
		description: "全站分栏边距、页头水平留白与面板标准间距（0.75rem）",
	},
	{
		token: "4",
		cssValue: "1rem",
		label: "分区常规间距 (4)",
		rem: 1,
		description: "卡片内边距、表单分组与模块区隔",
	},
	{
		token: "tree-indent",
		cssValue: "var(--spacing-tree-indent)",
		label: "目录层级缩进 (tree-indent)",
		rem: 1.25,
		description: "树形目录每级缩进与中大区块间距（1.25rem）",
	},
	{
		token: "6",
		cssValue: "1.5rem",
		label: "大区块留白 (6)",
		rem: 1.5,
		description: "弹窗主边距与大分区纵向分隔",
	},
	{
		token: "8",
		cssValue: "2rem",
		label: "宽敞留白 (8)",
		rem: 2,
		description: "空状态与页面级大留白",
	},
];

export type SemanticControlSizeToken = {
	token: string;
	cssValue: string;
	label: string;
	rem: number;
	description: string;
};

export const SEMANTIC_CONTROL_SIZE_TOKENS: readonly SemanticControlSizeToken[] =
	[
		{
			token: "control-xs",
			cssValue: "var(--spacing-control-xs)",
			label: "极小控件 (control-xs)",
			rem: 1.25,
			description: "目录同行悬停图标操作与极小微按钮",
		},
		{
			token: "control-sm",
			cssValue: "var(--spacing-control-sm)",
			label: "小型控件 (control-sm)",
			rem: 1.5,
			description: "工具栏紧凑按钮、页头次操作与小尺寸输入",
		},
		{
			token: "control-md",
			cssValue: "var(--spacing-control-md)",
			label: "默认单行控件 (control-md)",
			rem: 1.75,
			description: "全站标准按钮、输入框、Select 与表格行控件",
		},
		{
			token: "control-lg",
			cssValue: "var(--spacing-control-lg)",
			label: "大型单行控件 (control-lg)",
			rem: 2,
			description: "主题面板五项控件、主导航宽行与重点操作按钮",
		},
		{
			token: "workspace-icon",
			cssValue: "var(--spacing-workspace-icon)",
			label: "主导航图标格 (workspace-icon)",
			rem: 1.8541,
			description: "主侧栏图标按钮黄金比例正方形尺寸",
		},
		{
			token: "workspace-header",
			cssValue: "var(--spacing-workspace-header)",
			label: "工作区顶栏基线 (workspace-header)",
			rem: 3,
			description: "Logo 区、二级菜单顶栏与业务页头统一高度基线",
		},
	];

export type SemanticRadiusToken = {
	token: string;
	cssValue: string;
	label: string;
	multiplier: number | "full";
	description: string;
};

export const SEMANTIC_RADIUS_TOKENS: readonly SemanticRadiusToken[] = [
	{
		token: "rounded-none",
		cssValue: "0px",
		label: "直角无圆角",
		multiplier: 0,
		description: "贴边面板、表格单元格与直角容器",
	},
	{
		token: "rounded-sm",
		cssValue: "var(--radius-sm)",
		label: "微圆角 (radius-sm)",
		multiplier: 0.6,
		description: "小型徽章、微按钮与色块（0.6× 基准圆角）",
	},
	{
		token: "rounded-md",
		cssValue: "var(--radius-md)",
		label: "控件圆角 (radius-md)",
		multiplier: 0.8,
		description: "按钮、输入框、下拉选项与标准交互控件（0.8× 基准圆角）",
	},
	{
		token: "rounded-lg",
		cssValue: "var(--radius-lg)",
		label: "卡片标准圆角 (radius-lg)",
		multiplier: 1,
		description: "卡片容器、手风琴分组与弹出面板（1.0× 基准圆角）",
	},
	{
		token: "rounded-xl",
		cssValue: "var(--radius-xl)",
		label: "浮窗大圆角 (radius-xl)",
		multiplier: 1.4,
		description: "悬浮外壳面板、Dialog 与浮动二级菜单（1.4× 基准圆角）",
	},
	{
		token: "rounded-2xl",
		cssValue: "var(--radius-2xl)",
		label: "特大容器圆角 (radius-2xl)",
		multiplier: 1.8,
		description: "重点展示容器与认证卡片（1.8× 基准圆角）",
	},
	{
		token: "rounded-full",
		cssValue: "9999px",
		label: "全圆 / 胶囊 (rounded-full)",
		multiplier: 9999,
		description: "头像、胶囊徽章、状态圆点与悬浮时尚导航胶囊",
	},
];

export type SemanticShadowToken = {
	token: string;
	cssValue: string;
	label: string;
	description: string;
};

export const SHADOW_NONE_TOKEN: SemanticShadowToken = {
	token: "shadow-none",
	cssValue: "none",
	label: "无阴影（平面层）",
	description: "无投影，依靠底色或边框区分层次",
};

export const SEMANTIC_SHADOW_TOKENS: readonly SemanticShadowToken[] = [
	SHADOW_NONE_TOKEN,
	{
		token: "shadow-2xs",
		cssValue: "var(--shadow-2xs)",
		label: "微底线阴影 (shadow-2xs)",
		description: "极轻贴面层次，用于输入框与轻量按钮",
	},
	{
		token: "shadow-xs",
		cssValue: "var(--shadow-xs)",
		label: "轻触阴影 (shadow-xs)",
		description: "轻量交互控件与表单触发器微阴影",
	},
	{
		token: "shadow-sm",
		cssValue: "var(--shadow-sm)",
		label: "卡片常规阴影 (shadow-sm)",
		description: "卡片、悬浮工作区容器与导航胶囊标准投影",
	},
	{
		token: "shadow-md",
		cssValue: "var(--shadow-md)",
		label: "抬升浮层阴影 (shadow-md)",
		description: "二级悬浮卡片、Popover 与小型菜单投影",
	},
	{
		token: "shadow-lg",
		cssValue: "var(--shadow-lg)",
		label: "深浮层阴影 (shadow-lg)",
		description: "浮动对话框、下拉选单与高层浮窗",
	},
	{
		token: "shadow-xl",
		cssValue: "var(--shadow-xl)",
		label: "弹窗主阴影 (shadow-xl)",
		description: "浮动二级菜单、色盘弹层与模态 Dialog",
	},
	{
		token: "shadow-2xl",
		cssValue: "var(--shadow-2xl)",
		label: "最高层级阴影 (shadow-2xl)",
		description: "全屏命令面板与最高层提示浮窗",
	},
];

/** 组件 data-slot 的中文语义字典（覆盖全仓共享 UI 与业务槽位）。 */
export const SEMANTIC_SLOT_LABELS: Readonly<
	Record<string, { label: string; category: string }>
> = {
	"workspace-header": { label: "工作区顶栏", category: "工作台布局" },
	"workspace-title": { label: "模块页面标题", category: "工作台布局" },
	"workspace-menu": { label: "二级导航菜单", category: "工作台布局" },
	"app-logo-mark": { label: "应用品牌标识", category: "工作台布局" },
	"account-directory-scroll": { label: "账户目录滚动区", category: "资金分析" },
	button: { label: "交互按钮", category: "基础控件" },
	input: { label: "文本输入框", category: "表单控件" },
	"input-group": { label: "复合输入组", category: "表单控件" },
	"input-group-control": { label: "输入组控件", category: "表单控件" },
	"input-group-addon": { label: "输入组附加区", category: "表单控件" },
	"search-input": { label: "检索输入框", category: "表单控件" },
	textarea: { label: "多行文本域", category: "表单控件" },
	"native-select": { label: "原生下拉框", category: "表单控件" },
	checkbox: { label: "复选框", category: "表单控件" },
	"checkbox-indicator": { label: "复选框勾选标记", category: "表单控件" },
	"radio-group": { label: "单选分组", category: "表单控件" },
	"radio-group-item": { label: "单选项", category: "表单控件" },
	"radio-group-indicator": { label: "单选选中圆点", category: "表单控件" },
	slider: { label: "滑动条控件", category: "表单控件" },
	"slider-track": { label: "滑动条轨道", category: "表单控件" },
	"slider-range": { label: "滑动条已选轨", category: "表单控件" },
	"slider-thumb": { label: "滑动条滑块", category: "表单控件" },
	"select-trigger": { label: "下拉选择触发器", category: "表单控件" },
	"select-content": { label: "下拉选择面板", category: "弹层组件" },
	"select-group": { label: "下拉选项分组", category: "弹层组件" },
	"select-item": { label: "下拉选项", category: "弹层组件" },
	"select-label": { label: "下拉分组标题", category: "弹层组件" },
	"select-separator": { label: "下拉分隔线", category: "弹层组件" },
	"select-scroll-up-button": { label: "下拉向上滚动键", category: "弹层组件" },
	"select-scroll-down-button": {
		label: "下拉向下滚动键",
		category: "弹层组件",
	},
	"select-value": { label: "下拉当前值", category: "表单控件" },
	label: { label: "表单标签", category: "表单控件" },
	field: { label: "表单字段容器", category: "表单控件" },
	"field-content": { label: "字段内容区", category: "表单控件" },
	"field-label": { label: "字段标签", category: "表单控件" },
	"field-legend": { label: "字段集标题", category: "表单控件" },
	"field-description": { label: "字段说明", category: "表单控件" },
	"field-error": { label: "字段错误提示", category: "状态反馈" },
	"field-group": { label: "字段分组", category: "表单控件" },
	"field-set": { label: "字段集合", category: "表单控件" },
	"field-separator": { label: "字段分隔线", category: "表单控件" },
	"field-separator-content": { label: "字段分隔文字", category: "表单控件" },
	card: { label: "卡片容器", category: "表面容器" },
	"card-header": { label: "卡片头部", category: "表面容器" },
	"card-title": { label: "卡片标题", category: "表面容器" },
	"card-description": { label: "卡片描述", category: "表面容器" },
	"card-content": { label: "卡片正文", category: "表面容器" },
	"card-footer": { label: "卡片底部", category: "表面容器" },
	"card-action": { label: "卡片操作区", category: "表面容器" },
	tabs: { label: "页签容器", category: "导航切换" },
	"tabs-list": { label: "页签栏", category: "导航切换" },
	"tabs-trigger": { label: "页签按钮", category: "导航切换" },
	"tabs-content": { label: "页签内容区", category: "导航切换" },
	accordion: { label: "折叠手风琴", category: "表面容器" },
	"accordion-item": { label: "折叠分组项", category: "表面容器" },
	"accordion-trigger": { label: "折叠标题触发器", category: "表面容器" },
	"accordion-trigger-icon": { label: "折叠箭头图标", category: "表面容器" },
	"accordion-content": { label: "折叠展开区", category: "表面容器" },
	collapsible: { label: "可折叠容器", category: "表面容器" },
	"collapsible-trigger": { label: "折叠切换按钮", category: "基础控件" },
	"collapsible-content": { label: "折叠内容区", category: "表面容器" },
	dialog: { label: "对话框容器", category: "弹层组件" },
	"dialog-trigger": { label: "对话框触发按钮", category: "基础控件" },
	"dialog-portal": { label: "对话框传送门", category: "弹层组件" },
	"dialog-overlay": { label: "对话框遮罩层", category: "弹层组件" },
	"dialog-content": { label: "对话框主体", category: "弹层组件" },
	"dialog-header": { label: "对话框头部", category: "弹层组件" },
	"dialog-title": { label: "对话框标题", category: "弹层组件" },
	"dialog-description": { label: "对话框说明", category: "弹层组件" },
	"dialog-footer": { label: "对话框底栏", category: "弹层组件" },
	"dialog-close": { label: "对话框关闭按钮", category: "基础控件" },
	"floating-dialog-content": { label: "浮动编辑面板", category: "弹层组件" },
	popover: { label: "悬浮弹层容器", category: "弹层组件" },
	"popover-trigger": { label: "弹层触发按钮", category: "基础控件" },
	"popover-content": { label: "悬浮弹层", category: "弹层组件" },
	"popover-header": { label: "弹层头部", category: "弹层组件" },
	"popover-title": { label: "弹层标题", category: "弹层组件" },
	"popover-description": { label: "弹层说明", category: "弹层组件" },
	"hover-card": { label: "悬停速览容器", category: "弹层组件" },
	"hover-card-trigger": { label: "悬停速览触发器", category: "基础控件" },
	"hover-card-content": { label: "悬停速览卡", category: "弹层组件" },
	"hover-card-arrow": { label: "悬停速览箭头", category: "弹层组件" },
	tooltip: { label: "文字提示容器", category: "弹层组件" },
	"tooltip-provider": { label: "提示上下文", category: "弹层组件" },
	"tooltip-trigger": { label: "带提示按钮", category: "基础控件" },
	"tooltip-content": { label: "提示气泡", category: "弹层组件" },
	"tooltip-portal-container": { label: "提示气泡挂载层", category: "弹层组件" },
	sheet: { label: "抽屉容器", category: "弹层组件" },
	"sheet-trigger": { label: "抽屉触发按钮", category: "基础控件" },
	"sheet-portal": { label: "抽屉传送门", category: "弹层组件" },
	"sheet-overlay": { label: "抽屉遮罩层", category: "弹层组件" },
	"sheet-content": { label: "抽屉侧栏", category: "弹层组件" },
	"sheet-header": { label: "抽屉头部", category: "弹层组件" },
	"sheet-title": { label: "抽屉标题", category: "弹层组件" },
	"sheet-description": { label: "抽屉说明", category: "弹层组件" },
	"sheet-close": { label: "抽屉关闭按钮", category: "基础控件" },
	"dropdown-menu": { label: "下拉菜单容器", category: "弹层组件" },
	"dropdown-menu-trigger": { label: "下拉菜单触发按钮", category: "基础控件" },
	"dropdown-menu-portal": { label: "下拉菜单传送门", category: "弹层组件" },
	"dropdown-menu-content": { label: "下拉菜单", category: "弹层组件" },
	"dropdown-menu-group": { label: "下拉菜单分组", category: "弹层组件" },
	"dropdown-menu-label": { label: "下拉分组标题", category: "弹层组件" },
	"dropdown-menu-item": { label: "下拉菜单项", category: "弹层组件" },
	"dropdown-menu-checkbox-item": { label: "下拉复选项", category: "弹层组件" },
	"dropdown-menu-checkbox-item-indicator": {
		label: "下拉复选标记",
		category: "弹层组件",
	},
	"dropdown-menu-radio-group": { label: "下拉单选组", category: "弹层组件" },
	"dropdown-menu-radio-item": { label: "下拉单选项", category: "弹层组件" },
	"dropdown-menu-radio-item-indicator": {
		label: "下拉单选标记",
		category: "弹层组件",
	},
	"dropdown-menu-separator": { label: "下拉菜单分隔线", category: "弹层组件" },
	"dropdown-menu-shortcut": { label: "菜单快捷键标注", category: "弹层组件" },
	"dropdown-menu-sub": { label: "二级子菜单", category: "弹层组件" },
	"dropdown-menu-sub-trigger": { label: "子菜单展开项", category: "弹层组件" },
	"dropdown-menu-sub-content": { label: "子菜单面板", category: "弹层组件" },
	"context-menu-content": { label: "右键菜单", category: "弹层组件" },
	"context-menu-item": { label: "右键菜单项", category: "弹层组件" },
	"context-menu-separator": { label: "右键菜单分隔线", category: "弹层组件" },
	"context-menu-sub-trigger": { label: "右键子菜单项", category: "弹层组件" },
	"context-menu-sub-content": { label: "右键子菜单面板", category: "弹层组件" },
	"scroll-area": { label: "滚动容器", category: "布局容器" },
	"scroll-area-viewport": { label: "滚动视口", category: "布局容器" },
	"scroll-area-content": { label: "滚动内容区", category: "布局容器" },
	"scroll-area-scrollbar": { label: "自定义滚动条", category: "布局容器" },
	"scroll-area-thumb": { label: "滚动条滑块", category: "布局容器" },
	"resizable-panel-group": { label: "可调分栏容器", category: "布局容器" },
	"resizable-panel": { label: "可调分栏面板", category: "布局容器" },
	"resizable-handle": { label: "分栏拖拽柄", category: "布局容器" },
	"sortable-item": { label: "可拖拽排序项", category: "布局容器" },
	separator: { label: "语义分隔线", category: "基础装饰" },
	avatar: { label: "用户头像", category: "信息展示" },
	"avatar-image": { label: "头像图片", category: "信息展示" },
	"avatar-fallback": { label: "头像文字占位", category: "信息展示" },
	badge: { label: "状态徽章", category: "状态反馈" },
	"avatar-badge": { label: "头像状态角标", category: "信息展示" },
	"avatar-group": { label: "头像组", category: "信息展示" },
	"avatar-group-count": { label: "头像组计数", category: "信息展示" },
	"copy-text": { label: "可复制文本", category: "信息展示" },
	"menu-label": { label: "目录自适应标签", category: "导航切换" },
	tree: { label: "树形目录", category: "导航切换" },
	"tree-item": { label: "目录节点", category: "导航切换" },
	"tree-item-label": { label: "目录节点行", category: "导航切换" },
	"tree-item-toggle": { label: "目录展开箭头", category: "导航切换" },
	"tree-drag-line": { label: "目录拖拽落位线", category: "导航切换" },
	table: { label: "标准数据表", category: "数据展示" },
	"table-container": { label: "数据表滚动容器", category: "数据展示" },
	"table-header": { label: "表头区", category: "数据展示" },
	"table-body": { label: "表体区", category: "数据展示" },
	"table-head": { label: "表头列单元格", category: "数据展示" },
	"table-row": { label: "表格数据行", category: "数据展示" },
	"table-cell": { label: "表格单元格", category: "数据展示" },
	"table-footer": { label: "表格汇总行", category: "数据展示" },
	"table-caption": { label: "表格说明标题", category: "数据展示" },
	command: { label: "命令面板", category: "弹层组件" },
	"command-input-wrapper": { label: "命令搜索栏", category: "弹层组件" },
	"command-input": { label: "命令搜索框", category: "弹层组件" },
	"command-list": { label: "命令结果列表", category: "弹层组件" },
	"command-empty": { label: "命令空结果提示", category: "弹层组件" },
	"command-group": { label: "命令分组", category: "弹层组件" },
	"command-item": { label: "命令条目", category: "弹层组件" },
	"command-separator": { label: "命令分隔线", category: "弹层组件" },
	"command-shortcut": { label: "命令快捷键", category: "弹层组件" },
	calendar: { label: "日期选择器", category: "表单控件" },
	"color-picker-panel": { label: "调色盘面板", category: "颜色控件" },
	"color-picker-area": { label: "调色盘色域区", category: "颜色控件" },
	"color-picker-area-thumb": { label: "色域选点", category: "颜色控件" },
	"color-picker-wheel": { label: "色相色轮", category: "颜色控件" },
	"color-picker-wheel-track": { label: "色轮轨道", category: "颜色控件" },
	"color-picker-wheel-thumb": { label: "色轮选点", category: "颜色控件" },
	"color-picker-slider": { label: "颜色滑轨", category: "颜色控件" },
	"color-picker-slider-thumb": { label: "颜色滑块", category: "颜色控件" },
	"color-picker-swatch": { label: "当前颜色块", category: "颜色控件" },
	"color-picker-swatches": { label: "预设色块组", category: "颜色控件" },
	"color-picker-swatch-item": { label: "预设色块", category: "颜色控件" },
	"color-picker-fields": { label: "色值输入字段组", category: "颜色控件" },
	"color-picker-field": { label: "色值通道字段", category: "颜色控件" },
	"color-picker-input": { label: "色值输入框", category: "颜色控件" },
	"color-picker-value": { label: "色值显示文本", category: "颜色控件" },
	"color-picker-copy": { label: "复制色值按钮", category: "颜色控件" },
	"color-picker-clear": { label: "清空颜色按钮", category: "颜色控件" },
	"color-picker-eye-dropper": { label: "屏幕取色器按钮", category: "颜色控件" },
	"time-picker-field": { label: "时间选择字段", category: "表单控件" },
	"time-picker-input": { label: "时间输入框", category: "表单控件" },
	"time-picker-value": { label: "时间显示值", category: "表单控件" },
	"time-picker-clear": { label: "清空时间按钮", category: "表单控件" },
	"time-picker-panel": { label: "时间选择面板", category: "弹层组件" },
	"time-picker-columns": { label: "时间分列区", category: "弹层组件" },
	"time-picker-column": { label: "时间选择列", category: "弹层组件" },
	"time-picker-column-label": { label: "时间列标题", category: "弹层组件" },
	"time-picker-column-list": { label: "时间选项列表", category: "弹层组件" },
	"time-picker-option": { label: "时间选项", category: "弹层组件" },
	"time-picker-footer": { label: "时间面板底栏", category: "弹层组件" },
	"time-picker-now": { label: "此刻快捷按钮", category: "基础控件" },
	"time-picker-confirm": { label: "确认时间按钮", category: "基础控件" },
};

export const PROJECT_CLASS_LABELS: readonly {
	className: string;
	label: string;
	category: string;
}[] = [
	{
		className: "workspace-shell",
		label: "工作台外框容器",
		category: "工作台布局",
	},
	{ className: "workspace-rail", label: "主导航侧栏", category: "工作台布局" },
	{
		className: "workspace-rail-pill",
		label: "悬浮时尚导航胶囊",
		category: "工作台布局",
	},
	{
		className: "workspace-nav-item",
		label: "主导航图标项",
		category: "工作台布局",
	},
	{
		className: "workspace-content",
		label: "工作区正文主容器",
		category: "工作台布局",
	},
	{ className: "lg-root", label: "虚拟表格根容器", category: "虚拟网格" },
	{ className: "lg-toolbar", label: "表格工具栏", category: "虚拟网格" },
	{ className: "lg-sheet", label: "表格主体画布", category: "虚拟网格" },
	{ className: "lg-group-cell", label: "表格分组表头", category: "虚拟网格" },
	{ className: "lg-header-cell", label: "表格列标题格", category: "虚拟网格" },
	{ className: "lg-row", label: "表格数据行", category: "虚拟网格" },
	{ className: "lg-cell", label: "表格数据单元格", category: "虚拟网格" },
	{ className: "lg-row-num", label: "表格行号单元格", category: "虚拟网格" },
	{
		className: "lg-summary-row",
		label: "表格底部汇总行",
		category: "虚拟网格",
	},
	{
		className: "lg-summary-cell",
		label: "表格汇总单元格",
		category: "虚拟网格",
	},
	{
		className: "funds-graph-toolbar",
		label: "资金图谱工具栏",
		category: "资金分析",
	},
];

export const HTML_TAG_SEMANTICS: Readonly<
	Record<string, { label: string; category: string }>
> = {
	header: { label: "页头地标", category: "结构地标" },
	main: { label: "主内容区", category: "结构地标" },
	aside: { label: "侧边栏区域", category: "结构地标" },
	nav: { label: "导航区域", category: "结构地标" },
	footer: { label: "页脚区域", category: "结构地标" },
	section: { label: "内容分区", category: "结构容器" },
	article: { label: "独立内容块", category: "结构容器" },
	form: { label: "表单容器", category: "表单控件" },
	button: { label: "交互按钮", category: "基础控件" },
	a: { label: "链接元素", category: "导航切换" },
	input: { label: "输入控件", category: "表单控件" },
	textarea: { label: "多行输入", category: "表单控件" },
	select: { label: "原生选择框", category: "表单控件" },
	label: { label: "标签文字", category: "表单控件" },
	h1: { label: "一级主标题", category: "标题排版" },
	h2: { label: "二级标题", category: "标题排版" },
	h3: { label: "三级标题", category: "标题排版" },
	h4: { label: "四级标题", category: "标题排版" },
	p: { label: "段落文本", category: "正文排版" },
	span: { label: "行内文本 / 标签", category: "正文排版" },
	div: { label: "布局块容器", category: "布局容器" },
	ul: { label: "无序列表", category: "列表结构" },
	ol: { label: "有序列表", category: "列表结构" },
	li: { label: "列表条目", category: "列表结构" },
	table: { label: "数据表格", category: "数据展示" },
	thead: { label: "表头区域", category: "数据展示" },
	tbody: { label: "表体区域", category: "数据展示" },
	tr: { label: "表格行", category: "数据展示" },
	th: { label: "表头格", category: "数据展示" },
	td: { label: "数据格", category: "数据展示" },
	svg: { label: "矢量图标 / 图形", category: "图标图形" },
	canvas: { label: "图形画布", category: "图标图形" },
	img: { label: "图片元素", category: "媒体元素" },
};
