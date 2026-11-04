/**
 * @file 文书取号和模板管理的受保护 HTTP 边界。
 * 创建时间：2026-10-10；修改时间：2026-10-11。
 * 版本作用：Eden 共用契约，普通人员和管理员在服务端分别校验。
 * 被调用：app.ts、Web 文书客户端；调用：accessPlugin、DocumentsModel、事务服务。
 * 功能与预期结果：提供模板、年度计数、分页文书、草稿预览和 DOCX 下载。
 * 失败条件：无会话 401、越权 403、无记录 404、冲突 409、输入错误 400/422。
 */
import { Elysia } from "elysia";
import { accessPlugin } from "../access/plugin";
import { DocumentsModel as M } from "./model";
import * as service from "./service";
import { inspectTemplate } from "./template";

/** 在已授权请求中返回私有 DOCX，文件名使用 RFC 5987 编码，不注入响应头。 */
function docx(result: { bytes: Uint8Array; fileName: string }) {
	return new Response(new Uint8Array(result.bytes), {
		headers: {
			"content-type":
				"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			"content-disposition": `attachment; filename=document.docx; filename*=UTF-8''${encodeURIComponent(result.fileName)}`,
			"cache-control": "no-store",
			"x-content-type-options": "nosniff",
		},
	});
}

export const documentsModule = new Elysia({
	name: "documents",
	prefix: "/api/documents",
})
	.use(accessPlugin)
	.guard({ access: "documents" })
	.get("/catalog", () => service.listCatalog())
	.get("/types", () => service.listTypes())
	.post(
		"/types",
		({ access, body }) => service.createType(access, body, body.file),
		{ body: M.upload },
	)
	.post(
		"/types/sample",
		({ access, body }) => service.createType(access, body),
		{ body: M.sample },
	)
	.get("/sample", ({ access }) => {
		service.requireAdmin(access);
		return docx(service.sampleTemplate());
	})
	.post(
		"/inspect",
		async ({ access, body }) => {
			service.requireAdmin(access);
			return {
				fields: inspectTemplate(
					new Uint8Array(await body.file.arrayBuffer()),
					body.file.name,
				),
			};
		},
		{ body: M.inspect },
	)
	.patch(
		"/types/:typeId",
		({ access, params, body }) =>
			service.updateType(access, params.typeId, body.revision, body),
		{ params: M.typeId, body: M.settings },
	)
	.post(
		"/types/:typeId/template",
		({ access, params, body }) =>
			service.updateType(
				access,
				params.typeId,
				body.revision,
				undefined,
				body.file,
			),
		{ params: M.typeId, body: M.replace },
	)
	.get(
		"/types/:typeId/template",
		async ({ access, params }) => {
			service.requireAdmin(access);
			return docx(await service.downloadTemplate(params.typeId));
		},
		{ params: M.typeId },
	)
	.delete(
		"/types/:typeId",
		({ access, params, body }) =>
			service.deleteType(access, params.typeId, body.revision),
		{ params: M.typeId, body: M.remove },
	)
	.get(
		"/types/:typeId/sequence",
		({ params, query }) => service.getSequence(params.typeId, query.year),
		{ params: M.typeId, query: M.year },
	)
	.post(
		"/types/:typeId/sequence",
		({ access, params, body }) =>
			service.setSequence(access, params.typeId, body.year, body.nextNumber),
		{ params: M.typeId, body: M.sequence },
	)
	.post(
		"/preview",
		async ({ body }) =>
			docx({
				bytes: await service.previewDraft(body),
				fileName: "文书草稿.docx",
			}),
		{ body: M.draft },
	)
	.get("/records", ({ access, query }) => service.listRecords(access, query), {
		query: M.list,
	})
	.post("/records", ({ access, body }) => service.createRecord(access, body), {
		body: M.create,
	})
	.get(
		"/records/:recordId",
		({ params }) => service.recordDetails(params.recordId),
		{ params: M.recordId },
	)
	.patch(
		"/records/:recordId",
		({ access, params, body }) =>
			service.updateRecord(access, params.recordId, body),
		{ params: M.recordId, body: M.update },
	)
	.post(
		"/records/:recordId/preview",
		async ({ access, params, body }) =>
			docx({
				bytes: await service.previewRecord(access, params.recordId, body),
				fileName: "文书修改预览.docx",
			}),
		{ params: M.recordId, body: M.update },
	)
	.get(
		"/records/:recordId/preview",
		async ({ params }) =>
			docx(await service.downloadRecord(params.recordId, true)),
		{ params: M.recordId },
	)
	.delete(
		"/records/:recordId",
		({ access, params, body }) =>
			service.deleteRecord(access, params.recordId, body.revision),
		{ params: M.recordId, body: M.remove },
	)
	.get(
		"/records/:recordId/file",
		async ({ params }) => docx(await service.downloadRecord(params.recordId)),
		{ params: M.recordId },
	);
