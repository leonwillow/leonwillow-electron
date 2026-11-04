/**
 * @file 文书模板管理、年度取号与归属权限的事务服务。
 * 创建时间：2026-10-10；修改时间：2026-10-11。
 * 版本作用：数据库分配唯一序号，模板版本和文书修订分别留存。
 * 被调用：documents API；调用：server-resources、Drizzle、模板编解码。
 * 功能与预期结果：所有获授权人员可查看，普通人员仅编辑本人，管理员标记删除。
 */
import type { DatabaseTransaction } from "@leonwillow-electron/db";
import {
	type DocumentField,
	documentRecord,
	documentRevision,
	documentSequence,
	documentTemplate,
	documentType,
} from "@leonwillow-electron/db/schema";
import { and, count, desc, eq, exists, ilike, isNull, or } from "drizzle-orm";
import { getServerResources } from "../../server-resources";
import { AccessError, type AccessSession } from "../access/service";
import example from "./assets/inquiry-notice.json";
import {
	inspectTemplate,
	renderDocument,
	validateFields,
	validateValues,
} from "./template";

const db = () => getServerResources().db;
const missing = (): never => {
	throw new AccessError(
		404,
		"DOCUMENT_NOT_FOUND",
		"文书或模板不存在，或已被删除。",
	);
};
const conflict = (): never => {
	throw new AccessError(
		409,
		"DOCUMENT_CONFLICT",
		"内容已被其他操作更新，请刷新后重新编辑。",
	);
};
export function requireAdmin(access: AccessSession) {
	if (access.user.role !== "admin")
		throw new AccessError(
			403,
			"DOCUMENT_ADMIN_REQUIRED",
			"只有管理员可以管理模板、调整序号或删除文书。",
		);
}
const numberOf = (prefix: string, year: number, sequence: number | null) =>
	`${prefix}〔${year}〕${sequence === null ? "待取号" : `${sequence}号`}`;
const cleanMetadata = (name: string, prefix: string) => {
	if (
		!name.trim() ||
		!prefix.trim() ||
		Array.from(name + prefix).some((char) => char.charCodeAt(0) < 32)
	)
		throw new AccessError(
			400,
			"INVALID_METADATA",
			"文书名称和文号前缀不能为空或包含控制字符。",
		);
	return { name: name.trim(), prefix: prefix.trim() };
};

async function activeType(typeId: string, tx?: DatabaseTransaction) {
	const query = (tx ?? db())
		.select()
		.from(documentType)
		.where(and(eq(documentType.id, typeId), isNull(documentType.deletedAt)));
	const [type] = tx ? await query.for("update") : await query;
	return type ?? missing();
}
async function templateFor(
	typeId: string,
	version: number,
	tx?: DatabaseTransaction,
) {
	const [template] = await (tx ?? db())
		.select()
		.from(documentTemplate)
		.where(
			and(
				eq(documentTemplate.typeId, typeId),
				eq(documentTemplate.version, version),
			),
		);
	return template ?? missing();
}

export async function listTypes() {
	const rows = await db()
		.select({ type: documentType, template: documentTemplate })
		.from(documentType)
		.innerJoin(
			documentTemplate,
			and(
				eq(documentTemplate.typeId, documentType.id),
				eq(documentTemplate.version, documentType.currentVersion),
			),
		)
		.where(isNull(documentType.deletedAt))
		.orderBy(documentType.createdAt);
	return {
		types: rows.map(({ type, template }) => ({
			id: type.id,
			name: type.name,
			prefix: type.prefix,
			revision: type.revision,
			version: template.version,
			fileName: template.fileName,
			fields: template.fields,
		})),
	};
}

/** 类型导航同时保留仍有可见文书的已删除类型；不暴露模板字节或已删除文书。 */
export async function listCatalog() {
	const database = db();
	const visibleRecords = database
		.select({ id: documentRecord.id })
		.from(documentRecord)
		.where(
			and(
				eq(documentRecord.typeId, documentType.id),
				isNull(documentRecord.deletedAt),
			),
		);
	const rows = await database
		.select({
			id: documentType.id,
			name: documentType.name,
			prefix: documentType.prefix,
			deletedAt: documentType.deletedAt,
		})
		.from(documentType)
		.where(or(isNull(documentType.deletedAt), exists(visibleRecords)))
		.orderBy(documentType.createdAt);
	return {
		types: rows.map(({ deletedAt, ...type }) => ({
			...type,
			archived: deletedAt !== null,
		})),
	};
}

/** 管理员上传标准模板；字节校验和编译先于事务，失败不留下类型或序号。 */
export async function createType(
	access: AccessSession,
	settings: { name: string; prefix: string; year: number; nextNumber: number },
	file?: File,
) {
	requireAdmin(access);
	const bytes = file
		? new Uint8Array(await file.arrayBuffer())
		: Buffer.from(example.bytesBase64, "base64");
	const fileName = file?.name ?? "询问通知书模板.docx";
	const fields = inspectTemplate(bytes, fileName);
	const id = crypto.randomUUID();
	await db().transaction(async (tx) => {
		await tx.insert(documentType).values({
			id,
			...cleanMetadata(settings.name, settings.prefix),
			currentVersion: 1,
			createdBy: access.user.id,
		});
		await tx.insert(documentTemplate).values({
			typeId: id,
			version: 1,
			fileName,
			bytesBase64: Buffer.from(bytes).toString("base64"),
			fields,
			createdBy: access.user.id,
		});
		await tx.insert(documentSequence).values({
			typeId: id,
			year: settings.year,
			lastNumber: settings.nextNumber - 1,
		});
	});
	return { id };
}

/** 保存字段/名称/前缀或替换 Word 文件；总是新建模板版本，历史文书不跟随变化。 */
export async function updateType(
	access: AccessSession,
	id: string,
	revision: number,
	settings?: { name: string; prefix: string; fields: DocumentField[] },
	file?: File,
) {
	requireAdmin(access);
	const uploaded = file ? new Uint8Array(await file.arrayBuffer()) : undefined;
	const discovered =
		uploaded && file ? inspectTemplate(uploaded, file.name) : undefined;
	await db().transaction(async (tx) => {
		const type = await activeType(id, tx);
		if (type.revision !== revision) conflict();
		const current = await templateFor(id, type.currentVersion, tx);
		const fields =
			settings?.fields ??
			discovered?.map(
				(field) => current.fields.find((old) => old.key === field.key) ?? field,
			) ??
			current.fields;
		validateFields(discovered ?? current.fields, fields);
		const version = type.currentVersion + 1;
		await tx.insert(documentTemplate).values({
			typeId: id,
			version,
			fileName: file?.name ?? current.fileName,
			bytesBase64: uploaded
				? Buffer.from(uploaded).toString("base64")
				: current.bytesBase64,
			fields,
			createdBy: access.user.id,
		});
		await tx
			.update(documentType)
			.set({
				...(settings ? cleanMetadata(settings.name, settings.prefix) : {}),
				currentVersion: version,
				revision: revision + 1,
				updatedAt: new Date(),
			})
			.where(eq(documentType.id, id));
	});
	return { success: true };
}

export async function deleteType(
	access: AccessSession,
	id: string,
	revision: number,
) {
	requireAdmin(access);
	await db().transaction(async (tx) => {
		const type = await activeType(id, tx);
		if (type.revision !== revision) conflict();
		await tx
			.update(documentType)
			.set({
				deletedAt: new Date(),
				deletedBy: access.user.id,
				revision: revision + 1,
			})
			.where(eq(documentType.id, id));
	});
	return { success: true };
}

export async function getSequence(id: string, year: number) {
	await activeType(id);
	const [row] = await db()
		.select()
		.from(documentSequence)
		.where(
			and(eq(documentSequence.typeId, id), eq(documentSequence.year, year)),
		);
	return { year, nextNumber: (row?.lastNumber ?? 0) + 1 };
}

/** 仅允许向前调整下一序号；与取号锁同一类型行，不可覆盖并发已发号码。 */
export async function setSequence(
	access: AccessSession,
	id: string,
	year: number,
	nextNumber: number,
) {
	requireAdmin(access);
	await db().transaction(async (tx) => {
		await activeType(id, tx);
		const [current] = await tx
			.select()
			.from(documentSequence)
			.where(
				and(eq(documentSequence.typeId, id), eq(documentSequence.year, year)),
			);
		if (nextNumber <= (current?.lastNumber ?? 0))
			throw new AccessError(
				409,
				"NUMBER_ALREADY_USED",
				"下一序号只能向前调整，已跳过或使用的号码不再重用。",
			);
		await tx
			.insert(documentSequence)
			.values({ typeId: id, year, lastNumber: nextNumber - 1 })
			.onConflictDoUpdate({
				target: [documentSequence.typeId, documentSequence.year],
				set: { lastNumber: nextNumber - 1 },
			});
	});
	return { success: true };
}

type Draft = {
	typeId: string;
	year: number;
	subject: string;
	values: Record<string, string>;
};

export async function previewDraft(input: Draft) {
	const type = await activeType(input.typeId);
	const template = await templateFor(type.id, type.currentVersion);
	const values = validateValues(template.fields, input.values, true);
	return renderDocument(
		template.bytesBase64,
		template.fields,
		values,
		numberOf(type.prefix, input.year, null),
		input.year,
		null,
		type.name,
	);
}

/**
 * 原子取号：类型行锁串行化同类取号，计数与文书在一个事务提交。
 * requestId 由客户端为一次提交生成；响应丢失后的同一请求重试返回原文书。
 * 接受简要信息，取号不生成 Word；校验/插入失败全部回滚。删除记录的请求 ID 与序号继续保留。
 */
export async function createRecord(
	access: AccessSession,
	input: Draft & { requestId: string },
) {
	return db().transaction(async (tx) => {
		// 同一类型串行化，包括首次创建年度计数和管理员更换模板。
		const type = await activeType(input.typeId, tx);
		const [existing] = await tx
			.select()
			.from(documentRecord)
			.where(eq(documentRecord.id, input.requestId));
		if (existing) {
			const original = await templateFor(
				existing.typeId,
				existing.templateVersion,
				tx,
			);
			const values = validateValues(original.fields, input.values, true);
			// PostgreSQL JSONB 可重排键，按实际字段值判断同一次提交。
			const sameValues =
				Object.keys(existing.values).length === Object.keys(values).length &&
				Object.keys(values).every(
					(key) => existing.values[key] === values[key],
				);
			if (
				existing.deletedAt ||
				existing.ownerId !== access.user.id ||
				existing.typeId !== input.typeId ||
				existing.year !== input.year ||
				existing.subject !== input.subject.trim() ||
				!sameValues
			)
				throw new AccessError(
					409,
					"REQUEST_ALREADY_USED",
					"这次提交标识已使用，请刷新后重新提交。",
				);
			return { id: existing.id, documentNumber: existing.documentNumber };
		}
		const template = await templateFor(type.id, type.currentVersion, tx);
		const values = validateValues(template.fields, input.values, true);
		const [counter] = await tx
			.select()
			.from(documentSequence)
			.where(
				and(
					eq(documentSequence.typeId, type.id),
					eq(documentSequence.year, input.year),
				),
			);
		const sequence = (counter?.lastNumber ?? 0) + 1;
		if (sequence > 2_000_000_000)
			throw new AccessError(
				409,
				"SEQUENCE_EXHAUSTED",
				"本年度序号已达到上限。",
			);
		const documentNumber = numberOf(type.prefix, input.year, sequence);
		await tx
			.insert(documentSequence)
			.values({ typeId: type.id, year: input.year, lastNumber: sequence })
			.onConflictDoUpdate({
				target: [documentSequence.typeId, documentSequence.year],
				set: { lastNumber: sequence },
			});
		await tx.insert(documentRecord).values({
			id: input.requestId,
			typeId: type.id,
			templateVersion: template.version,
			typeName: type.name,
			year: input.year,
			sequence,
			documentNumber,
			subject: input.subject.trim(),
			values,
			ownerId: access.user.id,
			ownerName: access.user.name,
		});
		await tx.insert(documentRevision).values({
			recordId: input.requestId,
			revision: 1,
			subject: input.subject.trim(),
			values,
			actorId: access.user.id,
			actorName: access.user.name,
			action: "create",
		});
		return { id: input.requestId, documentNumber };
	});
}

export async function listRecords(
	access: AccessSession,
	filter: {
		q?: string;
		typeId?: string;
		year?: number;
		mine?: string;
		offset?: number;
		limit?: number;
	},
) {
	const q = filter.q?.trim().replace(/[\\%_]/g, "\\$&");
	const where = and(
		isNull(documentRecord.deletedAt),
		filter.typeId ? eq(documentRecord.typeId, filter.typeId) : undefined,
		filter.year ? eq(documentRecord.year, filter.year) : undefined,
		filter.mine === "true"
			? eq(documentRecord.ownerId, access.user.id)
			: undefined,
		q
			? or(
					ilike(documentRecord.documentNumber, `%${q}%`),
					ilike(documentRecord.subject, `%${q}%`),
					ilike(documentRecord.ownerName, `%${q}%`),
				)
			: undefined,
	);
	const [records, total] = await Promise.all([
		db()
			.select({
				id: documentRecord.id,
				typeId: documentRecord.typeId,
				typeName: documentRecord.typeName,
				documentNumber: documentRecord.documentNumber,
				year: documentRecord.year,
				subject: documentRecord.subject,
				ownerId: documentRecord.ownerId,
				ownerName: documentRecord.ownerName,
				revision: documentRecord.revision,
				createdAt: documentRecord.createdAt,
				updatedAt: documentRecord.updatedAt,
			})
			.from(documentRecord)
			.where(where)
			.orderBy(desc(documentRecord.createdAt), documentRecord.id)
			.limit(filter.limit ?? 30)
			.offset(filter.offset ?? 0),
		db().select({ value: count() }).from(documentRecord).where(where),
	]);
	return { records, total: total[0]?.value ?? 0 };
}

async function recordFor(id: string, tx?: DatabaseTransaction) {
	const query = (tx ?? db())
		.select()
		.from(documentRecord)
		.where(and(eq(documentRecord.id, id), isNull(documentRecord.deletedAt)));
	const [record] = tx ? await query.for("update") : await query;
	return record ?? missing();
}
export async function recordDetails(id: string) {
	const record = await recordFor(id);
	const template = await templateFor(record.typeId, record.templateVersion);
	const history = await db()
		.select({
			revision: documentRevision.revision,
			actorName: documentRevision.actorName,
			action: documentRevision.action,
			createdAt: documentRevision.createdAt,
		})
		.from(documentRevision)
		.where(eq(documentRevision.recordId, id))
		.orderBy(desc(documentRevision.revision));
	return {
		record,
		fields: template.fields,
		fileName: template.fileName,
		history,
	};
}

/** 普通人员只允许改本人，可保存未填完的信息；revision 防止覆盖更新，号码和归属不可修改。 */
export async function updateRecord(
	access: AccessSession,
	id: string,
	input: { subject: string; values: Record<string, string>; revision: number },
) {
	await db().transaction(async (tx) => {
		const record = await recordFor(id, tx);
		if (access.user.role !== "admin" && record.ownerId !== access.user.id)
			throw new AccessError(
				403,
				"DOCUMENT_OWNER_REQUIRED",
				"只能修改本人取号的文书。",
			);
		if (record.revision !== input.revision) conflict();
		const template = await templateFor(
			record.typeId,
			record.templateVersion,
			tx,
		);
		const values = validateValues(template.fields, input.values, true);
		const revision = record.revision + 1;
		await tx
			.update(documentRecord)
			.set({
				subject: input.subject.trim(),
				values,
				revision,
				updatedAt: new Date(),
			})
			.where(eq(documentRecord.id, id));
		await tx.insert(documentRevision).values({
			recordId: id,
			revision,
			subject: input.subject.trim(),
			values,
			actorId: access.user.id,
			actorName: access.user.name,
			action: "update",
		});
	});
	return { success: true };
}

export async function deleteRecord(
	access: AccessSession,
	id: string,
	revision: number,
) {
	requireAdmin(access);
	await db().transaction(async (tx) => {
		const record = await recordFor(id, tx);
		if (record.revision !== revision) conflict();
		await tx
			.update(documentRecord)
			.set({
				deletedAt: new Date(),
				deletedBy: access.user.id,
				revision: revision + 1,
			})
			.where(eq(documentRecord.id, id));
		await tx.insert(documentRevision).values({
			recordId: id,
			revision: revision + 1,
			subject: record.subject,
			values: record.values,
			actorId: access.user.id,
			actorName: access.user.name,
			action: "delete",
		});
	});
	return { success: true };
}

/** 按需生成 Word；正式下载校验模板必填项，预览允许空白且不写入或占号。 */
export async function downloadRecord(id: string, preview = false) {
	const record = await recordFor(id);
	const template = await templateFor(record.typeId, record.templateVersion);
	const values = validateValues(template.fields, record.values, preview);
	return {
		bytes: renderDocument(
			template.bytesBase64,
			template.fields,
			values,
			record.documentNumber,
			record.year,
			record.sequence,
			record.typeName,
		),
		fileName: `${record.documentNumber}-${record.typeName}.docx`,
	};
}
/** 历史文书未保存的编辑预览；使用原模板与号码，校验归属及版本，不写数据库。 */
export async function previewRecord(
	access: AccessSession,
	id: string,
	input: { subject: string; values: Record<string, string>; revision: number },
) {
	const record = await recordFor(id);
	if (access.user.role !== "admin" && record.ownerId !== access.user.id)
		throw new AccessError(
			403,
			"DOCUMENT_OWNER_REQUIRED",
			"只能预览本人文书的修改。",
		);
	if (record.revision !== input.revision) conflict();
	const template = await templateFor(record.typeId, record.templateVersion);
	const values = validateValues(template.fields, input.values, true);
	return renderDocument(
		template.bytesBase64,
		template.fields,
		values,
		record.documentNumber,
		record.year,
		record.sequence,
		record.typeName,
	);
}
export async function downloadTemplate(id: string) {
	const type = await activeType(id);
	const template = await templateFor(id, type.currentVersion);
	return {
		bytes: Buffer.from(template.bytesBase64, "base64"),
		fileName: template.fileName,
	};
}
export const sampleTemplate = () => ({
	bytes: Buffer.from(example.bytesBase64, "base64"),
	fileName: "询问通知书模板.docx",
});
