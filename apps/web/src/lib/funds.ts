/**
 * @file 资金调查的 Eden 客户端与显示工具。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-07
 * 版本作用：页面通过真实 API 工作，不内置案件样本或服务端运行时代码。
 * 被调用：funds 路由/视图；调用：共享 Eden 入口。
 * 功能：请求整案数据、上传文件、读取图和原始证据；无损格式化金额。
 * 预期结果：失败保留中文原因，金额全程使用整数分字符串。
 */
import { api } from "./api";

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
				: "请求失败，请稍后重试。",
		);
	}
	if (result.data === null) throw new Error("服务没有返回数据，请重试。");
	return result.data;
}
export const fundsError = (error: unknown) =>
	error instanceof Error ? error.message : "暂时无法连接服务，请重试。";
export const listFundsCases = async () =>
	unwrap(await api.api.funds.cases.get());
export const createFundsCase = async (name: string) =>
	unwrap(await api.api.funds.cases.post({ name }));
const caseApi = (caseId: string) => api.api.funds.cases({ caseId });
export const updateFundsCase = async (
	caseId: string,
	patch: { pinned?: boolean; archived?: boolean },
) => unwrap(await caseApi(caseId).patch(patch));
export const deleteFundsCase = async (caseId: string) =>
	unwrap(await caseApi(caseId).delete());
export const moveFundsCase = async (
	caseId: string,
	targetId: string,
	placement: "before" | "after",
) => unwrap(await caseApi(caseId).move.post({ targetId, placement }));
export const getFundsCase = async (caseId: string) =>
	unwrap(await caseApi(caseId).get());
export const importFunds = async (caseId: string, files: File[]) =>
	unwrap(await caseApi(caseId).import.post({ files }));
export const standardizeFunds = async (caseId: string, files: File[]) =>
	unwrap(await caseApi(caseId).standardize.post({ files }));
export const getFundsJobs = async (caseId: string) =>
	unwrap(await caseApi(caseId).jobs.get());
export const retryFundsJob = async (caseId: string, jobId: string) =>
	unwrap(await caseApi(caseId).jobs({ jobId }).retry.post());
export const getFundsLinks = async (caseId: string) =>
	unwrap(await caseApi(caseId).links.get());
export const includeFundsAccount = async (
	caseId: string,
	body: { originCaseId: string; account: string; revision: number },
) => unwrap(await caseApi(caseId).links.post(body));
export const excludeFundsAccount = async (
	caseId: string,
	inclusionId: string,
) => unwrap(await caseApi(caseId).links({ inclusionId }).delete());
export async function downloadFundsStandardFile(
	caseId: string,
	jobId: string,
	fileId: string,
	name: string,
	format: "csv" | "report" | "original",
) {
	const result = await caseApi(caseId)
		.jobs({ jobId })
		.files({ fileId })
		.get({ query: { format } });
	const data = unwrap(result);
	if (format === "original") {
		saveOriginalDownload(data, name);
		return;
	}
	const content =
		typeof data === "string" ? data : JSON.stringify(data, null, 2);
	const url = URL.createObjectURL(
		new Blob(
			[format === "csv" ? `\uFEFF${content.replace(/^\uFEFF/, "")}` : content],
			{
				type: format === "csv" ? "text/csv;charset=utf-8" : "application/json",
			},
		),
	);
	const link = document.createElement("a");
	link.href = url;
	link.download = `${name.replace(/\.[^.]+$/, "")}.${format === "csv" ? "标准.csv" : "转换报告.json"}`;
	document.body.append(link);
	link.click();
	link.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const syncFunds = async (caseId: string) =>
	unwrap(await caseApi(caseId).sync.post());
export const getFundsSummary = async (caseId: string) =>
	unwrap(await caseApi(caseId).summary.get());
export const getFundsAccounts = async (caseId: string, search = "") =>
	unwrap(await caseApi(caseId).accounts.get({ query: { search } }));
export type FundsFilter = {
	account?: string;
	counterparty?: string;
	transaction?: string;
	from?: string;
	to?: string;
	direction?: "in" | "out" | "both";
	offset?: number;
	limit?: number;
};
export const getFundsTransactions = async (
	caseId: string,
	query: FundsFilter,
) => unwrap(await caseApi(caseId).transactions.get({ query }));
export const getFundsGraph = async (
	caseId: string,
	query: Omit<FundsFilter, "limit" | "offset"> = {},
) => unwrap(await caseApi(caseId).graph.get({ query }));
export const traceFunds = async (
	caseId: string,
	body: {
		account: string;
		transaction: string;
		depth: number;
		from: string;
		to: string;
	},
) => unwrap(await caseApi(caseId).trace.post(body));
export const getFundsSubjects = async (caseId: string) =>
	unwrap(await caseApi(caseId).subjects.get());
export const scanFundsSubjects = async (caseId: string) =>
	unwrap(await caseApi(caseId).subjects.scan.post());
export const adjustFundsSubjects = async (
	caseId: string,
	body: {
		revision: number;
		action: "merge" | "separate";
		accounts: string[];
		name?: string;
	},
) => unwrap(await caseApi(caseId).subjects.post(body));
export const undoFundsSubjects = async (
	caseId: string,
	overrideId: string,
	revision: number,
) =>
	unwrap(await caseApi(caseId).subjects({ overrideId }).delete({ revision }));
export const getFundsReview = async (caseId: string, offset = 0, kind = "") =>
	unwrap(await caseApi(caseId).review.get({ query: { offset, kind } }));
export const decideFundsMatch = async (
	caseId: string,
	candidateId: string,
	action: "merge" | "separate",
	revision: number,
) =>
	unwrap(await caseApi(caseId).review.post({ candidateId, action, revision }));
export const getFundsEvidence = async (caseId: string, transactionId: string) =>
	unwrap(await caseApi(caseId).evidence({ transactionId }).get());
export const getFundsRow = async (
	caseId: string,
	query: { sourceId: string; sheet: string; row: number },
) => unwrap(await caseApi(caseId).row.get({ query }));
/** 下载 API 原始响应；临时 Object URL 在触发后释放，不保存本地凭据。 */
export async function downloadFundsCsv(caseId?: string) {
	const result = caseId
		? await caseApi(caseId).export.get()
		: await api.api.funds.template.get();
	if (result.status !== 200) {
		unwrap(result);
		throw new Error("下载失败");
	}
	// Eden 已消费响应体，使用已解析文本构造文件。
	const content = `\uFEFF${unwrap(result).replace(/^\uFEFF/, "")}`;
	const url = URL.createObjectURL(
		new Blob([content], { type: "text/csv;charset=utf-8" }),
	);
	const link = document.createElement("a");
	link.href = url;
	link.download = caseId ? "整案标准流水.csv" : "标准导入模板.csv";
	document.body.append(link);
	link.click();
	link.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export type FundsCase = Awaited<ReturnType<typeof getFundsCase>>;
export type FundsGraph = Awaited<ReturnType<typeof getFundsGraph>>;
export type FundsAccount = FundsGraph["nodes"][number];
export type FundsTransaction = FundsGraph["edges"][number];
export { formatFunds } from "./funds-money";
export const accountName = (account?: FundsAccount) =>
	(account?.identityStatus === "manual"
		? account.names[0]
		: account?.ownNames.join(" / ")) ||
	account?.names[0] ||
	"户名待核";

/** Eden 将 octet-stream 解析为 ArrayBuffer，保留原始 CSV 编码及 Excel 字节。 */
function saveOriginalDownload(data: unknown, name: string) {
	if (!(data instanceof ArrayBuffer))
		throw new Error("原件下载未返回文件，请重试。");
	const url = URL.createObjectURL(
		new Blob([data], { type: "application/octet-stream" }),
	);
	const link = document.createElement("a");
	link.href = url;
	link.download = name;
	document.body.append(link);
	link.click();
	link.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function downloadFundsOriginal(
	caseId: string,
	sourceId: string,
	name: string,
) {
	const result = await caseApi(caseId).sources({ sourceId }).original.get();
	saveOriginalDownload(unwrap(result), name);
}
