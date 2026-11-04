/**
 * @file 文书取号的 Eden 客户端与浏览器下载适配。
 * 创建时间：2026-10-10；修改时间：2026-10-11。
 * 版本作用：使用后端契约推导类型，动态字段与权限不在浏览器伪造。
 * 被调用：documents 路由和视图；调用：共享 api 客户端。
 * 功能与预期结果：保留中文错误，Word 预览/下载使用真实生成字节，不存储文书内容。
 */
import { api } from "./api";

const documents = api.api.documents;
function unwrap<T>(result: {
	data: T | null;
	error: { value: unknown } | null;
}): T {
	if (result.error) {
		const value = result.error.value;
		throw new Error(
			typeof value === "object" &&
				value !== null &&
				"message" in value &&
				typeof value.message === "string"
				? value.message
				: "文书操作失败，请稍后重试。",
		);
	}
	if (result.data === null) throw new Error("文书服务未返回有效结果。");
	return result.data;
}
export const documentError = (error: unknown) =>
	error instanceof Error ? error.message : "无法连接文书服务，请稍后重试。";
export async function listDocumentCatalog() {
	return unwrap(await documents.catalog.get()).types;
}
export type DocumentCatalogType = Awaited<
	ReturnType<typeof listDocumentCatalog>
>[number];
export async function listDocumentTypes() {
	return unwrap(await documents.types.get()).types;
}
export type DocumentType = Awaited<
	ReturnType<typeof listDocumentTypes>
>[number];
export type DocumentField = DocumentType["fields"][number];
export type DocumentDraft = Parameters<typeof documents.preview.post>[0];
export async function listDocuments(
	query: Parameters<typeof documents.records.get>[0] = {},
) {
	return unwrap(await documents.records.get(query));
}
export type DocumentRow = Awaited<
	ReturnType<typeof listDocuments>
>["records"][number];
export async function getDocument(id: string) {
	return unwrap(await documents.records({ recordId: id }).get());
}
export type DocumentDetails = Awaited<ReturnType<typeof getDocument>>;
export async function createDocument(values: DocumentDraft, requestId: string) {
	return unwrap(await documents.records.post({ ...values, requestId }));
}
export async function updateDocument(
	id: string,
	values: Parameters<ReturnType<typeof documents.records>["patch"]>[0],
) {
	return unwrap(await documents.records({ recordId: id }).patch(values));
}
export async function deleteDocument(row: DocumentRow) {
	return unwrap(
		await documents
			.records({ recordId: row.id })
			.delete({ revision: row.revision }),
	);
}
export async function createDocumentType(
	values: Parameters<typeof documents.types.post>[0],
) {
	return unwrap(await documents.types.post(values));
}
export async function createSampleType(
	values: Parameters<typeof documents.types.sample.post>[0],
) {
	return unwrap(await documents.types.sample.post(values));
}
export async function updateDocumentType(
	type: DocumentType,
	values: { name: string; prefix: string; fields: DocumentField[] },
) {
	return unwrap(
		await documents
			.types({ typeId: type.id })
			.patch({ ...values, revision: type.revision }),
	);
}
export async function replaceDocumentTemplate(type: DocumentType, file: File) {
	return unwrap(
		await documents
			.types({ typeId: type.id })
			.template.post({ file, revision: type.revision }),
	);
}
export async function deleteDocumentType(type: DocumentType) {
	return unwrap(
		await documents
			.types({ typeId: type.id })
			.delete({ revision: type.revision }),
	);
}
export async function getNextNumber(typeId: string, year: number) {
	return unwrap(
		await documents.types({ typeId }).sequence.get({ query: { year } }),
	);
}
export async function setNextNumber(
	typeId: string,
	year: number,
	nextNumber: number,
) {
	return unwrap(
		await documents.types({ typeId }).sequence.post({ year, nextNumber }),
	);
}

/** Eden 将 DOCX 解析为 Blob；异常返回须先经过 unwrap，防止把 JSON 错误当文书展示。 */
function asBlob(value: unknown): Blob {
	if (value instanceof Blob) return value;
	throw new Error("文书响应格式不正确，请重新生成。");
}
export async function previewDocument(values: DocumentDraft) {
	return asBlob(unwrap(await documents.preview.post(values)));
}
export async function previewExistingDocument(
	id: string,
	values: Parameters<ReturnType<typeof documents.records>["patch"]>[0],
) {
	return asBlob(
		unwrap(await documents.records({ recordId: id }).preview.post(values)),
	);
}
export async function downloadDocument(id: string) {
	return asBlob(unwrap(await documents.records({ recordId: id }).file.get()));
}
export async function previewStoredDocument(id: string) {
	return asBlob(
		unwrap(await documents.records({ recordId: id }).preview.get()),
	);
}
export async function downloadTypeTemplate(id: string) {
	return asBlob(unwrap(await documents.types({ typeId: id }).template.get()));
}
export async function downloadSampleTemplate() {
	return asBlob(unwrap(await documents.sample.get()));
}

/** 下载完成后释放临时 URL；模板和文书内容不进入 localStorage。 */
export function saveDocumentFile(blob: Blob, name: string) {
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = name;
	anchor.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
