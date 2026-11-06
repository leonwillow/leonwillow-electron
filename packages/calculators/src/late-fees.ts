/**
 * @file 普通税款滞纳金的日期、分次缴款与精确计费规则。
 * 创建时间：2026-11-05；修改时间：2026-11-05。
 * 版本作用：浏览器与 API 共用万分之五单利算法，不推定申报期限或减免资格。
 * 被调用：滞纳金编辑器、事务服务和测试；调用：共享整数金额工具。
 * 预期结果：缴款日计费、次日减本金；按税款汇总后四舍五入至分，无效输入不产出合计。
 */
import { cents, exact } from "./index";
export const LATE_FEE_RULES = "tax-late-fee-0.0005-v1";
export const MAX_LIABILITIES = 50;
export const MAX_PAYMENTS = 50;
export const taxTypes = {
	vat: "增值税",
	"cit-annual": "企业所得税（年度汇算）",
	"cit-prepay": "企业所得税（预缴）",
	consumption: "消费税",
	individual: "个人所得税",
	urban: "城市维护建设税",
	stamp: "印花税",
	property: "房产税",
	land: "城镇土地使用税",
	other: "其他税款",
} as const;
export type TaxType = keyof typeof taxTypes;
export type TaxPayment = { id: string; date: string; amount: string };
export type TaxLiability = {
	id: string;
	taxType: TaxType;
	period: string;
	principal: string;
	deadline: string;
	note: string;
	payments: TaxPayment[];
};
export type LateFeeData = { cutoff: string; liabilities: TaxLiability[] };
export type LateFeeDraft = LateFeeData & { name: string };
export type FeeSegment = {
	start: string;
	end: string;
	days: number;
	balance: number;
	/** 六位小数元，保留未舍入金额以核对分段合计。 */
	feeExact: string;
};
export type LiabilityResult = {
	id: string;
	principal: number;
	paid: number;
	remaining: number;
	fee: number;
	total: number;
	days: number;
	segments: FeeSegment[];
};
export type LateFeeResult = {
	rows: { id: string; result: LiabilityResult | null; error: string | null }[];
	totals: {
		principal: number;
		paid: number;
		remaining: number;
		fee: number;
		total: number;
	} | null;
	error: string | null;
};
const DAY = 86_400_000;
/** 按 UTC 日序号计算自然日；不受客户端时区、夏令时或时间部分影响。 */
export function dayNumber(value: string) {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw Error("请选择完整日期");
	const n = Date.parse(`${value}T00:00:00Z`);
	if (!Number.isFinite(n) || new Date(n).toISOString().slice(0, 10) !== value)
		throw Error("日期不存在");
	if (value < "2001-04-30" || value > "2199-12-31")
		throw Error("本计算器仅支持2001年4月30日至2199年12月31日的日期");
	return n / DAY;
}
const readDay = (value: string, label: string) => {
	try {
		return dayNumber(value);
	} catch (e) {
		throw Error(`${label}：${e instanceof Error ? e.message : "日期无效"}`);
	}
};
const dayText = (day: number) => new Date(day * DAY).toISOString().slice(0, 10);
const nonnegative = (value: string, label: string) => {
	let n: number;
	try {
		n = cents(value);
	} catch (e) {
		throw Error(`${label}：${e instanceof Error ? e.message : "金额无效"}`);
	}
	if (n < 0) throw Error(`${label}不能为负数`);
	return n;
};
const exactFee = (numerator: bigint) =>
	`${numerator / 1_000_000n}.${String(numerator % 1_000_000n).padStart(6, "0")}`;
/** deadline 为已确认的最后缴款日。超额缴款、截止日后的缴款及不完整日期均拒绝计算。 */
export function calculateLiability(
	row: TaxLiability,
	cutoff: string,
): LiabilityResult {
	if (!(row.taxType in taxTypes)) throw Error("请选择税种");
	const deadline = readDay(row.deadline, "确认缴款期限");
	const end = readDay(cutoff, "测算截止日");
	const principal = nonnegative(row.principal, "税款本金");
	if (principal === 0) throw Error("税款本金须大于0");
	if (row.payments.length > MAX_PAYMENTS)
		throw Error(`每笔税款最多${MAX_PAYMENTS}次缴款`);
	const payments = row.payments
		.map((p, index) => {
			const day = readDay(p.date, `第${index + 1}次缴款日期`);
			const amount = nonnegative(p.amount, "缴款本金");
			if (amount === 0) throw Error("缴款本金须大于0");
			if (day > end) throw Error("缴款日期不能晚于测算截止日");
			return { day, amount };
		})
		.sort((a, b) => a.day - b.day);
	let balance = principal;
	let cursor = deadline;
	let numerator = 0n;
	const segments: FeeSegment[] = [];
	const accrue = (until: number) => {
		if (until <= cursor) return;
		if (balance > 0) {
			const days = until - cursor;
			const fee = BigInt(balance) * BigInt(days) * 5n;
			numerator += fee;
			segments.push({
				start: dayText(cursor + 1),
				end: dayText(until),
				days,
				balance,
				feeExact: exactFee(fee),
			});
		}
		cursor = until;
	};
	for (const p of payments) {
		if (p.amount > balance) throw Error("累计缴款本金不能超过税款本金");
		accrue(p.day);
		balance -= p.amount;
	}
	accrue(end);
	const fee = exact(Number((numerator + 5_000n) / 10_000n));
	return {
		id: row.id,
		principal,
		paid: principal - balance,
		remaining: balance,
		fee,
		total: exact(balance + fee),
		days: segments.reduce((n, s) => n + s.days, 0),
		segments,
	};
}
/** 未完成的录入仍可保存；每行保留问题，任一无效行令全方案合计为空。 */
export function calculateLateFees(data: LateFeeData): LateFeeResult {
	let error: string | null = null;
	try {
		readDay(data.cutoff, "测算截止日");
		if (!data.liabilities.length) throw Error("请添加至少一笔税款");
		if (data.liabilities.length > MAX_LIABILITIES)
			throw Error(`最多支持${MAX_LIABILITIES}笔税款`);
		if (
			new Set(data.liabilities.map((r) => r.id)).size !==
			data.liabilities.length
		)
			throw Error("税款标识重复");
	} catch (e) {
		error = e instanceof Error ? e.message : "测算数据无效";
	}
	const rows = data.liabilities.map((row) => {
		try {
			if (new Set(row.payments.map((p) => p.id)).size !== row.payments.length)
				throw Error("缴款标识重复");
			return {
				id: row.id,
				result: calculateLiability(row, data.cutoff),
				error: null,
			};
		} catch (e) {
			return {
				id: row.id,
				result: null,
				error: e instanceof Error ? e.message : "税款数据无效",
			};
		}
	});
	const totals =
		error || rows.some((r) => !r.result)
			? null
			: rows.reduce(
					(sum, row) => {
						const r = row.result;
						if (r)
							for (const key of [
								"principal",
								"paid",
								"remaining",
								"fee",
								"total",
							] as const)
								sum[key] = exact(sum[key] + r[key]);
						return sum;
					},
					{ principal: 0, paid: 0, remaining: 0, fee: 0, total: 0 },
				);
	return { rows, totals, error };
}
