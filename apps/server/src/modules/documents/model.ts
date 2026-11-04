/**
 * @file 文书取号与管理员模板操作的 HTTP 输入契约。
 * 创建时间：2026-10-10；修改时间：2026-10-10。
 * 版本作用：限制年份、序号、上传大小和动态字段；供 Eden 推导客户端类型。
 * 被调用：documents 路由；调用：Elysia TypeBox。
 * 预期结果：身份、号码与模板版本由服务端确定，错误输入返回 422。
 */
import { t } from "elysia";

const year = t.Integer({ minimum: 2000, maximum: 9999 });
const nextNumber = t.Integer({ minimum: 1, maximum: 2_000_000_000 });
const name = t.String({ minLength: 1, maxLength: 80, pattern: "\\S" });
const prefix = t.String({ minLength: 1, maxLength: 60, pattern: "\\S" });
const values = t.Record(
	t.String({ maxLength: 60 }),
	t.String({ maxLength: 4000 }),
	{ maxProperties: 60 },
);
const field = t.Object(
	{
		key: t.String({ minLength: 1, maxLength: 60 }),
		label: t.String({ minLength: 1, maxLength: 80, pattern: "\\S" }),
		kind: t.Union([
			t.Literal("text"),
			t.Literal("textarea"),
			t.Literal("date"),
			t.Literal("time"),
		]),
		required: t.Boolean(),
		defaultValue: t.String({ maxLength: 4000 }),
	},
	{ additionalProperties: false },
);
const draft = {
	typeId: t.String({ format: "uuid" }),
	year,
	subject: t.String({ minLength: 1, maxLength: 160, pattern: "\\S" }),
	values,
};
export const DocumentsModel = {
	typeId: t.Object({ typeId: t.String({ format: "uuid" }) }),
	recordId: t.Object({ recordId: t.String({ format: "uuid" }) }),
	upload: t.Object({
		file: t.File({ maxSize: "5m" }),
		name,
		prefix,
		year: t.Numeric({ minimum: 2000, maximum: 9999 }),
		nextNumber: t.Numeric({ minimum: 1, maximum: 2_000_000_000 }),
	}),
	inspect: t.Object({ file: t.File({ maxSize: "5m" }) }),
	sample: t.Object({ name, prefix, year, nextNumber }),
	settings: t.Object(
		{
			name,
			prefix,
			revision: t.Integer({ minimum: 1 }),
			fields: t.Array(field, { maxItems: 60 }),
		},
		{ additionalProperties: false },
	),
	replace: t.Object({
		file: t.File({ maxSize: "5m" }),
		revision: t.Numeric({ minimum: 1 }),
	}),
	sequence: t.Object({ year, nextNumber }, { additionalProperties: false }),
	year: t.Object({ year: t.Numeric({ minimum: 2000, maximum: 9999 }) }),
	draft: t.Object(draft, { additionalProperties: false }),
	create: t.Object(
		{ ...draft, requestId: t.String({ format: "uuid" }) },
		{ additionalProperties: false },
	),
	update: t.Object(
		{ subject: draft.subject, values, revision: t.Integer({ minimum: 1 }) },
		{ additionalProperties: false },
	),
	remove: t.Object(
		{ revision: t.Integer({ minimum: 1 }) },
		{ additionalProperties: false },
	),
	list: t.Object({
		q: t.Optional(t.String({ maxLength: 160 })),
		typeId: t.Optional(t.String({ format: "uuid" })),
		year: t.Optional(t.Numeric({ minimum: 2000, maximum: 9999 })),
		mine: t.Optional(t.Union([t.Literal("true"), t.Literal("false")])),
		offset: t.Optional(t.Numeric({ minimum: 0, maximum: 1_000_000 })),
		limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
	}),
};
