/**
 * @file 实时权限查询的短时交接缓存与并发代际状态机。
 * 创建时间：2026-11-21
 * 修改时间：2026-11-21
 * 版本作用：隔离纯缓存状态与网络客户端，确保登出/改权/强制刷新立即作废在途旧请求。
 * 被调用：lib/access、access-cache 单元测试；调用：无外部运行时依赖。
 * 功能：1 秒内合并重定向交接读取，clear() 递增代际号防止迟到响应回写缓存，支持 force 绕过缓存。
 * 预期结果：迟到请求绝不污染新会话或新权限快照。
 */

export function createAccessCache<T extends object>(
	fetcher: () => Promise<T | null>,
	ttlMs = 1000,
	now: () => number = () => Date.now(),
) {
	let generation = 0;
	let inFlight: Promise<T | null> | null = null;
	let recent: { value: T; expiresAt: number } | null = null;

	const clear = () => {
		generation += 1;
		inFlight = null;
		recent = null;
	};

	const get = async (options?: { force?: boolean }): Promise<T | null> => {
		const force = options?.force === true;
		if (!force && recent && now() < recent.expiresAt) {
			return recent.value;
		}
		if (!force && inFlight) return inFlight;
		const requestGeneration = force ? ++generation : generation;
		const request = fetcher()
			.then((value) => {
				if (requestGeneration === generation) {
					recent = value ? { value, expiresAt: now() + ttlMs } : null;
				}
				return value;
			})
			.finally(() => {
				if (inFlight === request) inFlight = null;
			});
		inFlight = request;
		return request;
	};

	return { clear, get };
}
