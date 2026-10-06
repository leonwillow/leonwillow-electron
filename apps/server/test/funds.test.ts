/**
 * @file 银行流水规范化与双边交易归并的回归测试。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-06
 * 版本作用：验证金额、证据守恒及常见脏数据，使用独立测试记录。
 * 被调用：Bun 单元测试/API 测试；调用：实际 parser/reconcile/export。
 * 预期结果：同号手续费保留，重复次数守恒，同额组自动配对，数量冲突暂缓入图。
 */
import { expect, test } from "bun:test";
import { utils, write } from "xlsx";
import {
	applyMappings,
	type SheetMapping,
} from "../src/modules/funds/ai-normalizer";
import { prepareCanonical } from "../src/modules/funds/canonical";
import {
	csvDocument,
	standardHeaders,
	standardRows,
	templateHeaders,
} from "../src/modules/funds/export";
import {
	bankTimestamp,
	moneyMinor,
	parseStatement,
} from "../src/modules/funds/parser";
import { reconcile } from "../src/modules/funds/reconcile";
import { identifySubjects } from "../src/modules/funds/subjects";
import type { FundsAccount } from "../src/modules/funds/types";

const headers = [
	"账号",
	"客户名称",
	"对方账号",
	"对方户名",
	"借贷方向",
	"交易日期",
	"交易时间",
	"交易金额",
	"账户余额",
	"币种",
	"交易流水号",
	"摘要",
];
const row = (values: Partial<Record<(typeof headers)[number], string>> = {}) =>
	headers.map(
		(key) =>
			({
				账号: "6217003760151519352",
				客户名称: "测试甲",
				对方账号: "6214860238180505",
				对方户名: "测试乙",
				借贷方向: "借",
				交易日期: "2022-01-05",
				交易时间: "10:34:21",
				交易金额: "900000.00",
				账户余额: "100000.00",
				币种: "CNY",
				交易流水号: "bank-ref",
				摘要: "转账",
				...values,
			})[key] ?? "",
	);
const source = (name: string, rows: string[][]) =>
	parseStatement(name, new TextEncoder().encode(csvDocument(headers, rows)));

test("整组两次同额付款对应两次收款，保留两笔且无需人工", () => {
	const out = source("out.csv", [
		row(),
		row({ 交易流水号: "second", 交易时间: "10:34:29" }),
	]);
	const into = source("in.csv", [
		row({
			账号: "6214860238180505",
			对方账号: "6217003760151519352",
			借贷方向: "贷",
			交易流水号: "bank-1",
			交易时间: "10:34:22",
		}),
		row({
			账号: "6214860238180505",
			对方账号: "6217003760151519352",
			借贷方向: "贷",
			交易流水号: "bank-2",
			交易时间: "10:34:30",
		}),
	]);
	const result = reconcile([out, into]);
	expect(result.transactions).toHaveLength(2);
	expect(result.candidates).toHaveLength(0);
	expect(result.transactions.every((t) => t.evidenceIds.length === 2)).toBe(
		true,
	);
});

test("无法匹配的冲突组不重复入图，单边流水正常入图，人工决定可重放", () => {
	const out = source("out.csv", [row(), row({ 交易流水号: "second" })]);
	const into = source("in.csv", [
		row({
			账号: "6214860238180505",
			对方账号: "6217003760151519352",
			借贷方向: "贷",
		}),
	]);
	expect(reconcile([out]).totals.transactionCount).toBe(2);
	const result = reconcile([out, into]);
	expect(result.heldTransactionIds).toHaveLength(3);
	expect(result.totals.transactionCount).toBe(0);
	const candidate = result.candidates[0];
	if (!candidate) throw new Error("缺少核对候选");
	const reviewed = reconcile(
		[out, into],
		[
			{
				left: candidate.left,
				right: candidate.right,
				action: "merge",
				actor: "test",
				at: "2026-10-06",
			},
		],
	);
	expect(reviewed.totals.transactionCount).toBe(2);
	expect(reviewed.heldTransactionIds).toHaveLength(0);
});

test("先取得收款方再补充付款方，既有交易 ID 保持稳定", () => {
	const into = source("in.csv", [
		row({
			账号: "6214860238180505",
			对方账号: "6217003760151519352",
			借贷方向: "贷",
		}),
	]);
	const first = prepareCanonical(reconcile([into]), undefined, [into]);
	const out = source("out.csv", [row()]);
	const next = prepareCanonical(reconcile([out, into]), first, [out, into]);
	expect(next.transactions[0]?.id).toBe(first.transactions[0]?.id);
	expect(next.transactions[0]?.evidenceIds).toHaveLength(2);
});

test("未知银行列名映射到标准 13 列，原始行保留，虚构常量拒绝", () => {
	const rawHeaders = [
		"出入账账户",
		"账户人",
		"对端账户",
		"对端户名",
		"收支",
		"时间点",
		"本次发生额",
		"余额",
		"凭据",
		"事由",
		"调取机构",
		"对端银行",
		"附言",
	];
	const bytes = new TextEncoder().encode(
		csvDocument(rawHeaders, [
			[
				"000123456789012345678",
				"甲",
				"000987654321098765432",
				"乙",
				"付款",
				"2022-01-05 10:34:21",
				"123.45",
				"500",
				"ref",
				"往来",
				"查询行",
				"对方行",
				"保留,备注\n第二行",
			],
		]),
	);
	const plan: SheetMapping = {
		sheet: "Sheet1",
		kind: "transactions",
		headerRow: 1,
		fields: standardHeaders.map((field, i) => ({
			field,
			columns: [i],
			constant: "",
			separator: "",
		})),
		dateColumn: -1,
		currencyColumn: -1,
		statusColumn: -1,
		feedbackColumn: -1,
		debitColumn: -1,
		creditColumn: -1,
		amountScale: 1,
		directionValues: [{ original: "付款", normalized: "借" }],
		explanation: "依据原表语义",
	};
	const result = applyMappings(
		"new-bank.csv",
		bytes,
		{ sheets: [plan] },
		"fixture",
	);
	expect(result.report.rowConservation).toBe(true);
	expect(result.source.observations[0]).toMatchObject({
		ownerAccount: "000123456789012345678",
		amountMinor: "12345",
		remarks: "保留,备注\n第二行",
	});
	expect(result.source.rows[0]?.fields.收支).toBe("付款");
	expect(
		parseStatement("standard.csv", new TextEncoder().encode(result.csv)).rows[0]
			?.fields.备注,
	).toBe("保留,备注\n第二行");
	plan.fields[0] = {
		field: "本方账号",
		columns: [],
		constant: "999999",
		separator: "",
	};
	expect(() =>
		applyMappings("new-bank.csv", bytes, { sheets: [plan] }, "fixture"),
	).toThrow("没有表头原文依据");
});

test("AI 转换保留银行查询失败依据，不把反馈转成金额待核", () => {
	const values = [
		"",
		"甲",
		"",
		"",
		"",
		"",
		"",
		"",
		"",
		"",
		"查询行",
		"",
		"",
		"失败",
		"该客户未在我行开户！",
	];
	const bytes = new TextEncoder().encode(
		csvDocument(
			[...standardHeaders, "查询反馈结果", "查询反馈结果原因"],
			[values],
		),
	);
	const plan: SheetMapping = {
		sheet: "Sheet1",
		kind: "transactions",
		headerRow: 1,
		fields: standardHeaders.map((field, i) => ({
			field,
			columns: [i],
			constant: "",
			separator: "",
		})),
		dateColumn: -1,
		currencyColumn: -1,
		statusColumn: -1,
		feedbackColumn: 14,
		debitColumn: -1,
		creditColumn: -1,
		amountScale: 1,
		directionValues: [],
		explanation: "银行回执",
	};
	const result = applyMappings(
		"feedback.csv",
		bytes,
		{ sheets: [plan] },
		"fixture",
	);
	expect(result.report).toMatchObject({
		standardRows: 0,
		quarantined: 0,
		feedback: 1,
		rowConservation: true,
	});
	expect(result.source.issues[0]?.message).toBe("该客户未在我行开户！");
});

test("金额按整数分计算，拒绝不规则千分位和精度损失", () => {
	expect(moneyMinor("1,234.56")).toBe("123456");
	expect(moneyMinor("90071992547409.91")).toBe("9007199254740991");
	for (const invalid of [
		"1,2,3.00",
		"12.345",
		"1e10",
		"-25",
		"",
		"NaN",
		"92233720368547758.08",
	])
		expect(moneyMinor(invalid)).toBeNull();
});
test("日期校验拒绝不存在的日期，完整银行时间采用明确时区", () => {
	expect(bankTimestamp("", "20220105103421")).toBe("2022-01-05T10:34:21+08:00");
	expect(bankTimestamp("2022-02-30", "10:34:21")).toBeNull();
	expect(bankTimestamp("2022-01-05", "")).toBeNull();
});
test("跨文件去重保留来源，文件内两次相同付款不会吞掉", () => {
	const one = source("one.csv", [row(), row()]);
	const two = source("two.csv", [row({ 客户名称: "测试甲别名" })]);
	const result = reconcile([one, two]);
	expect(result.totals.duplicates).toBe(1);
	expect(result.transactions).toHaveLength(2);
	expect(
		result.transactions.reduce((n, t) => n + t.evidenceIds.length, 0),
	).toBe(3);
	expect(result.totals.nameConflicts).toBe(1);
});
test("借贷两侧合成一条边，同号同秒手续费仍独立且未知节点不混用", () => {
	const out = source("out.csv", [
		row(),
		row({ 对方账号: "", 交易金额: "1", 摘要: "手续费" }),
		row({ 对方账号: "0000000", 交易金额: "2", 摘要: "手续费" }),
	]);
	const incoming = source("in.csv", [
		row({
			账号: "6214860238180505",
			客户名称: "测试乙",
			对方账号: "6217003760151519352",
			对方户名: "测试甲",
			借贷方向: "贷",
			交易流水号: "other-bank-ref",
			账户余额: "930000",
		}),
	]);
	const result = reconcile([out, incoming]);
	expect(result.transactions).toHaveLength(3);
	expect(result.totals.mirrored).toBe(1);
	expect(
		result.transactions.find((t) => t.amountMinor === "90000000")?.evidenceIds,
	).toHaveLength(2);
	expect(
		new Set(result.accounts.filter((a) => a.unknown).map((a) => a.id)).size,
	).toBe(2);
});
test("整段流水的双向唯一近时记录自动匹配，同名不同账号保持独立", () => {
	const out = source("a.csv", [row()]);
	const into = source("b.csv", [
		row({
			账号: "6214860238180505",
			客户名称: "测试甲",
			对方账号: "6217003760151519352",
			对方户名: "测试甲",
			借贷方向: "贷",
			交易时间: "10:34:26",
			账户余额: "930000",
		}),
	]);
	const result = reconcile([out, into]);
	expect(result.transactions).toHaveLength(1);
	expect(result.candidates).toHaveLength(0);
	expect(result.accounts.filter((a) => !a.unknown)).toHaveLength(2);
	expect(result.transactions[0]?.reconciliation).toBe("mirror");
});
test("CSV 查询无明细不计交易，负金额不擅自取绝对值", () => {
	const csv = csvDocument(
		[...headers, "查询反馈结果", "查询反馈结果原因"],
		[
			[
				...row({ 账号: "", 交易日期: "", 交易时间: "", 交易金额: "0" }),
				"成功",
				"查询无明细",
			],
			[...row({ 交易金额: "-10", 摘要: "消费退货" }), "成功", ""],
		],
	);
	const parsed = parseStatement("feedback.csv", new TextEncoder().encode(csv));
	expect(parsed.observations).toHaveLength(0);
	expect(parsed.feedbackCount).toBe(1);
	expect(parsed.issues.filter((i) => i.kind === "quarantine")).toHaveLength(1);
});
test("标准表导出再导入保留长账号、金额、方向和时刻", () => {
	const original = source("one.csv", [row()]);
	const csv = csvDocument(standardHeaders, standardRows(original));
	const reread = parseStatement("standard.csv", new TextEncoder().encode(csv));
	expect(reread.observations[0]).toMatchObject({
		ownerAccount: "6217003760151519352",
		otherAccount: "6214860238180505",
		amountMinor: "90000000",
		direction: "out",
		timestamp: "2022-01-05T10:34:21+08:00",
	});
	expect(reconcile([original, reread]).totals.duplicates).toBe(1);
});

test("13 列模板保留银行及完整备注，导出不混入来源字段和外币", () => {
	expect(templateHeaders).toEqual([
		"本方账号",
		"本方户名",
		"对方账号",
		"对方户名",
		"借贷方向",
		"交易时间",
		"交易金额",
		"账户余额",
		"交易流水号",
		"摘要",
		"查询银行",
		"对方开户行",
		"备注",
	]);
	const original = parseStatement(
		"remarks.csv",
		new TextEncoder().encode(
			csvDocument(
				[
					...headers,
					"目标机构",
					"交易对方账号开户行",
					"扩充备注",
					"备注",
					"终端号",
				],
				[
					[
						...row(),
						"中国建设银行",
						"中国工商银行",
						"合同001",
						"用途,补充说明\n第二行",
						"terminal-1",
					],
				],
			),
		),
	);
	const exportedRows = standardRows(original);
	expect(exportedRows[0]).toHaveLength(13);
	expect(exportedRows[0]?.slice(10)).toEqual([
		"中国建设银行",
		"中国工商银行",
		"合同001；用途,补充说明\n第二行",
	]);
	const reread = parseStatement(
		"exported.csv",
		new TextEncoder().encode(csvDocument(standardHeaders, exportedRows)),
	);
	expect(standardRows(reread)).toEqual(exportedRows);
	expect(reconcile([original, reread]).transactions).toHaveLength(1);
	expect(() =>
		standardRows(source("foreign.csv", [row({ 币种: "USD" })])),
	).toThrow("仅支持人民币");
});

test("Excel 数值日期与时间按单元格格式解释，长账号保持文本", () => {
	const sheet = utils.aoa_to_sheet([headers, row()]);
	sheet.F2 = { t: "n", v: 44566, z: "yyyy-mm-dd" };
	sheet.G2 = { t: "n", v: (10 * 3600 + 34 * 60 + 21) / 86400, z: "hh:mm:ss" };
	const workbook = utils.book_new();
	utils.book_append_sheet(workbook, sheet, "流水");
	const parsed = parseStatement(
		"numeric-date.xlsx",
		write(workbook, { type: "buffer", bookType: "xlsx" }),
	);
	expect(parsed.observations[0]).toMatchObject({
		ownerAccount: "6217003760151519352",
		timestamp: "2022-01-05T10:34:21+08:00",
		amountMinor: "90000000",
	});
});

test("精简模板合并日期时间且按人民币元入库，兼容旧银行表", () => {
	const simple = [
		"本方账号",
		"本方户名",
		"对方账号",
		"对方户名",
		"借贷方向",
		"交易时间",
		"交易金额",
		"账户余额",
		"交易流水号",
		"摘要",
	];
	const values = [
		"6217003760151519352",
		"测试甲",
		"6214860238180505",
		"测试乙",
		"支出",
		"2022-01-05 10:34:21",
		"900000.00",
		"100000.00",
		"bank-ref",
		"转账",
	];
	const csv = parseStatement(
		"simple.csv",
		new TextEncoder().encode(csvDocument(simple, [values])),
	);
	expect(csv.observations[0]).toMatchObject({
		ownerAccount: "6217003760151519352",
		otherAccount: "6214860238180505",
		currency: "CNY",
		timestamp: "2022-01-05T10:34:21+08:00",
		amountMinor: "90000000",
	});
	const workbook = utils.book_new();
	const sheet = utils.aoa_to_sheet([simple, values]);
	sheet.F2 = {
		t: "n",
		v: 44566 + (10 * 3600 + 34 * 60 + 21) / 86400,
		z: "yyyy-mm-dd hh:mm:ss",
	};
	utils.book_append_sheet(workbook, sheet, "流水");
	const excel = parseStatement(
		"simple.xlsx",
		write(workbook, { type: "buffer", bookType: "xlsx" }),
	);
	expect(excel.observations[0]?.timestamp).toBe(csv.observations[0]?.timestamp);
	expect(
		reconcile([source("original.csv", [row()]), csv, excel]).transactions,
	).toHaveLength(1);
	expect(
		source("missing-currency.csv", [row({ 币种: "" })]).observations,
	).toHaveLength(0);
	expect(
		source("foreign-currency.csv", [row({ 币种: "USD" })]).observations[0]
			?.currency,
	).toBe("USD");
});

test("主体按完整户名自动归组，遮蔽名和缺失账号不误合并", () => {
	const make = (id: string, name: string, unknown = false): FundsAccount => ({
		id,
		number: unknown ? "" : id,
		names: [name],
		ownNames: [name],
		hasStatement: true,
		unknown,
		firstSeen: "",
		lastSeen: "",
	});
	const accounts = [
		make("100", "赵佳"),
		make("101", "赵 佳"),
		make("102", "赵*"),
		make("103", "赵*"),
		make("u1", "赵佳", true),
		make("u2", "赵佳", true),
	];
	const result = identifySubjects(accounts, []);
	expect(result).toHaveLength(5);
	expect(result.find((s) => s.accounts.includes("100"))?.accounts).toEqual([
		"100",
		"101",
	]);
	expect(result.find((s) => s.accounts.includes("100"))?.identityStatus).toBe(
		"name-inferred",
	);
	expect(result.filter((s) => s.identityStatus === "unknown")).toHaveLength(2);
	expect(result.flatMap((s) => s.accounts).sort()).toEqual(
		accounts.map((a) => a.id).sort(),
	);
});

test("同名证件冲突不桥接，单一证件可以支持无证件同名账户但标为推断", () => {
	const make = (id: string): FundsAccount => ({
		id,
		number: id,
		names: ["赵佳"],
		ownNames: ["赵佳"],
		hasStatement: true,
		unknown: false,
		firstSeen: "",
		lastSeen: "",
	});
	const a = source("ids.csv", [row(), row()]);
	a.observations = [];
	if (!a.rows[0] || !a.rows[1]) throw new Error("缺少行");
	a.rows[0].fields = { 账号: "100", 证件号码: "123456789000000001" };
	a.rows[1].fields = { 账号: "101", 证件号码: "123456789000000002" };
	const accounts = [make("100"), make("101"), make("102")];
	expect(identifySubjects(accounts, [a])).toHaveLength(3);
	const conflict = identifySubjects(accounts, [a]).find((s) =>
		s.accounts.includes("102"),
	);
	expect(conflict?.identityStatus).toBe("conflict");
	a.rows[1].fields.证件号码 = "123456789000000001";
	const result = identifySubjects(accounts, [a]);
	expect(result).toHaveLength(1);
	expect(result[0]?.identityStatus).toBe("name-inferred");
	// 别案没有这些证件资料，只能独立给出本案同名推断依据。
	expect(identifySubjects(accounts, [])[0]?.id).not.toBe(result[0]?.id);
});

test("主体人工拆分及软撤销能重放，不改写交易，追加文件继承调整", () => {
	const sources = [
		source("cards.csv", [
			row({ 账号: "10001", 客户名称: "赵佳" }),
			row({ 账号: "10002", 客户名称: "赵佳", 交易流水号: "another" }),
		]),
	];
	const first = prepareCanonical(reconcile(sources), undefined, sources);
	const transactionIds = first.transactions.map((t) => t.id);
	first.subjectOverrides = [
		{
			id: "split",
			accounts: ["10001", "10002"],
			action: "separate",
			name: "",
			actor: "test",
			at: "2026-10-06",
		},
	];
	const next = prepareCanonical(reconcile(sources), first, sources);
	expect(
		next.subjects?.filter((s) => s.identityStatus === "manual"),
	).toHaveLength(2);
	expect(next.transactions.map((t) => t.id)).toEqual(transactionIds);
	const decision = next.subjectOverrides?.[0];
	if (!decision) throw new Error("缺少调整");
	decision.deletedAt = "2026-10-07";
	const undone = prepareCanonical(reconcile(sources), next, sources);
	expect(
		undone.subjects?.find((s) => s.accounts.includes("10001"))?.accounts,
	).toEqual(["10001", "10002"]);
	expect(undone.subjectOverrides?.[0]?.deletedAt).toBe("2026-10-07");
	expect(undone.transactions.map((t) => t.id)).toEqual(transactionIds);
});

test("主体识别读取原始银行证照列，并用已规范化行位置关联本方账户", () => {
	const original = source("different-headers.csv", [
		row({ 账号: "10001", 客户名称: "赵佳" }),
		row({ 账号: "10002", 客户名称: "原名" }),
	]);
	for (const raw of original.rows) {
		raw.fields.证照号码 = "123456789000000009";
		raw.fields["查询涉及账（卡）号"] = raw.fields.账号 ?? "";
		delete raw.fields.账号;
	}
	const result = prepareCanonical(reconcile([original]), undefined, [original]);
	const group = result.subjects?.find((s) => s.accounts.includes("10001"));
	expect(group?.accounts).toEqual(["10001", "10002"]);
	expect(group?.identityStatus).toBe("documented");
});
