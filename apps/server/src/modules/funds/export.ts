/**
 * @file 标准导入模板与分析字段白名单。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-07
 * 版本作用：导入模板与标准流水共用精简字段，原文及来源由系统独立存档。
 * 被调用：funds 导出 API、测试资料生成脚本；调用：内部规范契约。
 * 功能：统一账户及交易表头、人民币元金额与完整交易时间。
 * 预期结果：标准 CSV 可再次导入，不把任务控制字段、内部册页号带入分析表。
 */
import type { ParsedSource } from "./types";

export const standardFields = [
	["本方账号", "核心", "必填；文本保存完整账号，禁止科学计数"],
	["本方户名", "核心", "建议填写；不能只凭同名合并主体"],
	["对方账号", "核心", "有则必填；缺失保留待核节点"],
	["对方户名", "核心", "有则保留；用于检索与核对"],
	["出入方向", "核心", "必填；只允许出或入；出=本方流出，入=本方流入"],
	["交易时间", "核心", "必填；YYYY-MM-DD HH:mm:ss，中国标准时间"],
	["交易金额", "核心", "必填；人民币元，最多两位小数；负数退货/冲正先待核"],
	["账户余额", "核心", "交易后本方余额；用于余额校验与混同研判"],
	["交易流水号", "核心", "银行原编号；不是全局唯一交易 ID"],
	["摘要", "核心", "用于识别用途、退款、手续费等"],
	["查询银行", "辅助", "原反馈中的目标机构；不冒充开户行"],
	["对方开户行", "辅助", "用于确定后续调取机构"],
	["备注", "辅助", "合并扩充备注/备注中的有效内容"],
] as const;
export const standardHeaders = standardFields.map(([name]) => name);
export const templateHeaders = standardHeaders;
const pick = (raw: Record<string, string>, ...keys: string[]) =>
	keys.map((key) => raw[key]?.trim() ?? "").find(Boolean) ?? "";
export const decimalAmount = (minor: string) => {
	const value = BigInt(minor);
	const sign = value < 0n ? "-" : "";
	const abs = value < 0n ? -value : value;
	return `${sign}${abs / 100n}.${(abs % 100n).toString().padStart(2, "0")}`;
};

/** 导出人民币来源观测；外币或无效方向拒绝导出，避免重新导入时改变交易含义。 */
export function standardRows(source: ParsedSource): string[][] {
	if (source.observations.some((observation) => observation.currency !== "CNY"))
		throw new RangeError(
			"精简模板仅支持人民币，含外币的资料不能导出为此模板。",
		);
	const rawRows = new Map(
		source.rows.map((row) => [`${row.sheet}:${row.row}`, row.fields]),
	);
	return source.observations.map((o) => {
		if (o.direction !== "out" && o.direction !== "in")
			throw new RangeError("出入方向无效，不能导出为标准模板。");
		const raw = rawRows.get(`${o.sheet}:${o.row}`) ?? {};
		return [
			o.ownerAccount,
			o.ownerName,
			o.otherAccount,
			o.otherName,
			o.direction === "out" ? "出" : "入",
			o.timestamp.slice(0, 19).replace("T", " "),
			decimalAmount(o.amountMinor),
			o.balanceMinor ? decimalAmount(o.balanceMinor) : "",
			o.bankReference,
			o.summary,
			o.queryBank ?? pick(raw, "查询银行", "目标机构"),
			o.counterpartyBank ??
				pick(raw, "对方开户行", "对方行名", "交易对方账号开户行"),
			o.remarks ??
				[
					...new Set([raw.扩充备注?.trim(), raw.备注?.trim()].filter(Boolean)),
				].join("；"),
		];
	});
}

/** RFC 4180 CSV；文本公式前加单引号，账号仍是原始十进制文本，Excel 应按文本导入。 */
export function csvDocument(
	headers: readonly string[],
	rows: (string | number)[][],
) {
	const quote = (value: string | number) => {
		const text = String(value);
		const safe =
			/^[=+@]/.test(text) || /^-[^\d.]/.test(text) ? `'${text}` : text;
		return `"${safe.replaceAll('"', '""')}"`;
	};
	return `\uFEFF${[headers, ...rows].map((row) => row.map(quote).join(",")).join("\r\n")}\r\n`;
}
