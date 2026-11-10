/**
 * @file 增值税所属期日期与旧月度记录兼容规则。
 * 创建时间：2026-11-06；修改时间：2026-11-08。
 * 版本作用：用实际起止日期描述期间，稳定行 ID 不随日期变化。
 * 被调用：领域计算、导入及表格适配；无运行时外部依赖。
 * 预期结果：允许未填日期的持久化空行，拒绝无效日期、倒置和重叠期间。
 */
export type PeriodDates = { periodStart: string; periodEnd: string };
export type ReportingPeriod = {
	cycle: "monthly" | "quarterly";
	year: number;
	/** 月报为 1—12，季报为 1—4。 */
	index: number;
};

/** 将自然月或自然季度展开为真实日期；不接受越界年份、月份或季度。 */
export function reportingPeriodDates(period: ReportingPeriod): PeriodDates {
	const { cycle, year, index } = period;
	if (!Number.isInteger(year) || year < 1900 || year > 2199)
		throw Error("所属期年份须为1900—2199年");
	const limit = cycle === "monthly" ? 12 : cycle === "quarterly" ? 4 : 0;
	if (!Number.isInteger(index) || index < 1 || index > limit)
		throw Error("所属期月份或季度无效");
	const month = cycle === "monthly" ? index : (index - 1) * 3 + 1;
	const lastMonth = cycle === "monthly" ? month : month + 2;
	return {
		periodStart: `${year}-${String(month).padStart(2, "0")}-01`,
		periodEnd: new Date(Date.UTC(year, lastMonth, 0))
			.toISOString()
			.slice(0, 10),
	};
}

/** 仅识别完整自然月/季；历史非标准范围及未完成日期返回 null，绝不截断或改写。 */
export function reportingPeriod(row: PeriodDates): ReportingPeriod | null {
	if (!row.periodStart || !row.periodEnd) return null;
	const year = Number(row.periodStart.slice(0, 4));
	const month = Number(row.periodStart.slice(5, 7));
	if (
		!Number.isInteger(year) ||
		year < 1900 ||
		year > 2199 ||
		!Number.isInteger(month) ||
		month < 1 ||
		month > 12
	)
		return null;
	for (const cycle of ["monthly", "quarterly"] as const) {
		const candidate = {
			cycle,
			year,
			index: cycle === "monthly" ? month : Math.ceil(month / 3),
		};
		const dates = reportingPeriodDates(candidate);
		if (
			dates.periodStart === row.periodStart &&
			dates.periodEnd === row.periodEnd
		)
			return candidate;
	}
	return null;
}

export function reportingPeriodLabel(row: PeriodDates) {
	const period = reportingPeriod(row);
	if (period)
		return period.cycle === "monthly"
			? `${period.year}年${period.index}月`
			: `${period.year}年第${period.index}季度`;
	return !row.periodStart && !row.periodEnd ? "选择所属期" : periodLabel(row);
}

export function periodDate(value: unknown, allowEmpty = false): string {
	const text = String(value ?? "").trim();
	if (!text && allowEmpty) return "";
	if (!/^(19\d{2}|20\d{2}|21\d{2})-\d{2}-\d{2}$/.test(text))
		throw Error("所属期日期须为1900—2199年的有效日期");
	const date = new Date(`${text}T00:00:00Z`);
	if (
		!Number.isFinite(date.getTime()) ||
		date.toISOString().slice(0, 10) !== text
	)
		throw Error("所属期日期无效");
	return text;
}

export function legacyPeriod(month: string): PeriodDates {
	const periodStart = periodDate(`${month}-01`);
	const last = new Date(
		Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0),
	);
	return { periodStart, periodEnd: last.toISOString().slice(0, 10) };
}

export function nextDate(date: string) {
	const value = new Date(`${date}T00:00:00Z`);
	value.setUTCDate(value.getUTCDate() + 1);
	return value.toISOString().slice(0, 10);
}

export function periodLabel(row: PeriodDates) {
	return `${row.periodStart || "待选起日"} 至 ${row.periodEnd || "待选止日"}`;
}

export function validatePeriods(rows: readonly PeriodDates[]) {
	for (const row of rows) {
		periodDate(row.periodStart, true);
		periodDate(row.periodEnd, true);
		if (row.periodStart && row.periodEnd && row.periodStart > row.periodEnd)
			throw Error("所属期起不能晚于所属期止");
	}
	const complete = rows
		.filter((r) => r.periodStart && r.periodEnd)
		.toSorted((a, b) => a.periodStart.localeCompare(b.periodStart));
	for (let n = 1; n < complete.length; n++) {
		const previous = complete[n - 1];
		const current = complete[n];
		if (previous && current && current.periodStart <= previous.periodEnd)
			throw Error(
				`所属期重叠：${periodLabel(previous)} 与 ${periodLabel(current)}`,
			);
	}
}
