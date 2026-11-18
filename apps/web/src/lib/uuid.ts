/**
 * @file 浏览器稳定实体 ID 的 UUID v4 生成与外部 UUID 参数校验入口。
 * 创建时间：2026-11-07；修改时间：2026-11-18。
 * 版本作用：兼容普通 HTTP 局域网中未开放 randomUUID 的浏览器环境，并统一路由查询参数 UUID 校验。
 * 被调用：各模块路由、笔录、计算器、文书及主题保存；调用：Web Crypto。
 * 预期结果：优先使用原生实现，否则使用安全随机字节；非法查询 ID 统一收敛为 undefined。
 */
const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** 校验路由查询参数等外部输入的合法 UUID（v1–v8），非法格式返回 undefined。 */
export function parseOptionalUuid(value: unknown): string | undefined {
	return typeof value === "string" && UUID_PATTERN.test(value)
		? value
		: undefined;
}

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
