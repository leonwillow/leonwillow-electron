/**
 * @file 增值税所属期日期与旧月度记录兼容规则。
 * 创建时间：2026-11-06；修改时间：2026-11-06。
 * 版本作用：用实际起止日期描述期间，稳定行 ID 不随日期变化。
 * 被调用：领域计算、导入及表格适配；无运行时外部依赖。
 * 预期结果：允许未填日期的持久化空行，拒绝无效日期、倒置和重叠期间。
 */
export type PeriodDates = { periodStart: string; periodEnd: string };

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
