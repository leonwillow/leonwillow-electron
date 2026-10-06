/**
 * @file 资金调查案件 API。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-06
 * 版本作用：经过功能权限和案件归属检查的整案导入与查询。
 * 被调用：app.ts、Web Eden；调用：accessPlugin、FundsModel、普通服务函数。
 * 功能：文件上传、清洗报告、来源核对、资金图、分页交易、时间路径。
 * 预期结果：未登录 401，越权 403/404，输入错误 400/422，旧图 409，图故障 503。
 */
import { Elysia, t } from "elysia";
import { accessPlugin } from "../access/plugin";
import * as links from "./case-links";
import { csvDocument, templateHeaders } from "./export";
import * as jobs from "./jobs";
import { FundsModel } from "./model";
import * as service from "./service";

export const fundsModule = new Elysia({ name: "funds", prefix: "/api/funds" })
	.use(accessPlugin)
	.guard({ access: "funds" })
	.get("/template", ({ set }) => {
		set.headers["content-type"] = "text/csv; charset=utf-8";
		set.headers["content-disposition"] =
			"attachment; filename=bank-statement-template.csv";
		return csvDocument(templateHeaders, []);
	})
	.get("/cases", ({ access }) => service.listCases(access))
	.post("/cases", ({ access, body }) => service.createCase(access, body.name), {
		body: FundsModel.create,
	})
	.patch(
		"/cases/:caseId",
		({ access, params, body }) =>
			service.updateCase(access, params.caseId, body),
		{
			params: FundsModel.id,
			body: t.Object({
				pinned: t.Optional(t.Boolean()),
				archived: t.Optional(t.Boolean()),
			}),
		},
	)
	.delete(
		"/cases/:caseId",
		({ access, params }) => service.deleteCase(access, params.caseId),
		{ params: FundsModel.id },
	)
	.post(
		"/cases/:caseId/move",
		({ access, params, body }) =>
			service.moveCase(access, params.caseId, body.targetId, body.placement),
		{
			params: FundsModel.id,
			body: t.Object({
				targetId: t.String({ format: "uuid" }),
				placement: t.Union([t.Literal("before"), t.Literal("after")]),
			}),
		},
	)
	.get(
		"/cases/:caseId/sources/:sourceId/original",
		({ access, params }) =>
			service.downloadSourceOriginal(access, params.caseId, params.sourceId),
		{
			params: t.Object({
				caseId: t.String({ format: "uuid" }),
				sourceId: t.String({ minLength: 1, maxLength: 256 }),
			}),
		},
	)
	.get(
		"/cases/:caseId",
		({ access, params }) => service.caseDetails(access, params.caseId),
		{ params: FundsModel.id },
	)
	.get(
		"/cases/:caseId/export",
		async ({ access, params, set }) => {
			set.headers["content-type"] = "text/csv; charset=utf-8";
			set.headers["content-disposition"] =
				"attachment; filename=standardized-observations.csv";
			return service.exportStandardized(access, params.caseId);
		},
		{ params: FundsModel.id },
	)
	.post(
		"/cases/:caseId/import",
		async ({ access, params, body }) =>
			jobs.enqueueImport(
				access,
				params.caseId,
				await Promise.all(
					body.files.map(async (file) => ({
						name: file.name,
						bytes: new Uint8Array(await file.arrayBuffer()),
					})),
				),
				"standard",
			),
		{ params: FundsModel.id, body: FundsModel.upload },
	)
	.post(
		"/cases/:caseId/sync",
		({ access, params }) => jobs.enqueueSync(access, params.caseId),
		{ params: FundsModel.id },
	)
	.post(
		"/cases/:caseId/standardize",
		async ({ access, params, body }) =>
			jobs.enqueueImport(
				access,
				params.caseId,
				await Promise.all(
					body.files.map(async (file) => ({
						name: file.name,
						bytes: new Uint8Array(await file.arrayBuffer()),
					})),
				),
				"ai",
			),
		{ params: FundsModel.id, body: FundsModel.upload },
	)
	.get(
		"/cases/:caseId/jobs",
		({ access, params }) => jobs.listJobs(access, params.caseId),
		{ params: FundsModel.id },
	)
	.post(
		"/cases/:caseId/jobs/:jobId/retry",
		({ access, params }) => jobs.retryJob(access, params.caseId, params.jobId),
		{
			params: t.Object({
				caseId: t.String({ format: "uuid" }),
				jobId: t.String({ format: "uuid" }),
			}),
		},
	)
	.get(
		"/cases/:caseId/jobs/:jobId/files/:fileId",
		async ({ access, params, query, set }) => {
			if (query.format === "original")
				return jobs.downloadJobFile(
					access,
					params.caseId,
					params.jobId,
					params.fileId,
					"original",
				);
			set.headers["content-type"] =
				query.format === "report"
					? "application/json; charset=utf-8"
					: "text/csv; charset=utf-8";
			set.headers["content-disposition"] =
				`attachment; filename=standardized.${query.format === "report" ? "json" : "csv"}`;
			return jobs.downloadJobFile(
				access,
				params.caseId,
				params.jobId,
				params.fileId,
				query.format ?? "csv",
			);
		},
		{
			params: t.Object({
				caseId: t.String({ format: "uuid" }),
				jobId: t.String({ format: "uuid" }),
				fileId: t.String({ format: "uuid" }),
			}),
			query: t.Object({
				format: t.Optional(
					t.Union([
						t.Literal("csv"),
						t.Literal("report"),
						t.Literal("original"),
					]),
				),
			}),
		},
	)
	.get(
		"/cases/:caseId/links",
		({ access, params }) => links.caseLinks(access, params.caseId),
		{ params: FundsModel.id },
	)
	.post(
		"/cases/:caseId/links",
		({ access, params, body }) =>
			links.includeCaseAccount(
				access,
				params.caseId,
				body.originCaseId,
				body.account,
				body.revision,
			),
		{
			params: FundsModel.id,
			body: t.Object({
				originCaseId: t.String({ format: "uuid" }),
				account: t.String({ minLength: 1, maxLength: 256 }),
				revision: t.Integer({ minimum: 1 }),
			}),
		},
	)
	.delete(
		"/cases/:caseId/links/:inclusionId",
		({ access, params }) =>
			links.excludeCaseAccount(access, params.caseId, params.inclusionId),
		{
			params: t.Object({
				caseId: t.String({ format: "uuid" }),
				inclusionId: t.String({ format: "uuid" }),
			}),
		},
	)
	.get(
		"/cases/:caseId/summary",
		({ access, params }) => service.analysisSummary(access, params.caseId),
		{ params: FundsModel.id },
	)
	.get(
		"/cases/:caseId/accounts",
		({ access, params, query }) =>
			service.listAccounts(access, params.caseId, query.search ?? ""),
		{
			params: FundsModel.id,
			query: t.Object({ search: t.Optional(t.String({ maxLength: 100 })) }),
		},
	)
	.get(
		"/cases/:caseId/graph",
		({ access, params, query }) =>
			service.caseGraph(access, params.caseId, query),
		{ params: FundsModel.id, query: FundsModel.graph },
	)
	.get(
		"/cases/:caseId/transactions",
		({ access, params, query }) =>
			service.listTransactions(access, params.caseId, query),
		{ params: FundsModel.id, query: FundsModel.filter },
	)
	.post(
		"/cases/:caseId/trace",
		({ access, params, body }) =>
			service.traceTransactions(access, params.caseId, body),
		{ params: FundsModel.id, body: FundsModel.trace },
	)
	.get(
		"/cases/:caseId/review",
		({ access, params, query }) =>
			service.reviewData(
				access,
				params.caseId,
				query.offset ?? 0,
				query.kind ?? "",
			),
		{ params: FundsModel.id, query: FundsModel.review },
	)
	.post(
		"/cases/:caseId/review",
		({ access, params, body }) =>
			service.decideMatch(
				access,
				params.caseId,
				body.candidateId,
				body.action,
				body.revision,
			),
		{ params: FundsModel.id, body: FundsModel.decision },
	)
	.get(
		"/cases/:caseId/row",
		({ access, params, query }) =>
			service.sourceRow(
				access,
				params.caseId,
				query.sourceId,
				query.sheet,
				query.row,
			),
		{ params: FundsModel.id, query: FundsModel.row },
	)
	.get(
		"/cases/:caseId/evidence/:transactionId",
		({ access, params }) =>
			service.evidence(access, params.caseId, params.transactionId),
		{
			params: t.Object({
				caseId: t.String({ format: "uuid" }),
				transactionId: t.String({ minLength: 64, maxLength: 64 }),
			}),
		},
	);
