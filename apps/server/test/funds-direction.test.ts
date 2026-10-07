/**
 * @file 资金出入方向契约、AI 映射和标准文件往返校验。
 * 创建时间：2026-10-07
 * 修改时间：2026-10-07
 * 版本作用：拒绝第三种方向及不确定转换，验证待核记录和原文守恒。
 * 被调用：Bun 单元/API 测试；调用：正式 parser、AI converter 与 export。
 * 预期结果：CSV/Excel、AI 及导出仅产生出或入，不静默反转、丢行或猜测借贷含义。
 */
import { expect, test } from "bun:test";
import { utils, write } from "xlsx";
import {
	applyMappings,
	type SheetMapping,
} from "../src/modules/funds/ai-normalizer";
import {
	csvDocument,
	standardHeaders,
	standardRows,
} from "../src/modules/funds/export";
import { parseStatement } from "../src/modules/funds/parser";

const transaction = (direction: string) => [
	"000123456789012345678",
	"甲",
	"000987654321098765432",
	"乙",
	direction,
	"2022-01-05 10:34:21",
	"123.45",
	"500.00",
	"ref",
	"往来",
	"查询行",
	"对方行",
	"原文备注",
];
const csvBytes = (
	rows: string[][],
	headers: readonly string[] = standardHeaders,
) => new TextEncoder().encode(csvDocument(headers, rows));
const mapping = (): SheetMapping => ({
	sheet: "Sheet1",
	kind: "transactions",
	headerRow: 1,
	fields: standardHeaders.map((field, column) => ({
		field,
		columns: [column],
		constant: "",
		separator: "",
	})),
	dateColumn: -1,
	currencyColumn: -1,
	statusColumn: -1,
	feedbackColumn: -1,
	outgoingColumn: -1,
	incomingColumn: -1,
	amountScale: 1,
	directionValues: [],
	explanation: "本方账户视角，原表说明付款为流出，收款为流入",
});

test.each(["csv", "xlsx"])(
	"%s 仅接受出入，非法方向逐行待核且保留原值",
	(extension) => {
		const invalid = [
			"借",
			"贷",
			"进",
			"收入",
			"支出",
			"收",
			"付",
			"D",
			"C",
			"in",
			"out",
			"both",
			"未知",
			"",
			"出入",
		];
		const rows = ["出", "入", ...invalid].map(transaction);
		const book = utils.book_new();
		utils.book_append_sheet(
			book,
			utils.aoa_to_sheet([standardHeaders, ...rows]),
			"Sheet1",
		);
		const bytes =
			extension === "csv"
				? csvBytes(rows)
				: write(book, { type: "buffer", bookType: "xlsx" });
		const source = parseStatement(`directions.${extension}`, bytes);
		expect(source.observations.map((o) => o.direction)).toEqual(["out", "in"]);
		expect(source.issues).toHaveLength(invalid.length);
		expect(
			source.issues.every(
				(i) => i.kind === "quarantine" && i.message.includes("出入方向只允许"),
			),
		).toBe(true);
		expect(source.rows.slice(2).map((r) => r.fields.出入方向)).toEqual(invalid);
		expect(source.rows.length).toBe(
			source.observations.length + source.issues.length,
		);
		expect(source.auxiliaryCount).toBe(0);
		const exported = standardRows(source);
		expect(exported.map((r) => r[4])).toEqual(["出", "入"]);
		expect(
			parseStatement("roundtrip.csv", csvBytes(exported)).observations.map(
				(o) => o.direction,
			),
		).toEqual(["out", "in"]);
	},
);

test("缺少、旧名和重复方向列不能绕过导入校验", () => {
	for (const title of ["", "借贷方向", "借贷标志", "收付标志"]) {
		const headers = standardHeaders.map((header, i) =>
			i === 4 ? title : header,
		);
		const source = parseStatement(
			"missing.csv",
			csvBytes([transaction("出")], headers),
		);
		expect(source.observations).toHaveLength(0);
		expect(source.auxiliaryCount).toBe(0);
		expect(source.issues[0]?.message).toContain("缺少出入方向列");
	}
	const source = parseStatement(
		"duplicate.csv",
		csvBytes([[...transaction("出"), "入"]], [...standardHeaders, "出入方向"]),
	);
	expect(source.observations).toHaveLength(0);
	expect(source.issues[0]?.message).toContain("出入方向列重复");
});

test("导出拒绝损坏的内部方向，不能默认当作入", () => {
	const source = parseStatement("valid.csv", csvBytes([transaction("出")]));
	const observation = source.observations[0];
	if (!observation) throw new Error("缺少测试观测");
	Object.assign(observation, { direction: "unknown" });
	expect(() => standardRows(source)).toThrow("出入方向无效");
});

test("AI 只使用明确映射转换原始借贷，未映射值保留待核", () => {
	const plan = mapping();
	plan.directionValues = [
		{ original: "借", normalized: "出" },
		{ original: "贷", normalized: "入" },
	];
	plan.explanation = "测试原表明确说明本方借为付款、贷为收款";
	const rows = ["借", "贷", "出", "入", "未知", "D"].map(transaction);
	const result = applyMappings(
		"raw.csv",
		csvBytes(
			rows,
			standardHeaders.map((h, i) => (i === 4 ? "银行方向" : h)),
		),
		{ sheets: [plan] },
		"fixture",
	);
	expect(result.source.observations.map((o) => o.direction)).toEqual([
		"out",
		"in",
		"out",
		"in",
	]);
	expect(result.source.rows.map((r) => r.fields.银行方向)).toEqual([
		"借",
		"贷",
		"出",
		"入",
		"未知",
		"D",
	]);
	expect(result.report).toMatchObject({
		rawRows: 6,
		standardRows: 4,
		quarantined: 2,
		rowConservation: true,
		amountTotals: { incomingMinor: "24690", outgoingMinor: "24690" },
	});
	expect(result.csv).toContain('"出入方向"');
	expect(result.csv).not.toContain('"借"');
	expect(result.csv).not.toContain('"贷"');
	plan.directionValues = [];
	expect(
		applyMappings(
			"unmapped.csv",
			csvBytes([transaction("借")]),
			{ sheets: [plan] },
			"fixture",
		).source.observations,
	).toHaveLength(0);
});

test("AI 方案拒绝第三种输出、重复映射、标准方向反转和同一收付列", () => {
	const bytes = csvBytes([transaction("出")]);
	for (const normalized of ["借", "贷", "未知", "", "支出", "收入"]) {
		const plan = {
			...mapping(),
			directionValues: [{ original: "付款", normalized }],
		};
		expect(() =>
			applyMappings("invalid.csv", bytes, { sheets: [plan] }, "fixture"),
		).toThrow("只允许出或入");
	}
	const plan = mapping();
	plan.directionValues = [
		{ original: "付款", normalized: "出" },
		{ original: "付款", normalized: "入" },
	];
	expect(() =>
		applyMappings("duplicate.csv", bytes, { sheets: [plan] }, "fixture"),
	).toThrow("映射重复");
	plan.directionValues = [{ original: "出", normalized: "入" }];
	expect(() =>
		applyMappings("reversed.csv", bytes, { sheets: [plan] }, "fixture"),
	).toThrow("反转");
	plan.directionValues = [];
	plan.outgoingColumn = plan.incomingColumn = 6;
	expect(() =>
		applyMappings("same.csv", bytes, { sheets: [plan] }, "fixture"),
	).toThrow("不能相同");
});

test.each([1, 10000])(
	"AI 分列金额（单位 %s 元）仅从唯一正值确定方向，冲突和负数待核",
	(amountScale) => {
		const plan = mapping();
		plan.outgoingColumn = 13;
		plan.incomingColumn = 14;
		plan.amountScale = amountScale;
		const rows = [
			[...transaction(""), "123.45", "0.00"],
			[...transaction("入"), "0", "80.00"],
			[...transaction(""), "1", "2"],
			[...transaction(""), "0", "0"],
			[...transaction(""), "", ""],
			[...transaction(""), "-1", "50"],
			[...transaction("入"), "10", "0"],
			[...transaction("未知"), "10", "0"],
			[...transaction(""), "12.3.4", "50"],
		];
		const result = applyMappings(
			"split.csv",
			csvBytes(rows, [...standardHeaders, "本方流出金额", "本方流入金额"]),
			{ sheets: [plan] },
			"fixture",
		);
		expect(result.source.observations.map((o) => o.direction)).toEqual([
			"out",
			"in",
		]);
		expect(result.source.observations.map((o) => o.amountMinor)).toEqual([
			String(12345 * amountScale),
			String(8000 * amountScale),
		]);
		expect(result.report).toMatchObject({
			rawRows: 9,
			standardRows: 2,
			quarantined: 7,
			rowConservation: true,
		});
		expect(
			result.source.issues.every((i) => i.message.includes("出入方向")),
		).toBe(true);
		expect(result.csv).not.toContain("方向冲突");
		expect(result.source.issues.map((i) => i.row)).toEqual([
			4, 5, 6, 7, 8, 9, 10,
		]);
	},
);
