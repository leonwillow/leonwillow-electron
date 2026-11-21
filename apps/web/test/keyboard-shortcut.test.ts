/**
 * @file 全局快捷键冲突避让判定的单元测试。
 * 创建时间：2026-11-20；修改时间：2026-11-20。
 * 版本作用：当前行为的回归约束，不进入产品构建。
 * 被调用：Bun 测试命令、test:ui。
 * 调用：bun:test、../src/lib/keyboard-shortcut。
 * 功能：验证已消费事件、IME 组合态及输入框/表格/下拉组件节点下正确放行局部快捷键。
 * 预期结果：普通工作区容器放行，表格与输入控件内屏蔽全局触发。
 */
import { expect, test } from "bun:test";
import { shouldIgnoreGlobalShortcut } from "../src/lib/keyboard-shortcut";

const targetWithSelector = (
	matched: string | null,
	isContentEditable = false,
) =>
	({
		isContentEditable,
		closest: (selector: string) =>
			matched && selector.includes(matched) ? {} : null,
	}) as unknown as EventTarget;

test("已阻止事件或输入法组合期必须忽略全局快捷键", () => {
	expect(
		shouldIgnoreGlobalShortcut({
			defaultPrevented: true,
			isComposing: false,
			target: targetWithSelector(null),
		}),
	).toBe(true);
	expect(
		shouldIgnoreGlobalShortcut({
			defaultPrevented: false,
			isComposing: true,
			target: targetWithSelector(null),
		}),
	).toBe(true);
});

test("原生表单、富文本及虚拟表格与交互控件祖先阻止全局快捷键", () => {
	for (const selector of [
		"input",
		"textarea",
		"select",
		'[role="grid"]',
		'[role="textbox"]',
		'[role="combobox"]',
		'[role="listbox"]',
	]) {
		expect(
			shouldIgnoreGlobalShortcut({
				defaultPrevented: false,
				isComposing: false,
				target: targetWithSelector(selector),
			}),
		).toBe(true);
	}
	expect(
		shouldIgnoreGlobalShortcut({
			defaultPrevented: false,
			isComposing: false,
			target: targetWithSelector(null, true),
		}),
	).toBe(true);
});

test("普通工作区容器与非交互区域允许触发全局快捷键", () => {
	expect(
		shouldIgnoreGlobalShortcut({
			defaultPrevented: false,
			isComposing: false,
			target: targetWithSelector(null, false),
		}),
	).toBe(false);
	expect(
		shouldIgnoreGlobalShortcut({
			defaultPrevented: false,
			isComposing: false,
			target: null,
		}),
	).toBe(false);
});
