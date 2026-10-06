/**
 * @file 案件导入与图分析的 HTTP 请求校验。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-06
 * 版本作用：限定上传和图搜索的范围；Eden 推导客户端契约。
 * 被调用：funds 路由；调用：Elysia TypeBox。
 * 预期结果：客户端不能指定案件归属，路径查询最多四层。
 */
import { t } from "elysia";

const text = () => t.Optional(t.String({ maxLength: 256 }));
const date = () =>
	t.Optional(t.String({ pattern: "^$|^\\d{4}-\\d{2}-\\d{2}$" }));
const graphFilter = {
	account: text(),
	counterparty: text(),
	transaction: text(),
	from: date(),
	to: date(),
	direction: t.Optional(
		t.Union([t.Literal("both"), t.Literal("in"), t.Literal("out")]),
	),
};
export const FundsModel = {
	id: t.Object({ caseId: t.String({ format: "uuid" }) }),
	create: t.Object(
		{ name: t.String({ minLength: 1, maxLength: 100, pattern: "\\S" }) },
		{ additionalProperties: false },
	),
	upload: t.Object({
		files: t.Files({ minItems: 1, maxItems: 32, maxSize: "20m" }),
	}),
	graph: t.Object(graphFilter),
	filter: t.Object({
		...graphFilter,
		limit: t.Optional(t.Numeric({ minimum: 1, maximum: 200 })),
		offset: t.Optional(t.Numeric({ minimum: 0, maximum: 100_000 })),
	}),
	trace: t.Object({
		account: t.String({ minLength: 1, maxLength: 256 }),
		transaction: t.String({ maxLength: 256 }),
		depth: t.Integer({ minimum: 1, maximum: 4 }),
		from: t.String({ pattern: "^$|^\\d{4}-\\d{2}-\\d{2}$" }),
		to: t.String({ pattern: "^$|^\\d{4}-\\d{2}-\\d{2}$" }),
	}),
	review: t.Object({
		offset: t.Optional(t.Numeric({ minimum: 0, maximum: 100_000 })),
		kind: text(),
	}),
	decision: t.Object({
		candidateId: t.String({ minLength: 64, maxLength: 64 }),
		action: t.Union([t.Literal("merge"), t.Literal("separate")]),
		revision: t.Integer({ minimum: 1 }),
	}),
	row: t.Object({
		sourceId: t.String({ minLength: 64, maxLength: 64 }),
		sheet: t.String({ maxLength: 128 }),
		row: t.Numeric({ minimum: 1, maximum: 100_001 }),
	}),
};
