/**
 * @file 实时权限交接缓存的并发代际与失效回归测试。
 * 创建时间：2026-11-21
 * 修改时间：2026-11-21
 * 版本作用：验证 clear() 和 force 强制刷新作废在途旧请求，避免登出或换号后迟到响应重新污染缓存。
 * 被调用：bun test；调用：lib/access-cache。
 * 预期结果：旧请求在 clear() 后返回不会写入缓存，后续查询重新向服务端拉取。
 */
import { expect, test } from "bun:test";
import { createAccessCache } from "../src/lib/access-cache";

test("clear() 作废在途旧请求，迟到响应不会回写污染交接缓存", async () => {
	let clock = 1000;
	let calls = 0;
	const first = Promise.withResolvers<{ user: string } | null>();
	const second = Promise.withResolvers<{ user: string } | null>();
	const cache = createAccessCache(
		() => {
			calls += 1;
			return calls === 1 ? first.promise : second.promise;
		},
		1000,
		() => clock,
	);

	const stalePromise = cache.get();
	// 并发登出或换号：立即清空缓存并递增代际号。
	cache.clear();
	first.resolve({ user: "old-user" });
	expect(await stalePromise).toEqual({ user: "old-user" });

	// 下一轮查询不得命中被作废的旧响应，必须重新发起请求。
	const freshPromise = cache.get();
	expect(calls).toBe(2);
	second.resolve({ user: "new-user" });
	expect(await freshPromise).toEqual({ user: "new-user" });

	// 1 秒内命中最新交接缓存。
	clock += 200;
	expect(await cache.get()).toEqual({ user: "new-user" });
	expect(calls).toBe(2);
});

test("force: true 绕过短时缓存并作废旧在途请求", async () => {
	let calls = 0;
	const first = Promise.withResolvers<{ role: string } | null>();
	const forced = Promise.withResolvers<{ role: string } | null>();
	const cache = createAccessCache(() => {
		calls += 1;
		return calls === 1 ? first.promise : forced.promise;
	}, 1000);

	const p1 = cache.get();
	const p2 = cache.get({ force: true });
	expect(calls).toBe(2);

	forced.resolve({ role: "member" });
	expect(await p2).toEqual({ role: "member" });

	// 更早的请求晚到时不得覆盖强制核验的新结果。
	first.resolve({ role: "admin" });
	await p1;
	expect(await cache.get()).toEqual({ role: "member" });
	expect(calls).toBe(2);
});
