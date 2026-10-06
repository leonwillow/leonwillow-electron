/**
 * @file 案件原件的 RustFS / S3 存储适配。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-06
 * 版本作用：按案件和原始字节哈希存储，上传及读取均核验完整性。
 * 被调用：启动入口、导入队列、worker、原件下载及迁移脚本。
 * 调用：AWS S3 SDK；构造工厂不连接网络，第一次写入创建私有桶。
 * 预期结果：存储不可用时拒绝入队；不同案件不共用对象路径。
 */
import { createHash } from "node:crypto";
import {
	CreateBucketCommand,
	GetObjectCommand,
	HeadBucketCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import type { FundsFileRef } from "@leonwillow-electron/db/schema";
import { getServerResources } from "../../server-resources";
import { AccessError } from "../access/service";

export type FundsFileConfig = {
	RUSTFS_ENDPOINT: string;
	RUSTFS_BUCKET: string;
	RUSTFS_ACCESS_KEY: string;
	RUSTFS_SECRET_KEY: string;
};
export const fileHash = (bytes: Uint8Array) =>
	createHash("sha256").update(bytes).digest("hex");
export function createFundsFileStore(config: FundsFileConfig) {
	const client = new S3Client({
		endpoint: config.RUSTFS_ENDPOINT,
		region: "us-east-1",
		credentials: {
			accessKeyId: config.RUSTFS_ACCESS_KEY,
			secretAccessKey: config.RUSTFS_SECRET_KEY,
		},
		forcePathStyle: true,
		maxAttempts: 3,
		requestHandler: { connectionTimeout: 5_000, requestTimeout: 60_000 },
	});
	let ready: Promise<void> | undefined;
	async function ensureBucket() {
		ready ??= (async () => {
			try {
				await client.send(
					new HeadBucketCommand({ Bucket: config.RUSTFS_BUCKET }),
				);
			} catch (error) {
				if (
					!(error instanceof Error) ||
					!["NotFound", "NoSuchBucket"].includes(error.name)
				)
					throw error;
				try {
					await client.send(
						new CreateBucketCommand({ Bucket: config.RUSTFS_BUCKET }),
					);
				} catch (creationError) {
					if (
						!(creationError instanceof Error) ||
						creationError.name !== "BucketAlreadyOwnedByYou"
					)
						throw creationError;
				}
			}
		})().catch((error: unknown) => {
			ready = undefined;
			throw error;
		});
		return ready;
	}
	/** 必须传入已授权的案件 ID；引用必须属于此案且下载字节必须与摘要一致。 */
	async function read(caseId: string, ref: FundsFileRef) {
		if (
			ref.bucket !== config.RUSTFS_BUCKET ||
			ref.key !== `cases/${caseId}/originals/${ref.sha256}`
		)
			throw new Error("原件存储引用与当前案件不符。");
		const object = await client.send(
			new GetObjectCommand({ Bucket: ref.bucket, Key: ref.key }),
		);
		if (!object.Body) throw new Error("原件内容缺失。");
		const bytes = await object.Body.transformToByteArray();
		if (bytes.length !== ref.size || fileHash(bytes) !== ref.sha256)
			throw new Error("原件完整性校验失败，停止处理。");
		return bytes;
	}
	return {
		/** 原件逐字节写入并回读校验；失败时调用方不得创建可处理任务。 */
		async put(caseId: string, bytes: Uint8Array): Promise<FundsFileRef> {
			await ensureBucket();
			const sha256 = fileHash(bytes);
			const ref = {
				bucket: config.RUSTFS_BUCKET,
				key: `cases/${caseId}/originals/${sha256}`,
				sha256,
				size: bytes.length,
			};
			await client.send(
				new PutObjectCommand({
					Bucket: ref.bucket,
					Key: ref.key,
					Body: bytes,
					ContentType: "application/octet-stream",
					Metadata: { sha256 },
				}),
			);
			await read(caseId, ref);
			return ref;
		},
		read,
		close: () => client.destroy(),
	};
}
export type FundsFileStore = ReturnType<typeof createFundsFileStore>;
export function fundsFiles() {
	const store = getServerResources().fundsFiles;
	if (!store)
		throw new AccessError(
			503,
			"FILE_STORE_UNAVAILABLE",
			"原件存储未配置，请稍后重试。",
		);
	return store;
}
/** 仅未迁移的旧记录可读数据库字节；有对象引用时绝不静默回退。 */
export async function readStoredFile(
	caseId: string,
	record: { fileRef: FundsFileRef | null; bytesBase64: string | null },
) {
	try {
		if (record.fileRef) return await fundsFiles().read(caseId, record.fileRef);
		if (record.bytesBase64 !== null)
			return new Uint8Array(Buffer.from(record.bytesBase64, "base64"));
		throw new Error("没有原件引用");
	} catch {
		throw new AccessError(
			503,
			"ORIGINAL_UNAVAILABLE",
			"原件读取或完整性校验失败，请检查 RustFS 后重试。",
		);
	}
}
export async function saveOriginal(caseId: string, bytes: Uint8Array) {
	try {
		return await fundsFiles().put(caseId, bytes);
	} catch {
		throw new AccessError(
			503,
			"FILE_STORE_UNAVAILABLE",
			"RustFS 原件保存或校验失败，本批尚未提交，请稍后重试。",
		);
	}
}
/** 下载原始字节，不转码、不重建 Excel；文件名使用 RFC 5987。 */
export function originalResponse(name: string, bytes: Uint8Array) {
	return new Response(new Blob([new Uint8Array(bytes)]), {
		headers: {
			"content-type": "application/octet-stream",
			"content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16)}`)}`,
			"cache-control": "private, no-store",
		},
	});
}
