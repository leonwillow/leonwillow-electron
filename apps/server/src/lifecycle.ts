/**
 * @file 服务监听器与连接池的关闭协调。
 * 创建时间：2026-10-04（本次新建）
 * 修改时间：2026-10-04
 * 版本作用：进程入口持有资源，应用工厂保持无进程副作用。
 * 被调用：index.ts、生命周期测试；调用：注入的 stop/close。
 * 功能：先排空请求，再关闭池；超时强制停止；重复调用共用结果。
 * 预期结果：信号或启动失败不会重复释放资源。
 */

/** 创建幂等关闭函数；timeoutMs 限制整个关闭过程，超时或资源关闭异常时拒绝。 */
export function createShutdown(
	resources: {
		stop: (force: boolean) => Promise<unknown>;
		close: () => Promise<unknown>;
	},
	timeoutMs = 10_000,
) {
	let closing: Promise<void> | undefined;
	let poolClosing: Promise<unknown> | undefined;
	const closePool = () =>
		(poolClosing ??= Promise.resolve().then(resources.close));
	return () => {
		if (closing) return closing;
		let timer: ReturnType<typeof setTimeout>;
		const graceful = Promise.resolve().then(async () => {
			try {
				await resources.stop(false);
			} finally {
				await closePool();
			}
		});
		const deadline = new Promise<never>((_, reject) => {
			timer = setTimeout(() => {
				void Promise.resolve()
					.then(() => resources.stop(true))
					.catch(() => {});
				void closePool().catch(() => {});
				reject(new Error("服务关闭超时，已请求强制停止。"));
			}, timeoutMs);
		});
		closing = Promise.race([graceful, deadline]).finally(() =>
			clearTimeout(timer),
		);
		return closing;
	};
}
