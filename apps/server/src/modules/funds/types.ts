/**
 * @file 流水清洗与图投影的内部数据契约。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-06
 * 版本作用：首版整案导入，原始观测与唯一交易分离。
 * 被调用：funds 解析、归并、存储与图服务；Web 仅通过 Eden 推导接口。
 * 功能：金额使用分的十进制字符串，时间统一为中国标准时间。
 * 预期结果：每条交易可追溯原文件、工作表和行，不以姓名合并账户。
 */
export type SourceRow = {
	sheet: string;
	row: number;
	fields: Record<string, string>;
};
export type Issue = {
	id: string;
	sourceId: string;
	sheet: string;
	row: number;
	kind: string;
	message: string;
};
export type Observation = {
	id: string;
	sourceId: string;
	sheet: string;
	row: number;
	ownerAccount: string;
	ownerName: string;
	otherAccount: string;
	otherName: string;
	direction: "in" | "out";
	amountMinor: string;
	balanceMinor: string | null;
	currency: string;
	timestamp: string;
	bankReference: string;
	summary: string;
	queryBank?: string;
	counterpartyBank?: string;
	remarks?: string;
};
export type ParsedSource = {
	id: string;
	name: string;
	sha256: string;
	size: number;
	encoding: string;
	rows: SourceRow[];
	observations: Observation[];
	issues: Issue[];
	feedbackCount: number;
	auxiliaryCount: number;
	normalization?: {
		model: string;
		promptVersion: string;
		converterVersion?: string;
		report: string;
	};
};
export type FundsAccount = {
	id: string;
	number: string;
	names: string[];
	ownNames: string[];
	hasStatement: boolean;
	unknown: boolean;
	firstSeen: string;
	lastSeen: string;
};
export type Transaction = {
	id: string;
	from: string;
	to: string;
	amountMinor: string;
	currency: string;
	timestamp: string;
	summary: string;
	evidenceIds: string[];
	reconciliation: "single" | "mirror" | "reviewed";
	groupIds?: string[];
};
export type MatchCandidate = {
	id: string;
	left: string;
	right: string;
	seconds: number;
	amountMinor: string;
	from: string;
	to: string;
};
export type MatchDecision = {
	left: string;
	right: string;
	action: "merge" | "separate";
	actor: string;
	at: string;
};
export type FundsSnapshot = {
	version: 1;
	accounts: FundsAccount[];
	transactions: Transaction[];
	candidates: MatchCandidate[];
	issues: Issue[];
	heldTransactionIds?: string[];
	subjects?: FundsSubject[];
	totals: {
		sourceCount: number;
		rawRows: number;
		observations: number;
		duplicates: number;
		mirrored: number;
		transactionCount: number;
		feedback: number;
		auxiliary: number;
		quarantined: number;
		nameConflicts: number;
		candidates: number;
		heldTransactions?: number;
	};
};
export type FundsSubject = {
	id: string;
	names: string[];
	accounts: string[];
	identityStatus: "documented" | "account-owner" | "unknown";
};
export type GraphFilter = {
	account?: string;
	counterparty?: string;
	transaction?: string;
	from?: string;
	to?: string;
	direction?: "both" | "out" | "in";
	limit?: number;
	offset?: number;
};
