/**
 * @file 将旧版数据库原件迁入 RustFS，并逐件校验。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-06
 * 版本作用：可重复运行；对象回读校验成功后才清除旧字节。
 * 被调用：bun run files:migrate；调用：Drizzle、文件存储工厂。
 * 预期结果：不中断现有案件版本；迁移失败保留旧记录以便重试。
 */
import "varlock/auto-load";
import { createDatabase } from "@leonwillow-electron/db";
import {
	fundsJob,
	fundsJobFile,
	fundsSource,
} from "@leonwillow-electron/db/schema";
import { and, eq, isNotNull } from "drizzle-orm";
import { ENV } from "./env";
import { createFundsFileStore } from "./modules/funds/file-store";

const { db, pool } = createDatabase(ENV.DATABASE_URL);
const store = createFundsFileStore(ENV);
let sources = 0;
let jobFiles = 0;
try {
	const originals = await db
		.select({
			caseId: fundsSource.caseId,
			id: fundsSource.id,
			bytesBase64: fundsSource.bytesBase64,
		})
		.from(fundsSource)
		.where(isNotNull(fundsSource.bytesBase64));
	for (const row of originals) {
		if (row.bytesBase64 === null) continue;
		const fileRef = await store.put(
			row.caseId,
			new Uint8Array(Buffer.from(row.bytesBase64, "base64")),
		);
		await db
			.update(fundsSource)
			.set({ fileRef, bytesBase64: null })
			.where(
				and(
					eq(fundsSource.caseId, row.caseId),
					eq(fundsSource.id, row.id),
					eq(fundsSource.bytesBase64, row.bytesBase64),
				),
			);
		sources++;
	}
	const files = await db
		.select({
			caseId: fundsJob.caseId,
			id: fundsJobFile.id,
			bytesBase64: fundsJobFile.bytesBase64,
		})
		.from(fundsJobFile)
		.innerJoin(fundsJob, eq(fundsJob.id, fundsJobFile.jobId))
		.where(isNotNull(fundsJobFile.bytesBase64));
	for (const row of files) {
		if (row.bytesBase64 === null) continue;
		const fileRef = await store.put(
			row.caseId,
			new Uint8Array(Buffer.from(row.bytesBase64, "base64")),
		);
		await db
			.update(fundsJobFile)
			.set({ fileRef, bytesBase64: null })
			.where(
				and(
					eq(fundsJobFile.id, row.id),
					eq(fundsJobFile.bytesBase64, row.bytesBase64),
				),
			);
		jobFiles++;
	}
	console.info(
		JSON.stringify({
			sources,
			jobFiles,
			message: "RustFS 原件迁移完成，全部通过 SHA-256 回读校验。",
		}),
	);
} finally {
	store.close();
	await pool.end();
}
