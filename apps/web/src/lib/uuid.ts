/**
 * @file 浏览器稳定实体 ID 的 UUID v4 生成入口。
 * 创建时间：2026-11-07；修改时间：2026-11-07。
 * 版本作用：兼容普通 HTTP 局域网中未开放 randomUUID 的浏览器环境。
 * 被调用：笔录、计算器、文书及主题保存；调用：Web Crypto。
 * 预期结果：优先使用原生实现，否则使用安全随机字节，不依赖 Math.random。
 */
export function randomUUID(
	random: Pick<Crypto, "getRandomValues"> &
		Partial<Pick<Crypto, "randomUUID">> = globalThis.crypto,
): string {
	if (random.randomUUID) return random.randomUUID();
	const bytes = random.getRandomValues(new Uint8Array(16));
	bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
	bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
	const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
	return [0, 4, 6, 8, 10]
		.map((start, index, boundaries) =>
			hex.slice(start, boundaries[index + 1] ?? 16).join(""),
		)
		.join("-");
}
