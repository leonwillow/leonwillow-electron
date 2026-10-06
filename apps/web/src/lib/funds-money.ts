/**
 * @file 资金金额的无损显示。
 * 创建时间：2026-10-07
 * 修改时间：2026-10-07
 * 版本作用：交易与收付差额共用整数分格式化，独立于网络客户端。
 * 被调用：funds 显示工具、金额测试；调用：BigInt 与本地化整数格式。
 * 预期结果：负差额、小于一元的金额及超安全整数均保留符号和两位小数。
 */
/** minor 为整数分字符串；非法整数由 BigInt 抛错，不静默转换为零。 */
export function formatFunds(minor: string, currency = "CNY") {
	const value = BigInt(minor);
	const absolute = value < 0n ? -value : value;
	const whole = absolute / 100n;
	const cents = (absolute % 100n).toString().padStart(2, "0");
	return `${value < 0n ? "-" : ""}${currency === "CNY" ? "¥" : `${currency} `}${whole.toLocaleString("zh-CN")}.${cents}`;
}
