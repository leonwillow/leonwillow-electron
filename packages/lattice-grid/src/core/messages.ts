/**
 * @file Lattice Grid messages：泛型表格数据与事务内核。
 * 创建时间：2026-11-05；修改时间：2026-11-05。
 * 版本作用：适配 MIT Lattice Grid 0.1.0-beta.1，保留原始行标识、不可变事务与数据隔离。
 * 被调用：独立表格包的 React 视图；调用：包内核心模块，不依赖业务、数据库或路由。
 * 预期结果：多个表格实例独立工作，外部数据和提交由调用页面管理。
 */
import type { Messages } from "./types";
export const enUS: Messages = {
	search: "Search",
	rows: "rows",
	filter: "Filter",
	columns: "Columns",
	export: "Export",
	undo: "Undo",
	redo: "Redo",
	density: "Row density",
	compact: "Compact",
	standard: "Standard",
	comfortable: "Comfortable",
	empty: "No rows yet",
	noResults: "No matching rows",
	loading: "Loading rows…",
	retry: "Try again",
	count: "Count",
	sum: "Sum",
	avg: "Avg",
	selectAll: "Select all visible rows",
	selectRow: "Select row",
	selected: "selected",
	delete: "Delete rows",
	clearSelection: "Clear selection",
	pin: "Pin column",
	unpin: "Unpin column",
	hide: "Hide column",
	sortAscending: "Sort ascending",
	sortDescending: "Sort descending",
	clearSort: "Clear sort",
	moveLeft: "Move left",
	moveRight: "Move right",
	allColumnsHidden: "All columns are hidden",
	showAll: "Show all columns",
	resetView: "Reset view",
	save: "Save",
	cancel: "Cancel",
	saving: "Saving…",
	copied: "Copied",
	copy: "Copy",
	resize: "Resize",
	close: "Close",
	all: "All",
	readOnly: "Read only",
	loaded: "loaded",
	keyboardHelp:
		"Arrow keys navigate cells. Shift extends selection. Enter edits. Escape cancels. Control or Command C and V copy and paste. Shift Space selects a row.",
	clipboardUnavailable: "Clipboard unavailable. Use Ctrl/Cmd+C.",
};
export const zhCN: Messages = {
	search: "搜索",
	rows: "行",
	filter: "筛选",
	columns: "列",
	export: "导出",
	undo: "撤销",
	redo: "重做",
	density: "行高",
	compact: "紧凑",
	standard: "标准",
	comfortable: "宽松",
	empty: "暂无数据",
	noResults: "没有符合条件的数据",
	loading: "正在加载…",
	retry: "重试",
	count: "计数",
	sum: "合计",
	avg: "均值",
	selectAll: "选择当前全部行",
	selectRow: "选择行",
	selected: "已选",
	delete: "删除所选行",
	clearSelection: "取消选择",
	pin: "固定列",
	unpin: "取消固定",
	hide: "隐藏列",
	sortAscending: "升序",
	sortDescending: "降序",
	clearSort: "清除排序",
	moveLeft: "向左移动",
	moveRight: "向右移动",
	allColumnsHidden: "所有列均已隐藏",
	showAll: "显示全部列",
	resetView: "重置视图",
	save: "保存",
	cancel: "取消",
	saving: "正在保存…",
	copied: "已复制",
	copy: "复制",
	resize: "调整宽度",
	close: "关闭",
	all: "全部",
	readOnly: "只读",
	loaded: "已加载",
	keyboardHelp:
		"方向键移动，Shift 扩展选区，回车编辑，Escape 取消。Ctrl 或 Command 加 C、V 复制粘贴，Shift 加空格选择当前行。",
	clipboardUnavailable: "无法访问剪贴板，请按 Ctrl/Cmd+C 复制。",
};

const builtInErrors: Readonly<Record<string, string>> = {
	"getRowId must return unique, non-empty strings.":
		"每行必须使用唯一且非空的标识。",
	"Columns require unique, safe IDs and fields.":
		"列标识和字段名必须唯一且有效。",
	"Use true or false.": "请选择“是”或“否”。",
	"Unclosed quoted field.": "粘贴内容中的引号未闭合，请检查后重试。",
	"Another transaction is pending.": "正在处理上一项修改，请稍后重试。",
	"This grid is read-only.": "当前表格只读，不能修改。",
	"The edited row or column no longer exists.":
		"要编辑的行或列已不存在，请重新选择。",
	"Edits cannot change row identity.": "修改内容不能改变行标识。",
	"Cell no longer exists.": "该单元格已不存在，请重新选择。",
	"Select a cell before pasting.": "请先选择要粘贴的单元格。",
	"The paste exceeds the visible table. No cells were changed.":
		"粘贴范围超出了当前表格，尚未修改任何单元格。",
	"The paste exceeds the visible table.": "粘贴范围超出了当前表格。",
	"Paste is limited to 100,000 cells per transaction.":
		"一次最多粘贴 100,000 个单元格。",
	"Insert index is outside the data.": "插入位置超出了当前数据范围。",
	"Row deletion is disabled.": "当前不允许删除行。",
	"Wait until data is available before changing it.":
		"请等待数据加载完成后再修改。",
	"Data changed during validation.": "校验期间数据已更新，请重新编辑。",
	"Data changed during saving.": "保存期间数据已更新，本次修改已取消。",
	"Transaction canceled.": "本次修改已取消。",
	"History cell no longer exists.": "撤销记录对应的单元格已不存在。",
};
const builtInColumnErrors = [
	[/^([\s\S]+) is required\.$/, "$1不能为空。"],
	[/^([\s\S]+) is read-only\.$/, "$1为只读列，不能修改。"],
	[/^([\s\S]+): enter a finite number\.$/, "$1：请输入有效数字。"],
	[/^([\s\S]+): enter a whole number\.$/, "$1：请输入整数。"],
	[
		/^([\s\S]+): minimum (-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)\.$/i,
		"$1：不能小于 $2。",
	],
	[
		/^([\s\S]+): maximum (-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)\.$/i,
		"$1：不能大于 $2。",
	],
	[/^([\s\S]+): use true or false\.$/, "$1：请选择“是”或“否”。"],
	[/^([\s\S]+): choose a listed option\.$/, "$1：请选择列表中的选项。"],
	[
		/^([\s\S]+): use a valid YYYY-MM-DD date\.$/,
		"$1：请输入有效日期，格式为 YYYY-MM-DD。",
	],
] as const;

/**
 * 为中文界面转换本库内置错误；未知业务/服务端文案逐字保留。
 * @param message 内核错误信息，也接受浏览器异常的 Error: 前缀。
 * @param locale 只对中文语言启用转换；宿主 formatError 可完全覆盖此默认策略。
 */
export function formatGridError(message: string, locale = "zh-CN"): string {
	if (!/^zh(?:-|$)/i.test(locale)) return message;
	const text = message.startsWith("Error: ") ? message.slice(7) : message;
	const builtIn = Object.hasOwn(builtInErrors, text)
		? builtInErrors[text]
		: undefined;
	if (builtIn) return builtIn;
	for (const [pattern, replacement] of builtInColumnErrors) {
		if (pattern.test(text)) return text.replace(pattern, replacement);
	}
	return message;
}
