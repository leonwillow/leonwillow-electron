/**
 * @file 将次数和页码转换为中文数字。
 * 创建时间：2026-11-04；修改时间：2026-11-04。
 * 版本作用：直接复用 haoji 的纯函数，无框架依赖。
 * 被调用：笔录编辑器及预览；调用：标准 JavaScript。
 * 预期结果：无效输入安全回退，保持原项目边界行为。
 */
const LOWER_DIGITS = [
	"零",
	"一",
	"二",
	"三",
	"四",
	"五",
	"六",
	"七",
	"八",
	"九",
];
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
const LOWER_UNITS = ["", "十", "百", "千"];
const UPPER_UNITS = ["", "拾", "佰", "仟"];

function toChineseUnderTenThousand(
	value: number,
	digits: string[],
	units: string[],
	omitLeadingOne: boolean,
) {
	if (value === 0) return digits[0] ?? "零";
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
			result += digits[0];
			pendingZero = false;
		}
		const omitDigit =
			omitLeadingOne && digit === 1 && position === 1 && !result;
		if (!omitDigit) result += digits[digit];
		result += units[position];
	}

	return result;
}

function normalizePageNumber(value: number) {
	const normalized = Math.floor(Number(value));
	return Number.isFinite(normalized) && normalized >= 0 ? normalized : 0;
}

export function toChineseLowerNumber(value: number) {
	const normalized = normalizePageNumber(value);
	if (normalized >= 10000) return String(normalized);
	return toChineseUnderTenThousand(normalized, LOWER_DIGITS, LOWER_UNITS, true);
}

export function toChineseUpperNumber(value: number) {
	const normalized = normalizePageNumber(value);
	if (normalized >= 10000) return String(normalized);
	return toChineseUnderTenThousand(
		normalized,
		UPPER_DIGITS,
		UPPER_UNITS,
		false,
	);
}
