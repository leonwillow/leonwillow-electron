/**
 * @file 资金金额与账户显示名的纯格式化工具。
 * 创建时间：2026-10-07
 * 修改时间：2026-11-21
 * 版本作用：交易金额与账户户名展示独立于网络客户端，便于测试与画布纯计算模块复用。
 * 被调用：funds 显示工具、graph-renderer、金额与画布测试；调用：BigInt 与本地化整数格式。
 * 预期结果：负差额、小于一元的金额及超安全整数均保留符号和两位小数，户名缺失时回退“户名待核”。
 */
/** minor 为整数分字符串；非法整数由 BigInt 抛错，不静默转换为零。 */
export function formatFunds(minor: string, currency = "CNY") {
	const value = BigInt(minor);
	const absolute = value < 0n ? -value : value;
	const whole = absolute / 100n;
	const cents = (absolute % 100n).toString().padStart(2, "0");
	return `${value < 0n ? "-" : ""}${currency === "CNY" ? "¥" : `${currency} `}${whole.toLocaleString("zh-CN")}.${cents}`;
}

export function accountName(account?: {
	identityStatus?: string;
	names: readonly string[];
	ownNames: readonly string[];
}) {
	return (
		(account?.identityStatus === "manual"
			? account.names[0]
			: account?.ownNames.join(" / ")) ||
		account?.names[0] ||
		"户名待核"
	);
}
