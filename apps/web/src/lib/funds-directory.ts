/**
 * @file 账户目录的本地条件筛选。
 * 创建时间：2026-10-07
 * 修改时间：2026-10-07
 * 版本作用：目录搜索、状态与笔数筛选独立于图谱范围。
 * 被调用：AccountDirectory、目录测试；调用：资金视图与标记类型。
 * 预期结果：组合筛选覆盖完整案件目录，不截断，不发起额外请求。
 */
import type { analysisDirectory } from "./funds-analysis";
import type { GraphPresentation } from "./funds-graph-presentation";

export type DirectoryEntry = ReturnType<typeof analysisDirectory>[number];
export type DirectoryFilters = {
	coverage: "all" | "statement" | "counterparty";
	naming: "all" | "conflict" | "consistent";
	mark: "all" | "marked" | "unmarked";
	visibility: "all" | "hidden" | "visible";
	minCount: string;
	maxCount: string;
};
export const emptyDirectoryFilters: DirectoryFilters = {
	coverage: "all",
	naming: "all",
	mark: "all",
	visibility: "all",
	minCount: "",
	maxCount: "",
};

export function directoryFilterCount(filters: DirectoryFilters) {
	return Object.entries(filters).filter(
		([key, value]) =>
			value !== emptyDirectoryFilters[key as keyof DirectoryFilters],
	).length;
}

/** 笔数必须为非负安全整数，空值表示不限；区间错误阻止提交。 */
export function directoryFilterError(filters: DirectoryFilters) {
	for (const value of [filters.minCount, filters.maxCount])
		if (value && (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))))
			return "交易笔数请输入非负整数。";
	if (
		filters.minCount &&
		filters.maxCount &&
		Number(filters.minCount) > Number(filters.maxCount)
	)
		return "最高笔数不能小于最低笔数。";
	return "";
}

/** 仅筛选传入案件的完整目录，所有条件取交集，保留原有排序。 */
export function filterDirectory(
	entries: DirectoryEntry[],
	term: string,
	filters: DirectoryFilters,
	presentations: GraphPresentation,
) {
	const query = term.trim().toLocaleLowerCase();
	return entries.filter((node) => {
		const appearance = presentations[node.id];
		return (
			(!query ||
				[...node.names, ...node.ownNames, ...node.accountNumbers].some((v) =>
					v.toLocaleLowerCase().includes(query),
				)) &&
			(filters.coverage === "all" ||
				node.hasStatement === (filters.coverage === "statement")) &&
			(filters.naming === "all" ||
				node.ownNames.length > 1 === (filters.naming === "conflict")) &&
			(filters.mark === "all" ||
				!!appearance?.marked === (filters.mark === "marked")) &&
			(filters.visibility === "all" ||
				!!appearance?.hidden === (filters.visibility === "hidden")) &&
			(!filters.minCount ||
				node.transactionCount >= Number(filters.minCount)) &&
			(!filters.maxCount || node.transactionCount <= Number(filters.maxCount))
		);
	});
}
