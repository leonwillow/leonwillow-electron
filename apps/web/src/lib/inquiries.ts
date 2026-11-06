/**
 * @file 笔录领域的 Eden 客户端。
 * 创建时间：2026-11-04；修改时间：2026-11-05。
 * 版本作用：由服务端契约推导数据，不引入服务端运行时代码。
 * 被调用：笔录视图与案件导航；调用：共用 api。
 * 功能与预期结果：所有数据持久化到服务端，保留中文错误与修订号。
 */
import { api } from "./api";

const inquiries = api.api.inquiries;
function unwrap<T>(result: {
	data: T | null;
	error: { value: unknown; status: number } | null;
}): T {
	if (result.error) {
		const value = result.error.value;
		const message =
			typeof value === "object" &&
			value &&
			"message" in value &&
			typeof value.message === "string"
				? value.message
				: "笔录操作失败，请稍后重试。";
		throw new InquiryError(message, result.error.status);
	}
	if (result.data === null) throw new Error("笔录服务未返回有效结果。");
	return result.data;
}
export class InquiryError extends Error {
	constructor(
		message: string,
		public status: number,
	) {
		super(message);
	}
}
export const inquiryError = (error: unknown) =>
	error instanceof Error ? error.message : "无法连接笔录服务，请稍后重试。";
export async function listInquiryCases(
	query: { q?: string; archived?: boolean } = {},
) {
	return unwrap(await inquiries.cases.get({ query })).cases;
}
export type InquiryCase = Awaited<ReturnType<typeof listInquiryCases>>[number];
export async function getInquiryCase(id: string) {
	return unwrap(await inquiries.cases({ caseId: id }).get());
}
export async function createInquiryCase(name: string) {
	return unwrap(await inquiries.cases.post({ name }));
}
export async function updateInquiryCase(
	row: Pick<InquiryCase, "id" | "revision" | "name" | "archived">,
	patch: { name?: string; archived?: boolean },
) {
	return unwrap(
		await inquiries.cases({ caseId: row.id }).patch({
			name: row.name,
			archived: row.archived,
			revision: row.revision,
			...patch,
		}),
	);
}
export async function deleteInquiryCase(
	row: Pick<InquiryCase, "id" | "revision">,
) {
	return unwrap(
		await inquiries
			.cases({ caseId: row.id })
			.delete({ revision: row.revision }),
	);
}
export async function listInquiryRecords(
	caseId: string,
	query: { q?: string; offset?: number; archived?: boolean } = {},
) {
	return unwrap(
		await inquiries
			.cases({ caseId })
			.records.get({ query: { ...query, limit: 30 } }),
	);
}
export type InquiryRow = Awaited<
	ReturnType<typeof listInquiryRecords>
>["records"][number];
export async function getInquiryRecord(caseId: string, recordId: string) {
	return unwrap(await inquiries.cases({ caseId }).records({ recordId }).get());
}
export type InquiryRecord = Awaited<ReturnType<typeof getInquiryRecord>>;
export type InquiryDocument = Pick<InquiryRecord, "title" | "content">;
export type InquiryContent = InquiryDocument["content"];
export async function createStandaloneInquiry(
	draft: InquiryDocument,
	requestId: string,
) {
	return unwrap(await inquiries.standalone.post({ ...draft, requestId }));
}
export async function createInquiryRecord(
	caseId: string,
	draft: InquiryDocument,
	requestId: string,
) {
	return unwrap(
		await inquiries.cases({ caseId }).records.post({ ...draft, requestId }),
	);
}
export async function updateInquiryRecord(
	caseId: string,
	recordId: string,
	draft: InquiryDocument,
	revision: number,
) {
	return unwrap(
		await inquiries
			.cases({ caseId })
			.records({ recordId })
			.put({ ...draft, revision }),
	);
}
export async function updateInquiryRecordMetadata(
	caseId: string,
	recordId: string,
	revision: number,
	patch: { title: string } | { archived: boolean },
) {
	return unwrap(
		await inquiries
			.cases({ caseId })
			.records({ recordId })
			.patch({ ...patch, revision }),
	);
}
export async function deleteInquiryRecord(
	caseId: string,
	row: Pick<InquiryRow, "id" | "revision">,
) {
	return unwrap(
		await inquiries
			.cases({ caseId })
			.records({ recordId: row.id })
			.delete({ revision: row.revision }),
	);
}
export async function exportInquiryRecord(caseId: string, recordId: string) {
	const file = unwrap(
		await inquiries.cases({ caseId }).records({ recordId }).file.get(),
	);
	if (!(file instanceof Blob)) throw new Error("Word 文件格式不正确，请重试。");
	return file;
}
export async function listInquiryInquirers() {
	return unwrap(await inquiries.inquirers.get()).inquirers;
}
export type FrequentInquirer = Awaited<
	ReturnType<typeof listInquiryInquirers>
>[number];
export async function saveInquiryInquirer(
	input: { name: string; badgeNumber: string },
	row?: FrequentInquirer,
) {
	return row
		? unwrap(
				await inquiries
					.inquirers({ inquirerId: row.id })
					.put({ ...input, revision: row.revision }),
			)
		: unwrap(await inquiries.inquirers.post(input));
}
export async function deleteInquiryInquirer(row: FrequentInquirer) {
	return unwrap(
		await inquiries
			.inquirers({ inquirerId: row.id })
			.delete({ revision: row.revision }),
	);
}

/** 下载的对象 URL 延迟释放；笔录和身份资料不写入浏览器持久存储。 */
export function saveInquiryFile(blob: Blob, title: string) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `${title.replace(/[\\/:*?"<>|]/g, "_") || "询问笔录"}.docx`;
	a.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
