/**
 * @file 按询问日期及居民身份证出生日期计算年龄。
 * 创建时间：2026-11-04；修改时间：2026-11-04。
 * 版本作用：直接复用 haoji 的纯函数，无框架依赖。
 * 被调用：笔录编辑器及预览；调用：标准 JavaScript。
 * 预期结果：无效输入安全回退，保持原项目边界行为。
 */
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAINLAND_ID_18_PATTERN = /^\d{17}[\dX]$/i;
const MAINLAND_ID_15_PATTERN = /^\d{15}$/;

function parseDateParts(value: string) {
	const match = DATE_PATTERN.exec(value);
	if (!match) return null;

	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const date = new Date(year, month - 1, day);

	if (
		date.getFullYear() !== year ||
		date.getMonth() !== month - 1 ||
		date.getDate() !== day
	)
		return null;
	return { year, month, day };
}

function getBirthDateFromMainlandId(idNumber: string) {
	const normalized = idNumber.trim();
	let birthDate = "";

	if (MAINLAND_ID_18_PATTERN.test(normalized)) {
		birthDate = normalized.slice(6, 14);
	} else if (MAINLAND_ID_15_PATTERN.test(normalized)) {
		birthDate = `19${normalized.slice(6, 12)}`;
	} else {
		return null;
	}

	return parseDateParts(
		`${birthDate.slice(0, 4)}-${birthDate.slice(4, 6)}-${birthDate.slice(6, 8)}`,
	);
}

export function calculateSubjectAge(
	inquiryDate: string | null,
	idType: string,
	idNumber: string,
) {
	if (idType !== "居民身份证" || !inquiryDate) return "";

	const inquiry = parseDateParts(inquiryDate);
	const birth = getBirthDateFromMainlandId(idNumber);
	if (!inquiry || !birth) return "";

	let age = inquiry.year - birth.year;
	const beforeBirthday =
		inquiry.month < birth.month ||
		(inquiry.month === birth.month && inquiry.day < birth.day);
	if (beforeBirthday) age -= 1;

	return age >= 0 && age <= 150 ? String(age) : "";
}
