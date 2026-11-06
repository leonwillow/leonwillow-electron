/**
 * @file 计算器方案 API 的有界输入模型。
 * 创建时间：2026-11-05；修改时间：2026-11-06。
 * 版本作用：Eden 推导契约；历史数值由共享领域规则再校验。
 * 被调用：计算器路由与服务；调用：Elysia TypeBox。
 * 预期结果：限制所属期数量、字符串长度和请求形状，拒绝客户端提供计算结果。
 */
import {
	MAX_LIABILITIES,
	MAX_PAYMENTS,
	taxTypes,
} from "@leonwillow-electron/calculators/late-fees";
import { t } from "elysia";

const name = t.String({ minLength: 1, maxLength: 80, pattern: "\\S" });
const amount = t.String({ maxLength: 100 });
// 禁止混合版本；其余额外字段保留给领域校验拒绝，避免 normalize 静默清理金额。
const adjustment = t.Union([
	t.Object(
		{
			outputIncrease: amount,
			outputDecrease: amount,
			inputIncrease: amount,
			inputDecrease: amount,
			dx: t.Optional(t.Never()),
			di: t.Optional(t.Never()),
		},
		{ additionalProperties: true },
	),
	t.Object(
		{
			dx: amount,
			di: amount,
			outputIncrease: t.Optional(t.Never()),
			outputDecrease: t.Optional(t.Never()),
			inputIncrease: t.Optional(t.Never()),
			inputDecrease: t.Optional(t.Never()),
		},
		{ additionalProperties: true },
	),
]);
export const CalculatorsModel = {
	metadata: t.Object(
		{
			revision: t.Integer({ minimum: 1 }),
			name: t.Optional(name),
			archived: t.Optional(t.Boolean()),
		},
		{ additionalProperties: false },
	),
	remove: t.Object(
		{ revision: t.Integer({ minimum: 1 }) },
		{ additionalProperties: false },
	),
	id: t.Object({ id: t.String({ format: "uuid" }) }),
	create: t.Object(
		{ name, requestId: t.String({ format: "uuid" }) },
		{ additionalProperties: false },
	),
	save: t.Object(
		{
			name,
			revision: t.Integer({ minimum: 1 }),
			source: t.String({ maxLength: 200 }),
			history: t.Array(
				t.Union([
					t.Object(
						{
							id: t.String({
								minLength: 1,
								maxLength: 80,
								pattern: "^[a-zA-Z0-9_-]+$",
							}),
							periodStart: t.String({ maxLength: 10 }),
							periodEnd: t.String({ maxLength: 10 }),
							x: amount,
							i: amount,
							t: amount,
							tax: amount,
							end: amount,
						},
						{ additionalProperties: false },
					),
					t.Object(
						{
							month: t.String({ maxLength: 7 }),
							x: amount,
							i: amount,
							t: amount,
							tax: amount,
							end: amount,
						},
						{ additionalProperties: false },
					),
				]),
				{ maxItems: 1200 },
			),
			adjustments: t.Record(
				t.String({ minLength: 1, maxLength: 80, pattern: "^[a-zA-Z0-9_-]+$" }),
				adjustment,
				{ maxProperties: 1200 },
			),
		},
		{ additionalProperties: false },
	),
};
export type VatSave = typeof CalculatorsModel.save.static;

export const lateFeeSave = t.Object(
	{
		name,
		revision: t.Integer({ minimum: 1 }),
		cutoff: t.String({ maxLength: 10 }),
		liabilities: t.Array(
			t.Object(
				{
					id: t.String({ format: "uuid" }),
					taxType: t.UnionEnum(
						Object.keys(taxTypes) as [
							keyof typeof taxTypes,
							...(keyof typeof taxTypes)[],
						],
					),
					period: t.String({ maxLength: 80 }),
					principal: amount,
					deadline: t.String({ maxLength: 10 }),
					note: t.String({ maxLength: 300 }),
					payments: t.Array(
						t.Object(
							{
								id: t.String({ format: "uuid" }),
								date: t.String({ maxLength: 10 }),
								amount,
							},
							{ additionalProperties: false },
						),
						{ maxItems: MAX_PAYMENTS },
					),
				},
				{ additionalProperties: false },
			),
			{ maxItems: MAX_LIABILITIES },
		),
	},
	{ additionalProperties: false },
);
export type LateFeeSave = typeof lateFeeSave.static;

export type ScenarioMetadata = typeof CalculatorsModel.metadata.static;
