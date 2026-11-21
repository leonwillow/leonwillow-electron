/**
 * @file 全局工作台快捷键的输入目标与拦截判定。
 * 创建时间：2026-11-20；修改时间：2026-11-20。
 * 版本作用：为全局明暗切换和命令面板快捷键提供统一的冲突避让规则。
 * 被调用：components/layout/theme-effects.tsx、components/layout/command-menu.tsx、apps/web/test/keyboard-shortcut.test.ts。
 * 调用：浏览器 DOM KeyboardEvent 接口。
 * 功能：阻止组合键、已消费事件以及可编辑/网格/下拉控件内的按键触发全站快捷键。
 * 预期结果：用户在表格单元格、输入框或输入法组合期键入 `/` 或 `d` 不会被全局面板打断。
 */
const INTERACTIVE_TEXT_SELECTOR =
	'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="grid"], [role="textbox"], [role="combobox"], [role="listbox"]';

type ShortcutTarget = {
	isContentEditable?: boolean;
	closest?: (selector: string) => unknown;
};

/**
 * 判断键盘事件是否应在可编辑控件、虚拟表格或输入法组合阶段让位于局部输入。
 * @param event DOM KeyboardEvent（或测试构造的最小事件快照）。
 * @returns 返回 true 时全局快捷键必须忽略此次按键。
 */
export function shouldIgnoreGlobalShortcut(
	event: Pick<KeyboardEvent, "defaultPrevented" | "isComposing" | "target">,
): boolean {
	if (event.defaultPrevented || event.isComposing) return true;
	const target = event.target as ShortcutTarget | null;
	if (!target || typeof target !== "object") return false;
	if (target.isContentEditable) return true;
	if (typeof target.closest === "function") {
		return target.closest(INTERACTIVE_TEXT_SELECTOR) !== null;
	}
	return false;
}
