/**
 * @file 按当前人员隔离的笔录事务服务。
 * 创建时间：2026-11-04；修改时间：2026-11-05。
 * 版本作用：案件行锁协调归档与写入，修订号检查防止多窗口覆盖。
 * 被调用：inquiries 路由；调用：共用数据库、Drizzle、领域校验。
 * 功能与预期结果：只有所有者能访问案件/笔录/常用询问人，删除保留笔录原行。
 */
import type { Database, DatabaseTransaction } from "@leonwillow-electron/db";
import {
	inquiryCase,
	inquiryInquirer,
	inquiryRecord,
} from "@leonwillow-electron/db/schema";
import {
	and,
	count,
	desc,
	eq,
	exists,
	ilike,
	isNotNull,
	isNull,
	or,
	sql,
} from "drizzle-orm";
import { getServerResources } from "../../server-resources";
import { AccessError, type AccessSession } from "../access/service";
import type {
	InquiryDirectoryQuery,
	InquiryDocument,
	InquiryListQuery,
	InquiryMetadata,
} from "./model";
import { validateInquiry } from "./validation";

const db = () => getServerResources().db;
const missing = (): never => {
	throw new AccessError(
		404,
		"INQUIRY_NOT_FOUND",
		"案件或笔录不存在，或你无权访问。",
	);
};
const conflict = (): never => {
	throw new AccessError(
		409,
		"INQUIRY_CONFLICT",
		"内容已在其他窗口修改，请保留当前内容并重新加载后再试。",
	);
};
const ownedCase = (access: AccessSession, id: string) =>
	and(
		eq(inquiryCase.id, id),
		eq(inquiryCase.ownerId, access.user.id),
		isNull(inquiryCase.deletedAt),
	);
const recordWhere = (caseId: string, id: string) =>
	and(
		eq(inquiryRecord.caseId, caseId),
		eq(inquiryRecord.id, id),
		isNull(inquiryRecord.deletedAt),
	);

/** 每个读取显式限制所有者；归档案件仍可查阅和导出。 */
export async function getCase(
	access: AccessSession,
	id: string,
	client: Database | DatabaseTransaction = db(),
) {
	const [row] = await client
		.select()
		.from(inquiryCase)
		.where(ownedCase(access, id));
	return row ?? missing();
}
/** 写操作先锁父案件，串行化归档/删除和笔录保存；事务由调用方拥有。 */
async function lockCase(
	tx: DatabaseTransaction,
	access: AccessSession,
	id: string,
	writable = true,
) {
	const [row] = await tx
		.select()
		.from(inquiryCase)
		.where(ownedCase(access, id))
		.for("update");
	if (!row) return missing();
	if (writable && row.archived)
		throw new AccessError(
			409,
			"INQUIRY_ARCHIVED",
			"案件已归档，请先恢复后再编辑。",
		);
	return row;
}
/** 归档视图包含父文件夹归档和单份笔录归档；省略筛选时保留 API 的全量语义。 */
const archiveCondition = (archived?: boolean) =>
	archived === undefined
		? undefined
		: archived
			? or(eq(inquiryCase.archived, true), eq(inquiryRecord.archived, true))
			: and(eq(inquiryCase.archived, false), eq(inquiryRecord.archived, false));

/** 目录共用的轻量投影；只提取预览字段，人员保留顺序和姓名，不传证号、联系方式或问答。 */
const recordSummary = {
	id: inquiryRecord.id,
	title: inquiryRecord.title,
	revision: inquiryRecord.revision,
	archived: inquiryRecord.archived,
	updatedAt: inquiryRecord.updatedAt,
	subjectName: sql<string>`coalesce(${inquiryRecord.content}->>'subjectName', '')`,
	subjectOrg: sql<string>`coalesce(${inquiryRecord.content}->>'subjectOrg', '')`,
	inquiryStartAt: sql<string>`coalesce(${inquiryRecord.content}->>'inquiryStartAt', '')`,
	inquiryEndAt: sql<string>`coalesce(${inquiryRecord.content}->>'inquiryEndAt', '')`,
	inquiryLocation: sql<string>`coalesce(${inquiryRecord.content}->>'inquiryLocation', '')`,
	inquirerNames: sql<string[]>`(
		select coalesce(jsonb_agg(btrim(person->>'name') order by position), '[]'::jsonb)
		from jsonb_array_elements(
			case when jsonb_typeof(${inquiryRecord.content}->'inquirers') = 'array'
				then ${inquiryRecord.content}->'inquirers' else '[]'::jsonb end
		) with ordinality as people(person, position)
		where nullif(btrim(person->>'name'), '') is not null
	)`,
};

/**
 * 返回当前人员的目录摘要；q 匹配文件夹名、笔录标题或被询问人。
 * 文件夹名匹配时保留该文件夹；子笔录标题和被询问人匹配时返回所属目录。
 * 子查询覆盖全部有效笔录，不受目录展开或笔录分页影响，也不向客户端发送正文。
 */
export async function listCases(
	access: AccessSession,
	query: InquiryDirectoryQuery = {},
) {
	const search = query.q?.trim().replace(/[\\%_]/g, "\\$&");
	const nameMatches = search
		? and(
				eq(inquiryCase.kind, "folder"),
				ilike(inquiryCase.name, `%${search}%`),
			)
		: undefined;
	const matchingRecord = exists(
		db()
			.select({ id: inquiryRecord.id })
			.from(inquiryRecord)
			.where(
				and(
					eq(inquiryRecord.caseId, inquiryCase.id),
					isNull(inquiryRecord.deletedAt),
					archiveCondition(query.archived),
					search
						? or(
								nameMatches,
								ilike(inquiryRecord.title, `%${search}%`),
								sql`${inquiryRecord.content}->>'subjectName' ilike ${`%${search}%`}`,
							)
						: undefined,
				),
			),
	);
	const rows = await db()
		.select({
			id: inquiryCase.id,
			name: inquiryCase.name,
			kind: inquiryCase.kind,
			archived: inquiryCase.archived,
			revision: inquiryCase.revision,
			createdAt: inquiryCase.createdAt,
			updatedAt: inquiryCase.updatedAt,
			record: recordSummary,
			recordCount: db().$count(
				inquiryRecord,
				and(
					eq(inquiryRecord.caseId, inquiryCase.id),
					isNull(inquiryRecord.deletedAt),
					archiveCondition(query.archived),
				),
			),
		})
		.from(inquiryCase)
		.leftJoin(
			inquiryRecord,
			and(
				eq(inquiryCase.kind, "standalone"),
				eq(inquiryRecord.caseId, inquiryCase.id),
				eq(inquiryRecord.id, inquiryCase.id),
				isNull(inquiryRecord.deletedAt),
			),
		)
		.where(
			and(
				eq(inquiryCase.ownerId, access.user.id),
				isNull(inquiryCase.deletedAt),
				or(eq(inquiryCase.kind, "folder"), isNotNull(inquiryRecord.id)),
				query.archived === undefined
					? undefined
					: query.archived
						? or(eq(inquiryCase.archived, true), matchingRecord)
						: and(
								eq(inquiryCase.archived, false),
								or(
									eq(inquiryCase.kind, "folder"),
									eq(inquiryRecord.archived, false),
								),
							),
				search ? or(nameMatches, matchingRecord) : undefined,
			),
		)
		.orderBy(desc(inquiryCase.updatedAt), inquiryCase.id);
	// LEFT JOIN 的 JSON 默认值不能把普通文件夹变成一份空笔录。
	return rows.map((row) => ({
		...row,
		record: row.kind === "standalone" && row.record?.id ? row.record : null,
	}));
}
export async function createCase(access: AccessSession, name: string) {
	const [row] = await db()
		.insert(inquiryCase)
		.values({
			id: crypto.randomUUID(),
			ownerId: access.user.id,
			name: name.trim(),
		})
		.returning();
	if (!row) throw new Error("创建案件未返回结果。");
	return row;
}

/**
 * 以 draft.requestId 同时标识独立笔录和权限容器，事务返回首次创建或已有的完整笔录。
 * 校验失败、ID 被其他资源占用、无权访问及归档时拒绝；失败回滚容器，不恢复已删除笔录。
 */
export async function createStandalone(
	access: AccessSession,
	draft: InquiryDocument & { requestId: string },
) {
	validateInquiry(draft);
	return db().transaction(async (tx) => {
		await tx
			.insert(inquiryCase)
			.values({
				id: draft.requestId,
				ownerId: access.user.id,
				name: draft.title.trim(),
				kind: "standalone",
			})
			.onConflictDoNothing();
		const folder = await lockCase(tx, access, draft.requestId);
		if (folder.kind !== "standalone") return conflict();
		const [created] = await tx
			.insert(inquiryRecord)
			.values({
				id: draft.requestId,
				caseId: folder.id,
				title: draft.title.trim(),
				content: draft.content,
			})
			.onConflictDoNothing()
			.returning();
		if (created) return created;
		const [existing] = await tx
			.select()
			.from(inquiryRecord)
			.where(recordWhere(folder.id, draft.requestId));
		return existing ?? conflict();
	});
}
export async function updateCase(
	access: AccessSession,
	id: string,
	patch: { name: string; archived: boolean; revision: number },
) {
	return db().transaction(async (tx) => {
		const row = await lockCase(tx, access, id, false);
		if (row.revision !== patch.revision) return conflict();
		const [updated] = await tx
			.update(inquiryCase)
			.set({
				name: patch.name.trim(),
				archived: patch.archived,
				revision: row.revision + 1,
				updatedAt: new Date(),
			})
			.where(eq(inquiryCase.id, id))
			.returning();
		return updated ?? missing();
	});
}
export async function deleteCase(
	access: AccessSession,
	id: string,
	revision: number,
) {
	return db().transaction(async (tx) => {
		const row = await lockCase(tx, access, id, false);
		if (row.revision !== revision) return conflict();
		if (!row.archived)
			throw new AccessError(
				409,
				"INQUIRY_ARCHIVE_REQUIRED",
				"请先归档案件，再删除。",
			);
		await tx
			.update(inquiryCase)
			.set({
				deletedAt: new Date(),
				deletedBy: access.user.id,
				updatedAt: new Date(),
				revision: revision + 1,
			})
			.where(eq(inquiryCase.id, id));
		return { ok: true };
	});
}
/** 列表只读取摘要，不向列表发送证件号码和整段问答；limit 最大值由 HTTP 契约限制。 */
export async function listRecords(
	access: AccessSession,
	caseId: string,
	query: InquiryListQuery,
) {
	const folder = await getCase(access, caseId);
	const search = query.q?.trim().replace(/[\\%_]/g, "\\$&");
	const condition = and(
		eq(inquiryRecord.caseId, caseId),
		isNull(inquiryRecord.deletedAt),
		query.archived === undefined
			? undefined
			: folder.archived
				? sql`${query.archived}`
				: eq(inquiryRecord.archived, query.archived),
		search
			? or(
					ilike(inquiryRecord.title, `%${search}%`),
					sql`${inquiryRecord.content}->>'subjectName' ilike ${`%${search}%`}`,
				)
			: undefined,
	);
	const [records, totals] = await Promise.all([
		db()
			.select(recordSummary)
			.from(inquiryRecord)
			.where(condition)
			.orderBy(desc(inquiryRecord.updatedAt), inquiryRecord.id)
			.limit(query.limit ?? 30)
			.offset(query.offset ?? 0),
		db().select({ total: count() }).from(inquiryRecord).where(condition),
	]);
	return { folder, records, total: totals[0]?.total ?? 0 };
}
export async function getRecord(
	access: AccessSession,
	caseId: string,
	id: string,
) {
	await getCase(access, caseId);
	const [row] = await db()
		.select()
		.from(inquiryRecord)
		.where(recordWhere(caseId, id));
	return row ?? missing();
}
/** requestId 在创建重试时保持不变；已有记录只返回，不重写正文。 */
export async function createRecord(
	access: AccessSession,
	caseId: string,
	draft: InquiryDocument & { requestId: string },
) {
	validateInquiry(draft);
	return db().transaction(async (tx) => {
		const folder = await lockCase(tx, access, caseId);
		if (folder.kind === "standalone")
			throw new AccessError(
				409,
				"INQUIRY_STANDALONE",
				"独立笔录不能添加其他笔录，请新建案件文件夹。",
			);
		const [created] = await tx
			.insert(inquiryRecord)
			.values({
				id: draft.requestId,
				caseId,
				title: draft.title.trim(),
				content: draft.content,
			})
			.onConflictDoNothing()
			.returning();
		if (created) {
			await tx
				.update(inquiryCase)
				.set({ updatedAt: new Date() })
				.where(eq(inquiryCase.id, caseId));
			return created;
		}
		const [existing] = await tx
			.select()
			.from(inquiryRecord)
			.where(recordWhere(caseId, draft.requestId));
		return existing ?? conflict();
	});
}
export async function updateRecord(
	access: AccessSession,
	caseId: string,
	id: string,
	draft: InquiryDocument & { revision: number },
) {
	validateInquiry(draft);
	return db().transaction(async (tx) => {
		await lockCase(tx, access, caseId);
		const [row] = await tx
			.select()
			.from(inquiryRecord)
			.where(recordWhere(caseId, id));
		if (!row) return missing();
		if (row.revision !== draft.revision) return conflict();
		if (row.archived)
			throw new AccessError(
				409,
				"INQUIRY_ARCHIVED",
				"笔录已归档，请先恢复后再编辑。",
			);
		const [updated] = await tx
			.update(inquiryRecord)
			.set({
				title: draft.title.trim(),
				content: draft.content,

				revision: row.revision + 1,
				updatedAt: new Date(),
			})
			.where(eq(inquiryRecord.id, id))
			.returning();
		await tx
			.update(inquiryCase)
			.set({ updatedAt: new Date() })
			.where(eq(inquiryCase.id, caseId));
		return updated ?? missing();
	});
}
/**
 * 只修改标题或归档标记，不重写正文。父案件行锁协调内容保存及目录操作；
 * 仅所有者可写，归档父文件夹、旧修订号及已删除记录分别返回 409/404。
 */
export async function updateRecordMetadata(
	access: AccessSession,
	caseId: string,
	id: string,
	patch: InquiryMetadata,
) {
	return db().transaction(async (tx) => {
		await lockCase(tx, access, caseId);
		const [row] = await tx
			.select()
			.from(inquiryRecord)
			.where(recordWhere(caseId, id));
		if (!row) return missing();
		if (row.revision !== patch.revision) return conflict();
		const [updated] = await tx
			.update(inquiryRecord)
			.set({
				...("title" in patch
					? { title: patch.title.trim() }
					: { archived: patch.archived }),
				revision: row.revision + 1,
				updatedAt: new Date(),
			})
			.where(eq(inquiryRecord.id, id))
			.returning();
		await tx
			.update(inquiryCase)
			.set({ updatedAt: new Date() })
			.where(eq(inquiryCase.id, caseId));
		return updated ?? missing();
	});
}
export async function deleteRecord(
	access: AccessSession,
	caseId: string,
	id: string,
	revision: number,
) {
	return db().transaction(async (tx) => {
		await lockCase(tx, access, caseId);
		const [row] = await tx
			.select()
			.from(inquiryRecord)
			.where(recordWhere(caseId, id));
		if (!row) return missing();
		if (row.revision !== revision) return conflict();
		await tx
			.update(inquiryRecord)
			.set({
				deletedAt: new Date(),
				deletedBy: access.user.id,
				updatedAt: new Date(),
				revision: revision + 1,
			})
			.where(eq(inquiryRecord.id, id));
		return { ok: true };
	});
}
export async function listInquirers(access: AccessSession) {
	return db()
		.select({
			id: inquiryInquirer.id,
			name: inquiryInquirer.name,
			badgeNumber: inquiryInquirer.badgeNumber,
			revision: inquiryInquirer.revision,
		})
		.from(inquiryInquirer)
		.where(
			and(
				eq(inquiryInquirer.ownerId, access.user.id),
				isNull(inquiryInquirer.deletedAt),
			),
		)
		.orderBy(inquiryInquirer.name, inquiryInquirer.id);
}
/** 检查证号按人员唯一；冲突返回 409，不把数据库错误暴露给客户端。 */
export async function saveInquirer(
	access: AccessSession,
	input: { name: string; badgeNumber: string },
	id?: string,
	revision?: number,
) {
	try {
		const values = {
			name: input.name.trim(),
			badgeNumber: input.badgeNumber.trim(),
		};
		if (!id) {
			const [row] = await db()
				.insert(inquiryInquirer)
				.values({ ...values, id: crypto.randomUUID(), ownerId: access.user.id })
				.onConflictDoUpdate({
					target: [inquiryInquirer.ownerId, inquiryInquirer.badgeNumber],
					set: {
						...values,
						deletedAt: null,
						deletedBy: null,
						revision: sql`${inquiryInquirer.revision} + 1`,
						updatedAt: new Date(),
					},
					setWhere: isNotNull(inquiryInquirer.deletedAt),
				})
				.returning();
			if (!row)
				throw new AccessError(
					409,
					"INQUIRER_EXISTS",
					"该检查证号已在常用询问人中。",
				);
			return row;
		}
		const [row] = await db()
			.update(inquiryInquirer)
			.set({
				...values,
				revision: sql`${inquiryInquirer.revision} + 1`,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(inquiryInquirer.id, id),
					eq(inquiryInquirer.ownerId, access.user.id),
					eq(inquiryInquirer.revision, revision ?? 0),
					isNull(inquiryInquirer.deletedAt),
				),
			)
			.returning();
		return row ?? conflict();
	} catch (error) {
		const cause =
			error instanceof Error && "cause" in error ? error.cause : error;
		if (
			typeof cause === "object" &&
			cause &&
			"code" in cause &&
			cause.code === "23505"
		)
			throw new AccessError(
				409,
				"INQUIRER_EXISTS",
				"该检查证号已在常用询问人中。",
			);
		throw error;
	}
}
export async function deleteInquirer(
	access: AccessSession,
	id: string,
	revision: number,
) {
	const rows = await db()
		.update(inquiryInquirer)
		.set({
			deletedAt: new Date(),
			deletedBy: access.user.id,
			updatedAt: new Date(),
			revision: revision + 1,
		})
		.where(
			and(
				eq(inquiryInquirer.id, id),
				eq(inquiryInquirer.ownerId, access.user.id),
				eq(inquiryInquirer.revision, revision),
				isNull(inquiryInquirer.deletedAt),
			),
		)
		.returning({ id: inquiryInquirer.id });
	if (!rows.length) return conflict();
	return { ok: true };
}
