/**
 * @file 税务导出表的纯文本解析，不执行导入内容。
 * 创建时间：2026-11-05；修改时间：2026-11-05。
 * 版本作用：保留 V5 的 CSV/TSV、标题别名和完整自然月规则。
 * 被调用：浏览器导入弹窗与测试；调用：共享历史校验。HTML DOM 提取留在客户端。
 * 预期结果：跳过小规模与汇总行，拒绝不完整期间和不明确的金额。
 */
import { fields, type HistoryRow, monthIndex, normalizeHistoryRow } from ".";
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
export function parsePeriod(value: string, until = "") {
	const s = value.trim();
	const match = /^(\d{4})[-/年](\d{1,2})(?:[-/月](\d{1,2}))?/.exec(s);
	if (!match) throw Error(`无法识别税款所属期“${s}”`);
	const year = Number(match[1]);
	const monthNumber = Number(match[2]);
	const month = `${match[1]}-${match[2]?.padStart(2, "0")}`;
	monthIndex(month);
	if (match[3] && Number(match[3]) !== 1)
		throw Error(`${month} 不是从月初开始的月度申报`);
	const rest = s
		.slice(match[0].length)
		.replace(/^[日月]/, "")
		.trim();
	const range = /^(?:至|到|~|—|–|-)\s*(.+)$/.exec(rest);
	if (rest && !range) throw Error(`${month} 所属期包含无法识别的内容`);
	const end = until.trim() || range?.[1] || "";
	if (end) {
		const e = /^(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})日?$/.exec(end.trim());
		const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
		if (
			!e ||
			Number(e[1]) !== year ||
			Number(e[2]) !== monthNumber ||
			Number(e[3]) !== lastDay
		)
			throw Error(`${month} 所属期不是一个完整自然月`);
	}
	return month;
}
const clean = (s = "") =>
	s.replace(/[\s\uFEFF]/g, "").replace(/[（(](?:元|人民币元)[）)]/g, "");
const aliases = {
	month: ["税款所属期起", "税款所属期", "所属期", "月份", "税款所属月份"],
	until: ["税款所属期止"],
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
			"未找到完整标题行。需要月份、销项税额、进项税额、进项税额转出、应纳税额、期末留抵六项。",
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
					month: parsePeriod(cell("month"), cell("until")),
					...Object.fromEntries(fields.map((key) => [key, cell(key)])),
				}),
			);
		} catch (error) {
			throw Error(
				`第 ${n + 1} 行：${error instanceof Error ? error.message : "格式错误"}`,
			);
		}
	}
	if (!rows.length) throw Error("表内没有可用的一般纳税人月度申报数据");
	return { rows, excluded };
}
