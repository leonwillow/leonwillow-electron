/**
 * @file 普通 HTTP 局域网下 UUID v4 的浏览器兼容回归。
 * 创建时间：2026-11-07；修改时间：2026-11-07。
 * 被调用：Web Bun 测试；调用：生产 UUID 工具和 Web Crypto。
 * 预期结果：原生实现优先；仅有 getRandomValues 时仍生成合法、独立的实体 ID。
 */
import { expect, test } from "bun:test";
import { randomUUID } from "../src/lib/uuid";

test("保留原生 UUID，普通 HTTP 环境使用安全随机字节", () => {
	const native = crypto.randomUUID();
	expect(
		randomUUID({
			randomUUID: () => native,
			getRandomValues: crypto.getRandomValues.bind(crypto),
		}),
	).toBe(native);
	const fallback = { getRandomValues: crypto.getRandomValues.bind(crypto) };
	const values = Array.from({ length: 100 }, () => randomUUID(fallback));
	for (const value of values)
		expect(value).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
		);
	expect(new Set(values).size).toBe(100);
});
