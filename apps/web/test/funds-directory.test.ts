/**
 * @file 完整账户目录的筛选交集与差额金额验证。
 * 创建时间：2026-10-07
 * 修改时间：2026-10-07
 * 版本作用：验证超 200 项目录、组合条件、负差额和大金额精度。
 * 被调用：Bun test；调用：目录纯函数与金额显示函数。
 * 预期结果：筛选不漏掉末尾账户，正负差额不丢分、不跨币种混算。
 */
import { expect, test } from "bun:test";
import type { FundsAccount } from "../src/lib/funds";
import { analysisDirectory } from "../src/lib/funds-analysis";
import {
	directoryFilterError,
	emptyDirectoryFilters,
	filterDirectory,
} from "../src/lib/funds-directory";
import { formatFunds } from "../src/lib/funds-money";

const accounts: FundsAccount[] = Array.from({ length: 816 }, (_, index) => ({
	id: `account-${index}`,
	number: `${index}`,
	names: [`户名${index}`],
	ownNames: index === 815 ? ["名称一", "名称二"] : [],
	hasStatement: index < 22,
	unknown: false,
	firstSeen: "",
	lastSeen: "",
	accountNumbers: [`${index}`],
	identityStatus: "name-inferred",
	basis: "test",
	accounts: [],
}));
const directory = analysisDirectory({ nodes: accounts, edges: [] }, "").map(
	(node) => ({ ...node, transactionCount: node.number === "815" ? 8 : 1 }),
);

test("目录覆盖全部 816 项，搜索与多条件交集能定位第 816 个账户", () => {
	expect(
		filterDirectory(directory, "", emptyDirectoryFilters, {}),
	).toHaveLength(816);
	const filters = {
		...emptyDirectoryFilters,
		coverage: "counterparty",
		naming: "conflict",
		mark: "marked",
		visibility: "hidden",
		minCount: "8",
		maxCount: "8",
	} as const;
	const appearances = { "account-815": { marked: true, hidden: true } };
	expect(
		filterDirectory(directory, "815", filters, appearances).map(
			(node) => node.id,
		),
	).toEqual(["account-815"]);
	expect(
		filterDirectory(
			directory,
			"815",
			{ ...filters, minCount: "9", maxCount: "10" },
			appearances,
		),
	).toHaveLength(0);
	expect(
		filterDirectory(
			directory,
			"815",
			{ ...filters, mark: "unmarked" },
			appearances,
		),
	).toHaveLength(0);
	expect(
		filterDirectory(directory, "名称一", emptyDirectoryFilters, {}),
	).toHaveLength(1);
	expect(
		filterDirectory(
			directory,
			"",
			{ ...emptyDirectoryFilters, coverage: "statement" },
			{},
		),
	).toHaveLength(22);
	expect(accounts).toHaveLength(816);
});

test("空笔数不限，拒绝倒置区间、负数、小数与超安全整数", () => {
	expect(directoryFilterError(emptyDirectoryFilters)).toBe("");
	expect(
		directoryFilterError({
			...emptyDirectoryFilters,
			minCount: "0",
			maxCount: "0",
		}),
	).toBe("");
	for (const value of ["-1", "1.5", "abc", "9007199254740992"])
		expect(
			directoryFilterError({ ...emptyDirectoryFilters, minCount: value }),
		).not.toBe("");
	expect(
		directoryFilterError({
			...emptyDirectoryFilters,
			minCount: "100",
			maxCount: "99",
		}),
	).not.toBe("");
});

test("金额格式化准确呈现正负差额与小于一元的负数", () => {
	expect(formatFunds((1876713813n - 1870591045n).toString())).toBe(
		"¥61,227.68",
	);
	expect(formatFunds("-7")).toBe("-¥0.07");
	expect(formatFunds("-101")).toBe("-¥1.01");
	expect(formatFunds("-9007199254740993", "USD")).toBe(
		"-USD 90,071,992,547,409.93",
	);
	expect(formatFunds("0")).toBe("¥0.00");
});
