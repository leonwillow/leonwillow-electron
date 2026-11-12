/**
 * @file 桌面 API 地址的原子持久化与恢复。
 * 创建时间：2026-11-10；修改时间：2026-11-10。
 * 版本作用：主进程独占连接配置，不保存登录凭据。
 * 被调用：main；调用：Node 文件 API 和 desktop-bridge 校验。
 * 预期结果：无配置时使用构建默认；写入成功后才切换，损坏配置可在登录页恢复。
 */
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
	type ConnectionInput,
	type ConnectionStatus,
	connectionInput,
	normalizeConnection,
} from "@leonwillow-electron/desktop-bridge";

/** 文件只能由主进程传入；读取失败回到默认并提供警告，保存失败保持原状态。 */
export async function createConnectionStore(file: string, defaultUrl: string) {
	const normalizedDefault = normalizeConnection(connectionInput(defaultUrl));
	let customUrl: string | null = null;
	let warning: string | undefined;
	try {
		const value: unknown = JSON.parse(await readFile(file, "utf8"));
		if (
			!value ||
			typeof value !== "object" ||
			!("version" in value) ||
			value.version !== 1 ||
			!("customUrl" in value) ||
			typeof value.customUrl !== "string"
		)
			throw new Error("无效配置");
		customUrl = normalizeConnection(connectionInput(value.customUrl));
	} catch (error) {
		if (
			!(
				error &&
				typeof error === "object" &&
				"code" in error &&
				error.code === "ENOENT"
			)
		)
			warning = "已保存的服务器配置无法读取，当前使用默认地址，请重新设置。";
	}
	const status = (): ConnectionStatus => ({
		defaultUrl: normalizedDefault,
		customUrl,
		effectiveUrl: customUrl ?? normalizedDefault,
		...(warning ? { warning } : {}),
	});
	let pending = Promise.resolve();
	return {
		status,
		/** 串行保存完整快照；null 删除覆盖值，失败时不改变内存中生效的地址。 */
		save(input: ConnectionInput | null): Promise<ConnectionStatus> {
			const next = input === null ? null : normalizeConnection(input);
			const operation = pending.then(async () => {
				await mkdir(dirname(file), { recursive: true });
				if (next === null) await rm(file, { force: true });
				else {
					const temporary = `${file}.${crypto.randomUUID()}.tmp`;
					try {
						await writeFile(
							temporary,
							JSON.stringify({ version: 1, customUrl: next }),
							{ mode: 0o600 },
						);
						await rename(temporary, file);
					} finally {
						await rm(temporary, { force: true });
					}
				}
				customUrl = next;
				warning = undefined;
				return status();
			});
			pending = operation.then(
				() => undefined,
				() => undefined,
			);
			return operation;
		},
	};
}
