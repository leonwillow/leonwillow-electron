/**
 * @file 税务导出表的纯文本解析，不执行导入内容。
 * 创建时间：2026-11-05；修改时间：2026-11-08。
 * 版本作用：保留 V5 的 CSV/TSV、标题别名和所属期起止规则。
 * 被调用：浏览器导入弹窗与测试；调用：共享历史校验。HTML DOM 提取留在客户端。
 * 预期结果：跳过小规模与汇总行，拒绝不完整期间和不明确的金额。
 */
import {
	fields,
	type HistoryRow,
	legacyPeriod,
	normalizeHistoryRow,
	periodDate,
	reportingPeriodDates,
} from ".";
export function parseDelimited(input: string): string[][] {
	const text = input.replace(/^\ufeff/, "");
	const delimiter = text
		.split(/\r?\n/)
		.slice(0, 30)
		.some((line) => line.includes("\t"))
		? "\t"
		: ",";
	const rows: string[][] = [];
	let row: string[] = [];
	let cell = "";
	let quoted = false;
	for (let n = 0; n < text.length; n++) {
		const c = text[n];
		if (c === '"') {
			if (quoted && text[n + 1] === '"') {
				cell += '"';
				n++;
			} else if (quoted || cell === "") quoted = !quoted;
			else cell += c;
		} else if (c === delimiter && !quoted) {
			row.push(cell);
			cell = "";
		} else if ((c === "\n" || c === "\r") && !quoted) {
			if (c === "\r" && text[n + 1] === "\n") n++;
			row.push(cell);
			if (row.some((value) => value.trim())) rows.push(row);
			row = [];
			cell = "";
		} else cell += c;
	}
	if (quoted) throw Error("表格文本的引号未闭合");
	row.push(cell);
	if (row.some((value) => value.trim())) rows.push(row);
	return rows;
}
/** 双列日期原样保留；旧 YYYY-MM 兼容为整月，不把季度或任意期间压成月份。 */
export function parsePeriod(value: string, until = "") {
	const s = value.trim();
	const quarter = /^(\d{4})(?:-?Q([1-4])|年第?([1-4一二三四])季度)$/i.exec(s);
	if (quarter && !until.trim()) {
		const index = quarter[2] || quarter[3] || "";
		return reportingPeriodDates({
			cycle: "quarterly",
			year: Number(quarter[1]),
			index: Number(index) || "一二三四".indexOf(index) + 1,
		});
	}
	if (/^\d{4}[-/年]\d{1,2}月?$/.test(s) && !until.trim()) {
		const [year, month] = s.match(/\d+/g) as string[];
		return legacyPeriod(`${year}-${month?.padStart(2, "0")}`);
	}
	const date = (text: string) => {
		const match = /^(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})日?$/.exec(
			text.trim(),
		);
		if (!match) throw Error(`无法识别所属期日期“${text}”`);
		return periodDate(
			`${match[1]}-${match[2]?.padStart(2, "0")}-${match[3]?.padStart(2, "0")}`,
		);
	};
	const range =
		/^(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?)\s*(?:至|到|~|—|–|-)\s*(.+)$/.exec(s);
	const periodStart = date(range?.[1] ?? s);
	const periodEnd = date(until.trim() || range?.[2] || "");
	if (periodStart > periodEnd) throw Error("所属期起不能晚于所属期止");
	return { periodStart, periodEnd };
}
const clean = (s = "") =>
	s.replace(/[\s\uFEFF]/g, "").replace(/[（(](?:元|人民币元)[）)]/g, "");
const aliases = {
	month: [
		"税款所属期起",
		"所属期起",
		"税款所属期",
		"所属期",
		"月份",
		"税款所属月份",
	],
	until: ["税款所属期止", "所属期止"],
	type: ["申报类型"],
	x: ["销项税额"],
	i: ["进项税额"],
	t: ["进项税额转出", "进项转出"],
	tax: ["应纳税额", "应纳税额合计"],
	end: ["期末留抵", "期末留抵税额"],
};
export function gridToHistory(grid: string[][]) {
	let headerIndex = -1;
	let index: Record<string, number> = {};
	for (let n = 0; n < Math.min(grid.length, 30); n++) {
		const headings = grid[n]?.map(clean) ?? [];
		const found = Object.fromEntries(
			Object.entries(aliases).map(([key, names]) => [
				key,
				headings.findIndex((h) => names.includes(h)),
			]),
		);
		if (["month", ...fields].every((key) => (found[key] ?? -1) >= 0)) {
			headerIndex = n;
			index = found;
			break;
		}
	}
	if (headerIndex < 0)
		throw Error(
			"未找到完整标题行。需要所属期起、所属期止、销项税额、进项税额、进项税额转出、应纳税额、期末留抵。",
		);
	const rows: HistoryRow[] = [];
	let excluded = 0;
	for (let n = headerIndex + 1; n < grid.length; n++) {
		const cells = grid[n] ?? [];
		const cell = (key: string) => cells[index[key] ?? -1] ?? "";
		if (
			!cells.some((v) => v.trim()) ||
			cells.some((v) => /^(合计|总计|小计)$/.test(v.trim()))
		)
			continue;
		if (clean(cell("month")) === clean(grid[headerIndex]?.[index.month ?? -1]))
			continue;
		const type = cell("type").trim();
		if (type.includes("小规模")) {
			excluded++;
			continue;
		}
		if (type && !type.includes("一般纳税"))
			throw Error(`第 ${n + 1} 行申报类型不属于一般纳税人：${type}`);
		try {
			rows.push(
				normalizeHistoryRow({
					...parsePeriod(cell("month"), cell("until")),
					...Object.fromEntries(fields.map((key) => [key, cell(key)])),
				}),
			);
		} catch (error) {
			throw Error(
				`第 ${n + 1} 行：${error instanceof Error ? error.message : "格式错误"}`,
			);
		}
	}
	if (!rows.length) throw Error("表内没有可用的一般纳税人所属期申报数据");
	return { rows, excluded };
}
