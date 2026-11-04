/**
 * @file 案件导入任务队列、可见进度、可恢复后台处理。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-20
 * 版本作用：上传只持久化；独立 worker 完成 AI、标准导入、去重和图同步。
 * 被调用：funds API、funds-worker 入口及集成测试。
 * 调用：PostgreSQL 任务租约、AI normalizer、正式案件服务。
 * 预期结果：进程退出可恢复；文件校验全部完成后才提交该批，失败原因可见。
 */
import {
	type FundsFileRef,
	fundsCase,
	fundsJob,
	fundsJobFile,
	user,
} from "@leonwillow-electron/db/schema";
import { and, asc, desc, eq, isNull, lte, or, sql } from "drizzle-orm";
import { getServerResources } from "../../server-resources";
import { AccessError } from "../access/service";
import {
	type AiConfig,
	type NormalizationReport,
	normalizeWithAi,
} from "./ai-normalizer";
import { csvDocument, standardHeaders, standardRows } from "./export";
import { originalResponse, readStoredFile, saveOriginal } from "./file-store";
import { parseStatement } from "./parser";
import {
	type Actor,
	caseDetails,
	commitPreparedSources,
	findCase,
	lockCase,
	rescanSubjects,
	synchronize,
} from "./service";
import type { ParsedSource } from "./types";

type JobEvent = { at: string; stage: string; message: string };
type JobResult = {
	added?: number;
	skipped?: number;
	revision: number;
	graphRevision: number;
	totals: Awaited<ReturnType<typeof caseDetails>>["totals"];
	subjectSummary: Awaited<ReturnType<typeof caseDetails>>["subjectSummary"];
	graphReady: boolean;
	message: string;
};

/** 入队原子保存所有文件。案件与任务操作沿用同一访问检查。 */
export async function enqueueImport(
	actor: Actor,
	caseId: string,
	files: { name: string; bytes: Uint8Array }[],
	mode: "ai" | "standard",
) {
	await findCase(actor, caseId);
	if (
		!files.length ||
		files.length > 32 ||
		files.some((f) => !f.bytes.length || f.bytes.length > 20 * 1024 * 1024) ||
		files.reduce((n, f) => n + f.bytes.length, 0) > 100 * 1024 * 1024
	)
		throw new AccessError(
			400,
			"IMPORT_LIMIT",
			"每批 1–32 个文件，单文件不超过 20 MB，整批不超过 100 MB。",
		);
	if (files.some((f) => !/\.(csv|tsv|xlsx|xls)$/i.test(f.name)))
		throw new AccessError(
			400,
			"FILE_UNSUPPORTED",
			"当前支持 Excel、CSV、TSV，请将图文文件转换为表格后上传。",
		);
	const stored: ((typeof files)[number] & { fileRef: FundsFileRef })[] = [];
	for (const file of files)
		stored.push({ ...file, fileRef: await saveOriginal(caseId, file.bytes) });
	const id = crypto.randomUUID();
	await getServerResources().db.transaction(async (tx) => {
		await lockCase(tx, actor, caseId);
		await tx.insert(fundsJob).values({
			id,
			caseId,
			actorId: actor.user.id,
			mode,
			totalFiles: files.length,
			events: [
				{
					at: new Date().toISOString(),
					stage: "queued",
					message: `${files.length} 个原件已保存至对象存储并通过 SHA-256 校验，等待后台处理。`,
				},
			],
		});
		await tx.insert(fundsJobFile).values(
			stored.map((f, ordinal) => ({
				id: crypto.randomUUID(),
				jobId: id,
				ordinal,
				name: f.name.replaceAll("\\", "/").split("/").pop() ?? "流水",
				fileRef: f.fileRef,
			})),
		);
	});
	return {
		id,
		caseId,
		status: "queued",
		message: "文件已保存，后台会继续处理，可以离开页面。",
	};
}

export async function enqueueSync(
	actor: Actor,
	caseId: string,
	mode: "sync" | "subjects" = "sync",
) {
	await findCase(actor, caseId);
	const id = crypto.randomUUID();
	await getServerResources().db.transaction(async (tx) => {
		await lockCase(tx, actor, caseId);
		await tx
			.insert(fundsJob)
			.values({ id, caseId, actorId: actor.user.id, mode });
	});
	return {
		id,
		message:
			mode === "subjects" ? "主体识别任务已排队。" : "图同步任务已排队。",
	};
}

export async function listJobs(actor: Actor, caseId: string) {
	await findCase(actor, caseId);
	const rows = await getServerResources()
		.db.select()
		.from(fundsJob)
		.where(eq(fundsJob.caseId, caseId))
		.orderBy(desc(fundsJob.createdAt))
		.limit(30);
	return Promise.all(
		rows.map(async (job) => ({
			id: job.id,
			mode: job.mode,
			status: job.status,
			stage: job.stage,
			completedFiles: job.completedFiles,
			totalFiles: job.totalFiles,
			attempts: job.attempts,
			error: job.error,
			createdAt: job.createdAt,
			updatedAt: job.updatedAt,
			result: job.result as JobResult | null,
			events: job.events as JobEvent[],
			files: (
				await getServerResources()
					.db.select({
						id: fundsJobFile.id,
						name: fundsJobFile.name,
						status: fundsJobFile.status,
						report: fundsJobFile.report,
						fileRef: fundsJobFile.fileRef,
					})
					.from(fundsJobFile)
					.where(eq(fundsJobFile.jobId, job.id))
					.orderBy(asc(fundsJobFile.ordinal))
			).map((f) => ({ ...f, report: f.report as NormalizationReport | null })),
		})),
	);
}

export async function retryJob(actor: Actor, caseId: string, jobId: string) {
	return getServerResources().db.transaction(async (tx) => {
		await lockCase(tx, actor, caseId);
		const [row] = await tx
			.update(fundsJob)
			.set({
				status: "queued",
				error: "",
				attempts: 0,
				nextRunAt: new Date(),
				leaseOwner: null,
				leaseUntil: null,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(fundsJob.id, jobId),
					eq(fundsJob.caseId, caseId),
					eq(fundsJob.status, "failed"),
				),
			)
			.returning({ id: fundsJob.id });
		if (!row)
			throw new AccessError(
				409,
				"JOB_NOT_RETRYABLE",
				"任务不存在或正在处理，无需重复启动。",
			);
		return row;
	});
}

export async function downloadJobFile(
	actor: Actor,
	caseId: string,
	jobId: string,
	fileId: string,
	format: "csv" | "report" | "original",
) {
	await findCase(actor, caseId);
	const [entry] = await getServerResources()
		.db.select({ file: fundsJobFile })
		.from(fundsJobFile)
		.innerJoin(fundsJob, eq(fundsJob.id, fundsJobFile.jobId))
		.where(
			and(
				eq(fundsJob.id, jobId),
				eq(fundsJob.caseId, caseId),
				eq(fundsJobFile.id, fileId),
			),
		);
	if (entry && format === "original")
		return originalResponse(
			entry.file.name,
			await readStoredFile(caseId, entry.file),
		);
	if (!entry?.file.standardCsv)
		throw new AccessError(
			404,
			"STANDARD_FILE_UNAVAILABLE",
			"标准文件尚未生成。",
		);
	const parsed = entry.file.parsed as ParsedSource;
	// 历史任务仍保留原报告；下载按当前模板生成，旧借贷 CSV 不再流入标准入口。
	if (format === "csv")
		return csvDocument(standardHeaders, standardRows(parsed));
	return JSON.stringify(
		{
			file: entry.file.name,
			report: entry.file.report,
			issues: parsed.issues,
			provenance: parsed.observations.map((o, index) => ({
				standardRow: index + 2,
				sourceId: o.sourceId,
				sheet: o.sheet,
				row: o.row,
			})),
		},
		null,
		2,
	);
}

async function claimJob(owner: string) {
	const db = getServerResources().db;
	return db.transaction(async (tx) => {
		const now = new Date();
		const [job] = await tx
			.select()
			.from(fundsJob)
			.where(
				and(
					or(
						and(eq(fundsJob.status, "queued"), lte(fundsJob.nextRunAt, now)),
						and(eq(fundsJob.status, "running"), lte(fundsJob.leaseUntil, now)),
					),
					sql`EXISTS (SELECT 1 FROM funds_case c WHERE c.id = ${fundsJob.caseId} AND c.deleted_at IS NULL)`,
					sql`NOT EXISTS (SELECT 1 FROM funds_job other WHERE other.case_id = ${fundsJob.caseId} AND other.id <> ${fundsJob.id} AND other.status = 'running' AND other.lease_until > ${now})`,
				),
			)
			.orderBy(asc(fundsJob.createdAt))
			.limit(1)
			.for("update", { skipLocked: true });
		if (!job) return null;
		// 不同任务行也必须争用同一个案件行，避免两个消费者同时领取同案任务。
		const [record] = await tx
			.select({ id: fundsCase.id })
			.from(fundsCase)
			.where(and(eq(fundsCase.id, job.caseId), isNull(fundsCase.deletedAt)))
			.for("update", { skipLocked: true });
		if (!record) return null;
		const [active] = await tx
			.select({ id: fundsJob.id })
			.from(fundsJob)
			.where(
				and(
					eq(fundsJob.caseId, job.caseId),
					eq(fundsJob.status, "running"),
					sql`${fundsJob.id} <> ${job.id}`,
					sql`${fundsJob.leaseUntil} > ${now}`,
				),
			)
			.limit(1);
		if (active) return null;
		const [claimed] = await tx
			.update(fundsJob)
			.set({
				status: "running",
				leaseOwner: owner,
				leaseUntil: new Date(Date.now() + 300_000),
				attempts: job.attempts + 1,
				error: "",
				updatedAt: now,
			})
			.where(eq(fundsJob.id, job.id))
			.returning();
		return claimed ?? null;
	});
}

/** 每次处理一个持久任务。可供独立进程循环或集成测试显式驱动。 */
export async function processNextFundsJob(
	config: AiConfig,
	options: {
		normalize?: typeof normalizeWithAi;
		owner?: string;
		signal?: AbortSignal;
	} = {},
) {
	const owner = options.owner ?? crypto.randomUUID();
	const job = await claimJob(owner);
	if (!job) return false;
	const db = getServerResources().db;
	const controller = new AbortController();
	const signal = options.signal
		? AbortSignal.any([options.signal, controller.signal])
		: controller.signal;
	const predicate = and(
		eq(fundsJob.id, job.id),
		eq(fundsJob.leaseOwner, owner),
		eq(fundsJob.status, "running"),
	);
	const events = [...(job.events as JobEvent[])];
	const progress = async (
		stage: string,
		message: string,
		completedFiles = job.completedFiles,
	) => {
		signal.throwIfAborted();
		events.push({ at: new Date().toISOString(), stage, message });
		const changed = await db
			.update(fundsJob)
			.set({
				stage,
				events,
				completedFiles,
				updatedAt: new Date(),
				leaseUntil: new Date(Date.now() + 300_000),
			})
			.where(predicate)
			.returning({ id: fundsJob.id });
		if (!changed.length) throw new Error("任务租约已转移。");
	};
	const heartbeat = setInterval(() => {
		void db
			.update(fundsJob)
			.set({
				leaseUntil: new Date(Date.now() + 300_000),
				updatedAt: new Date(),
			})
			.where(predicate)
			.returning({ id: fundsJob.id })
			.then((rows) => {
				if (!rows.length) controller.abort();
			})
			.catch(() => controller.abort());
	}, 30_000);
	try {
		const [person] = await db
			.select()
			.from(user)
			.where(eq(user.id, job.actorId));
		if (!person) throw new Error("任务所属人员不存在。");
		const actor = { user: person } as Actor;
		await findCase(actor, job.caseId);
		let imported:
			| { added: number; skipped: number; revision: number }
			| undefined;
		if (job.mode === "subjects") {
			await progress(
				"identifying",
				"正在按证件与完整户名重新识别本案账户归属，保留人工调整。",
			);
			await rescanSubjects(actor, job.caseId, { jobId: job.id, owner });
		}
		if (job.mode === "ai" || job.mode === "standard") {
			const files = await db
				.select()
				.from(fundsJobFile)
				.where(eq(fundsJobFile.jobId, job.id))
				.orderBy(asc(fundsJobFile.ordinal));
			const prepared: Parameters<typeof commitPreparedSources>[2] = [];
			let count = 0;
			for (const file of files) {
				signal.throwIfAborted();
				const bytes = await readStoredFile(job.caseId, file);
				let source = file.parsed as ParsedSource | null;
				if (!source) {
					await progress(
						job.mode === "ai" ? "standardizing" : "validating",
						`${file.name}：${job.mode === "ai" ? "AI 正在识别表头与转换规则" : "正在检查标准文件"}。`,
						count,
					);
					const result =
						job.mode === "ai"
							? await (options.normalize ?? normalizeWithAi)(
									file.name,
									bytes,
									config,
									signal,
								)
							: standardFile(file.name, bytes);
					source = result.source;
					await progress(
						"validating",
						`${file.name}：标准 ${result.report.standardRows} 行，待核 ${result.report.quarantined} 行，行数守恒检查通过。`,
						count,
					);
					await db
						.update(fundsJobFile)
						.set({
							status: "ready",
							standardCsv: result.csv,
							parsed: source,
							report: result.report,
						})
						.where(eq(fundsJobFile.id, file.id));
				}
				prepared.push({
					source,
					file: { name: file.name, bytes },
					fileRef: file.fileRef ?? undefined,
				});
				count++;
				await progress(
					"validated",
					`${file.name}：标准文件已生成，可下载核对。`,
					count,
				);
			}
			await progress(
				"reconciling",
				"全部文件校验完成，正在按案件进行重复识别、双边配对、主体归属识别和规范交易入库。",
				files.length,
			);
			imported = await commitPreparedSources(actor, job.caseId, prepared, {
				jobId: job.id,
				owner,
			});
		}
		await progress(
			"projecting",
			"规范交易已保存，正在更新当前案件的主体与交易图。",
			job.totalFiles,
		);
		const projection = await synchronize(actor, job.caseId);
		if (!projection.graphReady) throw new Error(projection.message);
		const details = await caseDetails(actor, job.caseId);
		const summary = await getServerResources().fundsGraph?.summary(job.caseId);
		if (!summary || summary.transactions !== details.totals.transactionCount)
			throw new Error("图中交易数与规范交易数不一致，尚未通过落库核验。");
		await progress(
			"completed",
			`完成：${details.totals.transactionCount} 笔交易已入图；归并重复 ${details.totals.duplicates} 条，双边对应 ${details.totals.mirrored} 对；${details.subjectSummary.mergedGroups} 个主体包含多个账户，其中 ${details.subjectSummary.inferredGroups} 个按完整户名推断。`,
			job.totalFiles,
		);
		const result: JobResult = {
			...imported,
			revision: details.revision,
			graphRevision: details.graphRevision,
			totals: details.totals,
			subjectSummary: details.subjectSummary,
			...projection,
		};
		await db
			.update(fundsJob)
			.set({
				status: "completed",
				result,
				leaseOwner: null,
				leaseUntil: null,
				updatedAt: new Date(),
			})
			.where(predicate);
	} catch (error) {
		const message = error instanceof Error ? error.message : "后台处理失败。";
		const retry = job.attempts < 3 && !signal.aborted;
		events.push({
			at: new Date().toISOString(),
			stage: retry ? "retrying" : "failed",
			message,
		});
		await db
			.update(fundsJob)
			.set({
				status: retry ? "queued" : "failed",
				stage: retry ? "retrying" : "failed",
				events,
				error: message,
				nextRunAt: new Date(Date.now() + job.attempts * 10_000),
				leaseOwner: null,
				leaseUntil: null,
				updatedAt: new Date(),
			})
			.where(predicate);
	} finally {
		clearInterval(heartbeat);
	}
	return true;
}

function standardFile(name: string, bytes: Uint8Array) {
	const source = parseStatement(name, bytes);
	const csv = csvDocument(standardHeaders, standardRows(source));
	const report: NormalizationReport = {
		model: "标准文件校验",
		promptVersion: "13-columns-in-out-v2",
		mappings: [],
		rawRows: source.rows.length,
		standardRows: source.observations.length,
		quarantined: source.issues.filter((i) => i.kind === "quarantine").length,
		feedback: source.feedbackCount,
		auxiliary: source.auxiliaryCount,
		rowConservation: true,
		amountTotals: { incomingMinor: "0", outgoingMinor: "0" },
		warnings: [],
	};
	report.rowConservation =
		report.rawRows ===
		report.standardRows +
			report.quarantined +
			report.feedback +
			report.auxiliary;
	if (!report.rowConservation)
		throw new Error("文件包含未识别工作表，请改用 AI 标准化入口。");
	for (const direction of ["in", "out"] as const)
		report.amountTotals[
			direction === "in" ? "incomingMinor" : "outgoingMinor"
		] = source.observations
			.filter((o) => o.direction === direction)
			.reduce((sum, o) => sum + BigInt(o.amountMinor), 0n)
			.toString();
	return { source, csv, report };
}
