/**
 * @file ReUI 时间选择器值解析和中文输入的边界测试。
 * 创建时间：2026-11-04；修改时间：2026-11-04。
 * 版本作用：验证 24 小时存储与可输入时间控件的格式契约。
 * 被调用：Bun test；调用：共享 TimePicker 的纯函数。
 * 预期结果：时间边界、分钟精度及中文时段不会产生错误小时或时区转换。
 */
import { expect, test } from "bun:test";
import {
	formatTimeValue,
	mergeTimePickerI18n,
	parseTimeInput,
	parseTimeValue,
} from "../src/components/time-picker";

test("时间值保留午夜、分钟与秒精度，拒绝越界值", () => {
	expect(parseTimeValue("00:00")).toEqual({ hour: 0, minute: 0, second: 0 });
	expect(parseTimeValue("23:59")).toEqual({ hour: 23, minute: 59, second: 0 });
	for (const value of ["", "24:00", "08:60", "08:15:60", "invalid"])
		expect(parseTimeValue(value)).toBeNull();
	expect(formatTimeValue({ hour: 7, minute: 4, second: 30 })).toBe("07:04");
	expect(formatTimeValue({ hour: 7, minute: 4, second: 30 }, "second")).toBe(
		"07:04:30",
	);
});

test("手输时间支持简写、全角数字和中文时段，标签覆盖保留中文默认值", () => {
	for (const value of ["930", "09:30", "０９：３０"])
		expect(parseTimeInput(value)).toEqual({ hour: 9, minute: 30, second: 0 });
	expect(parseTimeInput("下午2:30")).toEqual({
		hour: 14,
		minute: 30,
		second: 0,
	});
	expect(parseTimeInput("上午12:00")).toEqual({
		hour: 0,
		minute: 0,
		second: 0,
	});
	expect(parseTimeInput("下午12:00")).toEqual({
		hour: 12,
		minute: 0,
		second: 0,
	});
	expect(parseTimeInput("25:00")).toBeNull();
	expect(parseTimeInput("9:99")).toBeNull();
	const labels = mergeTimePickerI18n({
		labels: { openPicker: "选择开始时间" },
	}).labels;
	expect(labels.openPicker).toBe("选择开始时间");
	expect(labels.clear).toBe("清空");
});
