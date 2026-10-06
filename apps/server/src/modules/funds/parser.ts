/**
 * @file 银行 Excel/CSV 原文读取与字段规范化。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-06
 * 版本作用：按表头识别混合文件，拒绝无把握的数据转换。
 * 被调用：导入服务、离线整案导入和解析测试；调用：SheetJS。
 * 功能：识别编码、修复错误表范围、保留原始单元格和问题行。
 * 预期结果：查询反馈不生成交易；账号不数值化，金额不浮点相加。
 */
import { createHash } from "node:crypto";
import { read, utils } from "xlsx";
import type { ParsedSource, SourceRow } from "./types";

export const digest = (value: string | Uint8Array) =>
	createHash("sha256").update(value).digest("hex");
const clean = (value: unknown) =>
	String(value ?? "")
		.replace(/^\uFEFF/, "")
		.trim();
const aliases = {
	ownerAccount: [
		"账号",
		"查询涉及账（卡）号",
		"查询涉及账(卡)号",
		"本方账号",
		"账户号码",
	],
	ownerName: ["客户名称", "本方户名", "账户名称", "户名"],
	otherAccount: ["对方账号", "交易对方账号", "对手账号"],
	otherCard: ["交易对方卡号"],
	otherName: ["对方户名", "交易对方名称", "对手户名"],
	direction: ["借贷方向", "借贷标志", "收付标志"],
	amount: ["交易金额", "发生额", "金额"],
	balance: ["账户余额", "交易余额", "余额"],
	date: ["交易日期", "记账日期"],
	time: ["交易时间", "交易日期时间"],
	reference: ["交易流水号", "银行流水号"],
	summary: ["摘要", "交易摘要", "用途"],
	currency: ["币种", "交易币种"],
} as const;
type Field = keyof typeof aliases;
const get = (row: SourceRow, field: Field) => {
	for (const key of aliases[field])
		if (clean(row.fields[key])) return clean(row.fields[key]);
	return "";
};

/** 严格转换非负金额到分；超过两位小数、科学计数或 int64 范围均拒绝。 */
export function moneyMinor(value: string): string | null {
	const input = value.trim().replace(/^[￥¥]/, "");
	if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(input)) return null;
	const text = input.replaceAll(",", "");
	if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
	const [whole = "0", decimal = ""] = text.split(".");
	const amount = BigInt(whole) * 100n + BigInt(decimal.padEnd(2, "0"));
	return amount <= 9_223_372_036_854_775_807n ? amount.toString() : null;
}

function accountNumber(value: string) {
	const text = value.replace(/[\s\u200B]/g, "").replace(/^['’]/, "");
	if (!text || /^0+$/.test(text) || /^(无|不详|未知|NULL|N\/A|-)$/i.test(text))
		return "";
	if (/^[\d.]+e[+-]?\d+$/i.test(text))
		throw new Error("账号是科学计数形式，需核对原始账号，不能自动补位");
	return text;
}

/** 只接收完整日历日期和秒级时间；缺失时间不擅自补零。 */
export function bankTimestamp(date: string, time: string): string | null {
	let text = date ? `${date} ${time}` : time;
	text = text.replaceAll("/", "-").replace("T", " ");
	if (/^\d{14}$/.test(text))
		text = text.replace(
			/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/,
			"$1-$2-$3 $4:$5:$6",
		);
	if (/^\d{8} /.test(text))
		text = text.replace(/^(\d{4})(\d{2})(\d{2}) /, "$1-$2-$3 ");
	const match = /^(\d{4})-(\d{1,2})-(\d{1,2}) (\d{1,2}):(\d{2}):(\d{2})$/.exec(
		text,
	);
	if (!match) return null;
	const [, y, m, d, h, minute, s] = match;
	const iso = `${y}-${m?.padStart(2, "0")}-${d?.padStart(2, "0")}T${h?.padStart(2, "0")}:${minute}:${s}+08:00`;
	const instant = new Date(iso);
	if (!Number.isFinite(instant.getTime())) return null;
	const local = new Date(instant.getTime() + 8 * 3_600_000)
		.toISOString()
		.slice(0, 19);
	return local === iso.slice(0, 19) ? iso : null;
}

function csvText(bytes: Uint8Array) {
	const encodings =
		bytes[0] === 0xff && bytes[1] === 0xfe
			? (["utf-16le"] as const)
			: bytes[0] === 0xfe && bytes[1] === 0xff
				? (["utf-16be"] as const)
				: (["utf-8", "gb18030"] as const);
	for (const encoding of encodings) {
		try {
			return {
				text: new TextDecoder(encoding, { fatal: true }).decode(bytes),
				encoding,
			};
		} catch {
			/* 下一种明确编码。 */
		}
	}
	throw new Error("无法识别文本编码，请另存为 UTF-8 CSV 后重试。");
}

/** 解析单个文件；格式/大小错误整文件拒绝，行级错误保留原文并隔离。 */
export function parseStatement(name: string, bytes: Uint8Array): ParsedSource {
	if (!/\.(xlsx|xls|csv|tsv)$/i.test(name))
		throw new Error("仅支持 XLSX、XLS、CSV、TSV；其他格式需转换后导入。");
	if (bytes.length > 20 * 1024 * 1024 || !bytes.length)
		throw new Error("文件为空或超过 20 MB。");
	const textInput = /\.(csv|tsv)$/i.test(name) ? csvText(bytes) : null;
	const workbook = read(textInput?.text ?? bytes, {
		type: textInput ? "string" : "array",
		raw: true,
		nodim: true,
		cellText: true,
		cellDates: false,
	});
	const sha256 = digest(bytes);
	const source: ParsedSource = {
		id: sha256,
		name,
		sha256,
		size: bytes.length,
		encoding: textInput?.encoding ?? "Excel",
		rows: [],
		observations: [],
		issues: [],
		feedbackCount: 0,
		auxiliaryCount: 0,
	};
	const issue = (row: SourceRow, kind: string, message: string) =>
		source.issues.push({
			id: digest(`${sha256}:${row.sheet}:${row.row}:${kind}`),
			sourceId: sha256,
			sheet: row.sheet,
			row: row.row,
			kind,
			message,
		});
	let recognized = 0;
	for (const sheetName of workbook.SheetNames) {
		const sheet = workbook.Sheets[sheetName];
		if (!sheet) continue;
		const range = utils.decode_range(sheet["!ref"] ?? "A1");
		if (range.e.r > 100_000 || range.e.c > 250)
			throw new Error("工作表超过首版 100,000 行或 250 列限制，请拆分后导入。");
		const rows = utils.sheet_to_json<unknown[]>(sheet, {
			header: 1,
			raw: true,
			defval: "",
			blankrows: true,
		});
		const headerIndex = rows
			.slice(0, 30)
			.findIndex(
				(cells) =>
					cells.some((cell) =>
						aliases.ownerAccount.includes(clean(cell) as "账号"),
					) &&
					cells.some((cell) =>
						[...aliases.amount, "开户日期"].includes(clean(cell) as "交易金额"),
					),
			);
		if (headerIndex < 0) {
			if (rows.some((cells) => cells.some((cell) => clean(cell)))) {
				const row = {
					sheet: sheetName,
					row: 1,
					fields: { 内容: JSON.stringify(rows.slice(0, 30)) },
				};
				source.rows.push(row);
				issue(
					row,
					"unsupported-sheet",
					"未识别工作表表头，整表原文保留在源文件中，请转换为标准模板",
				);
			}
			continue;
		}
		recognized++;
		const headers = (rows[headerIndex] ?? []).map(clean);
		// 精简模板以完整交易时间和人民币元为约定；原始银行表仍检查其币种。
		const usesYuanTemplate =
			headers.includes("本方账号") &&
			headers.includes("交易时间") &&
			!headers.some((header) => aliases.date.includes(header as "交易日期")) &&
			!headers.some((header) => aliases.currency.includes(header as "币种"));
		const isTransaction =
			headers.some((header) => aliases.amount.includes(header as "交易金额")) &&
			headers.some((header) =>
				aliases.direction.includes(header as "借贷方向"),
			);
		for (let r = headerIndex + 1; r < rows.length; r++) {
			const cells = rows[r] ?? [];
			if (!cells.some((value) => clean(value))) continue;
			const fields: Record<string, string> = {};
			headers.forEach((header, c) => {
				const value = cells[c];
				const isDateOrTime = [...aliases.date, ...aliases.time].some(
					(name) => name === header,
				);
				const cell = sheet[utils.encode_cell({ r, c })];
				fields[header || `未命名列${c + 1}`] =
					isDateOrTime && typeof value === "number" && cell
						? utils.format_cell(cell)
						: String(value ?? "");
			});
			const row: SourceRow = { sheet: sheetName, row: r + 1, fields };
			source.rows.push(row);
			if (!isTransaction) {
				source.auxiliaryCount++;
				continue;
			}
			const feedback = clean(fields.查询反馈结果原因);
			if (
				(/无.*明细|无记录|不存在|失败|未查到|无此|无账户|无账/.test(feedback) ||
					clean(fields.查询反馈结果) === "失败") &&
				(!get(row, "time") ||
					moneyMinor(get(row, "amount")) === null ||
					moneyMinor(get(row, "amount")) === "0")
			) {
				source.feedbackCount++;
				issue(row, "feedback", feedback || "银行查询失败");
				continue;
			}
			try {
				const amountMinor = moneyMinor(get(row, "amount"));
				if (!amountMinor || amountMinor === "0")
					throw new Error("金额缺失、为零或不是可确认的非负两位小数");
				const ownerAccount = accountNumber(get(row, "ownerAccount"));
				if (!ownerAccount) throw new Error("缺少本方账号");
				for (const [c, header] of headers.entries()) {
					if (
						[
							...aliases.ownerAccount,
							...aliases.otherAccount,
							...aliases.otherCard,
						].includes(header as "账号") &&
						typeof cells[c] === "number" &&
						!Number.isSafeInteger(cells[c])
					)
						throw new Error("账号以超长数值存储，原始精度可能已丢失");
				}
				const otherAccount = accountNumber(
					get(row, "otherAccount") || get(row, "otherCard"),
				);
				const directionValue = get(row, "direction");
				const direction = ["借", "出", "支出", "付", "D"].includes(
					directionValue,
				)
					? "out"
					: ["贷", "进", "收入", "收", "C"].includes(directionValue)
						? "in"
						: null;
				if (!direction) throw new Error(`无法识别借贷方向：${directionValue}`);
				const timestamp = bankTimestamp(get(row, "date"), get(row, "time"));
				if (!timestamp)
					throw new Error("交易日期或时间缺失/无效，需核对完整时间");
				const rawCurrency =
					get(row, "currency") || (usesYuanTemplate ? "CNY" : "");
				const currency = [
					"人民币",
					"人民币元",
					"RMB",
					"CNY",
					"156",
					"01",
				].includes(rawCurrency)
					? "CNY"
					: rawCurrency.toUpperCase();
				if (!/^[A-Z]{3}$/.test(currency))
					throw new Error(`币种未识别：${rawCurrency || "空"}`);
				if (/失败|撤销/.test(clean(fields.交易是否成功)))
					throw new Error("银行标记交易失败或撤销，暂不纳入资金流");
				source.observations.push({
					id: digest(`${sha256}:${sheetName}:${r + 1}`),
					sourceId: sha256,
					sheet: sheetName,
					row: r + 1,
					ownerAccount,
					ownerName: get(row, "ownerName"),
					otherAccount,
					otherName: get(row, "otherName"),
					direction,
					amountMinor,
					balanceMinor: moneyMinor(get(row, "balance")),
					currency,
					timestamp,
					bankReference: get(row, "reference"),
					summary: get(row, "summary"),
				});
				if (!otherAccount)
					issue(
						row,
						"unknown-counterparty",
						"对方账号缺失：建立本交易专属待核节点，不与其他未知账户合并",
					);
			} catch (error) {
				issue(
					row,
					"quarantine",
					error instanceof Error ? error.message : "行解析失败",
				);
			}
		}
	}
	if (!recognized)
		throw new Error(
			"未识别任何账户/交易表头，请使用标准表头或转换文件后重试。",
		);
	return source;
}
