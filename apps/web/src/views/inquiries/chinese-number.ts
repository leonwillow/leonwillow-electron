/**
 * @file 将次数和页码转换为中文大写数字。
 * 创建时间：2026-11-04；修改时间：2026-11-18。
 * 版本作用：直接复用无框架依赖的页码/次数中文大写格式化函数。
 * 被调用：笔录编辑器及 A4 预览；调用：标准 JavaScript。
 * 预期结果：无效输入安全回退，保持原项目边界行为。
 */
const UPPER_DIGITS = [
	"零",
	"壹",
	"贰",
	"叁",
	"肆",
	"伍",
	"陆",
	"柒",
	"捌",
	"玖",
];
const UPPER_UNITS = ["", "拾", "佰", "仟"];

function toChineseUnderTenThousand(value: number) {
	if (value === 0) return UPPER_DIGITS[0] ?? "零";
	let result = "";
	let pendingZero = false;

	for (let position = 3; position >= 0; position -= 1) {
		const divisor = 10 ** position;
		const digit = Math.floor(value / divisor) % 10;
		if (digit === 0) {
			if (result && value % divisor !== 0) pendingZero = true;
			continue;
		}
		if (pendingZero) {
			result += UPPER_DIGITS[0];
			pendingZero = false;
		}
		result += UPPER_DIGITS[digit];
		result += UPPER_UNITS[position];
	}

	return result;
}

function normalizePageNumber(value: number) {
	const normalized = Math.floor(Number(value));
	return Number.isFinite(normalized) && normalized >= 0 ? normalized : 0;
}

export function toChineseUpperNumber(value: number) {
	const normalized = normalizePageNumber(value);
	if (normalized >= 10000) return String(normalized);
	return toChineseUnderTenThousand(normalized);
}
