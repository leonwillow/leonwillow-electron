/**
 * @file 笔录 API 的有界输入契约。
 * 创建时间：2026-11-04；修改时间：2026-11-04。
 * 版本作用：Eden 从 TypeBox 推导字段，草稿允许留空，完成规则由 service 校验。
 * 被调用：inquiries 路由；调用：Elysia TypeBox。
 * 预期结果：拒绝额外字段、无效 ID、超大问答和无效版本号，返回 422。
 */
import { t } from "elysia";

const id = t.String({ format: "uuid" });
const revision = t.Integer({ minimum: 1 });
const text = (maxLength = 200) => t.String({ maxLength });
const name = t.String({ minLength: 1, maxLength: 80, pattern: "\\S" });
const content = t.Object(
	{
		inquiryStartAt: text(16),
		inquiryEndAt: text(16),
		inquiryCount: t.Integer({ minimum: 1, maximum: 9999 }),
		inquiryLocation: text(500),
		enforcementUnitName: text(),
		inquirers: t.Array(
			t.Object(
				{ id, name: text(80), badgeNumber: text(80), isRecorder: t.Boolean() },
				{ additionalProperties: false },
			),
			{ maxItems: 20 },
		),
		subjectName: text(80),
		subjectGender: text(20),
		subjectAge: text(3),
		subjectIdType: text(80),
		subjectIdNumber: text(80),
		subjectAddress: text(500),
		subjectPhone: text(80),
		subjectOrg: text(),
		subjectPosition: text(80),
		subjectRelationship: text(80),
		subjectRelationshipOther: text(500),
		qaItems: t.Array(
			t.Object(
				{ id, question: text(10_000), answer: text(30_000) },
				{ additionalProperties: false },
			),
			{ maxItems: 200 },
		),
	},
	{ additionalProperties: false },
);
const record = {
	title: name,
	content,
	status: t.Union([t.Literal("draft"), t.Literal("final")]),
};
export const InquiriesModel = {
	caseId: t.Object({ caseId: id }),
	recordId: t.Object({ caseId: id, recordId: id }),
	inquirerId: t.Object({ inquirerId: id }),
	createCase: t.Object({ name }, { additionalProperties: false }),
	updateCase: t.Object(
		{ name, archived: t.Boolean(), revision },
		{ additionalProperties: false },
	),
	remove: t.Object({ revision }, { additionalProperties: false }),
	draft: t.Object(record, { additionalProperties: false }),
	create: t.Object(
		{ ...record, requestId: id },
		{ additionalProperties: false },
	),
	update: t.Object({ ...record, revision }, { additionalProperties: false }),
	directory: t.Object({
		q: t.Optional(text(160)),
		status: t.Optional(record.status),
	}),
	list: t.Object({
		q: t.Optional(text(160)),
		status: t.Optional(record.status),
		offset: t.Optional(t.Numeric({ minimum: 0, maximum: 1_000_000 })),
		limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
	}),
	inquirer: t.Object(
		{ name, badgeNumber: name },
		{ additionalProperties: false },
	),
	updateInquirer: t.Object(
		{ name, badgeNumber: name, revision },
		{ additionalProperties: false },
	),
};
export type InquiryDraft = typeof InquiriesModel.draft.static;
export type InquiryDirectoryQuery = typeof InquiriesModel.directory.static;
export type InquiryListQuery = typeof InquiriesModel.list.static;
