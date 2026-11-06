/**
 * @file 笔录文件夹、独立笔录、常用询问人及 Word 导出的受保护 HTTP 边界。
 * 创建时间：2026-11-04；修改时间：2026-11-05。
 * 版本作用：提供当前 SPA 和未来桌面端共用的 Eden 契约。
 * 被调用：createApp、Web 笔录客户端；调用：权限插件、模型、事务服务、Word 生成器。
 * 预期结果：无登录 401、无模块权限 403、资源不可见 404、旧版本/归档 409、坏输入 400/422。
 */
import { Elysia } from "elysia";
import { accessPlugin } from "../access/plugin";
import { createInquiryDocx, inquiryFileName } from "./docx-export";
import { InquiriesModel as M } from "./model";
import * as service from "./service";

export const inquiriesModule = new Elysia({
	name: "inquiries",
	prefix: "/api/inquiries",
})
	.use(accessPlugin)
	.guard({ access: "inquiries" })
	.get(
		"/cases",
		async ({ access, query }) => ({
			cases: await service.listCases(access, query),
		}),
		{ query: M.directory },
	)
	.post("/cases", ({ access, body }) => service.createCase(access, body.name), {
		body: M.createCase,
	})
	.post(
		"/standalone",
		({ access, body }) => service.createStandalone(access, body),
		{
			body: M.create,
		},
	)
	.get(
		"/cases/:caseId",
		({ access, params }) => service.getCase(access, params.caseId),
		{ params: M.caseId },
	)
	.patch(
		"/cases/:caseId",
		({ access, params, body }) =>
			service.updateCase(access, params.caseId, body),
		{ params: M.caseId, body: M.updateCase },
	)
	.delete(
		"/cases/:caseId",
		({ access, params, body }) =>
			service.deleteCase(access, params.caseId, body.revision),
		{ params: M.caseId, body: M.remove },
	)
	.get(
		"/cases/:caseId/records",
		({ access, params, query }) =>
			service.listRecords(access, params.caseId, query),
		{ params: M.caseId, query: M.list },
	)
	.post(
		"/cases/:caseId/records",
		({ access, params, body }) =>
			service.createRecord(access, params.caseId, body),
		{ params: M.caseId, body: M.create },
	)
	.get(
		"/cases/:caseId/records/:recordId",
		({ access, params }) =>
			service.getRecord(access, params.caseId, params.recordId),
		{ params: M.recordId },
	)
	.patch(
		"/cases/:caseId/records/:recordId",
		({ access, params, body }) =>
			service.updateRecordMetadata(
				access,
				params.caseId,
				params.recordId,
				body,
			),
		{ params: M.recordId, body: M.metadata },
	)
	.put(
		"/cases/:caseId/records/:recordId",
		({ access, params, body }) =>
			service.updateRecord(access, params.caseId, params.recordId, body),
		{ params: M.recordId, body: M.update },
	)
	.delete(
		"/cases/:caseId/records/:recordId",
		({ access, params, body }) =>
			service.deleteRecord(
				access,
				params.caseId,
				params.recordId,
				body.revision,
			),
		{ params: M.recordId, body: M.remove },
	)
	.get(
		"/cases/:caseId/records/:recordId/file",
		async ({ access, params }) => {
			const record = await service.getRecord(
				access,
				params.caseId,
				params.recordId,
			);
			return new Response(new Uint8Array(createInquiryDocx(record)), {
				headers: {
					"content-type":
						"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
					"content-disposition": `attachment; filename=inquiry.docx; filename*=UTF-8''${encodeURIComponent(inquiryFileName(record.title))}`,
					"cache-control": "no-store",
					"x-content-type-options": "nosniff",
				},
			});
		},
		{ params: M.recordId },
	)
	.get("/inquirers", async ({ access }) => ({
		inquirers: await service.listInquirers(access),
	}))
	.post(
		"/inquirers",
		({ access, body }) => service.saveInquirer(access, body),
		{ body: M.inquirer },
	)
	.put(
		"/inquirers/:inquirerId",
		({ access, params, body }) =>
			service.saveInquirer(access, body, params.inquirerId, body.revision),
		{ params: M.inquirerId, body: M.updateInquirer },
	)
	.delete(
		"/inquirers/:inquirerId",
		({ access, params, body }) =>
			service.deleteInquirer(access, params.inquirerId, body.revision),
		{ params: M.inquirerId, body: M.remove },
	);
