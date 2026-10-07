/**
 * @file 四种资金视图的笔数、金额、方向与追溯守恒测试。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-07
 * 被调用：Bun；调用：实际纯视图投影函数。
 * 预期结果：合并只改变展示粒度，不丢失回向、内部划转或超安全整数金额。
 */
import { expect, test } from "bun:test";
import type { FundsAccount, FundsTransaction } from "../src/lib/funds";
import {
	aggregateAnalysis,
	analysisDirectory,
	filterAnalysis,
	projectAccounts,
	projectTrace,
} from "../src/lib/funds-analysis";
import {
	amountToMinor,
	edgeFilterError,
	emptyEdgeFilter,
	emptyNodeFilter,
	filterGraph,
} from "../src/lib/funds-graph-filters";
import { fundsEdgeStyles } from "../src/lib/funds-graph-layout";
import {
	decodeGraphPresentation,
	graphPresentationStorageKey,
	type NodeMark,
	nodePresentationKey,
	relatedEdgeMark,
	summarizeNode,
	validNodeMark,
} from "../src/lib/funds-graph-presentation";
import { createGraphPreviewIndex } from "../src/lib/funds-graph-preview";
import {
	createViewHistory,
	moveView,
	pushView,
} from "../src/lib/funds-view-history";

const person = (id: string, ids: string[]): FundsAccount => ({
	id,
	number: ids[0] ?? "",
	names: [id],
	ownNames: [id],
	hasStatement: true,
	unknown: false,
	firstSeen: "",
	lastSeen: "",
	accountNumbers: ids,
	identityStatus: "name-inferred",
	basis: "test",
	accounts: ids.map((a) => ({
		id: a,
		number: a,
		names: [id],
		ownNames: [id],
		hasStatement: true,
		unknown: false,
		firstSeen: "",
		lastSeen: "",
	})),
});
const edge = (
	id: string,
	from: string,
	to: string,
	fromAccount: string,
	toAccount: string,
	amountMinor: string,
	currency = "CNY",
): FundsTransaction => ({
	id,
	from,
	to,
	fromAccount,
	toAccount,
	amountMinor,
	currency,
	timestamp: "2022-01-05T10:00:00+08:00",
	summary: "",
	evidenceIds: [id],
	reconciliation: "single",
});
const data = {
	nodes: [person("赵佳", ["a1", "a2"]), person("对手", ["b"])],
	edges: [
		edge("1", "赵佳", "对手", "a1", "b", "9007199254740993"),
		edge("2", "赵佳", "对手", "a2", "b", "101"),
		edge("3", "对手", "赵佳", "b", "a1", "300"),
		edge("4", "赵佳", "赵佳", "a1", "a2", "200"),
		edge("5", "赵佳", "对手", "a1", "b", "7", "USD"),
	],
};

test("悬停索引在四种视图中守恒，缓存节点摘要并正确区分节点与边 ID", () => {
	for (const nodeMode of ["account", "subject"] as const) {
		const raw = projectAccounts(data, nodeMode);
		for (const edgeMode of ["transaction", "flow"] as const) {
			const graph = aggregateAnalysis(raw, edgeMode);
			const index = createGraphPreviewIndex(graph);
			for (const node of graph.nodes) {
				const target = { kind: "node" as const, id: node.id };
				const preview = index.get(target);
				expect(preview?.kind).toBe("node");
				if (preview?.kind === "node")
					expect(preview.summary).toEqual(summarizeNode(raw, node.id));
				expect(index.get(target)).toBe(preview);
			}
			const first = graph.edges[0];
			if (!first) throw new Error("测试交易缺失");
			const preview = index.get({ kind: "edge", id: first.id });
			expect(preview?.kind).toBe("edge");
			if (preview?.kind === "edge") {
				expect(preview.edge).toBe(first);
				expect(preview.from?.id).toBe(first.from);
				expect(preview.to?.id).toBe(first.to);
			}
			expect(index.get({ kind: "node", id: "不存在" })).toBeNull();
		}
	}
});

test("悬停统计使用当前视图范围，汇总包含末次时间与原笔数，换图不复用缓存", () => {
	const [first, second] = data.edges;
	if (!first || !second) throw new Error("测试交易缺失");
	const later = { ...second, timestamp: "2023-06-01T15:00:00+08:00" };
	const current = { nodes: data.nodes, edges: [first, later] };
	const graph = aggregateAnalysis(current, "flow");
	const index = createGraphPreviewIndex(graph);
	const preview = index.get({ kind: "node", id: "赵佳" });
	if (preview?.kind !== "node") throw new Error("节点摘要缺失");
	expect(preview.summary.count).toBe(2);
	expect(preview.summary.last).toBe(later.timestamp);
	expect(preview.summary.currencies[0]?.outgoing).toBe(9007199254741094n);
	const empty = createGraphPreviewIndex({ nodes: data.nodes, edges: [] }).get({
		kind: "node",
		id: "赵佳",
	});
	if (empty?.kind !== "node") throw new Error("孤立节点摘要缺失");
	expect(empty.summary.count).toBe(0);
	expect(empty.summary.currencies).toEqual([]);
	expect(index.get({ kind: "edge", id: "赵佳" })).toBeNull();
});

test("四种模式所有交易恰好出现一次，金额不受合并影响", () => {
	for (const nodeMode of ["account", "subject"] as const)
		for (const edgeMode of ["transaction", "flow"] as const) {
			const result = aggregateAnalysis(
				projectAccounts(data, nodeMode),
				edgeMode,
			);
			expect(result.nodes).toHaveLength(nodeMode === "account" ? 3 : 2);
			expect(result.edges.reduce((n, t) => n + t.count, 0)).toBe(5);
			expect(result.edges.flatMap((t) => t.transactionIds).sort()).toEqual([
				"1",
				"2",
				"3",
				"4",
				"5",
			]);
			expect(
				result.edges.reduce((sum, t) => sum + BigInt(t.amountMinor), 0n),
			).toBe(9007199254741601n);
			const nodes = new Set(result.nodes.map((n) => n.id));
			expect(
				result.edges.every((t) => nodes.has(t.from) && nodes.has(t.to)),
			).toBe(true);
		}
});

test("往返不抵销、币种不混加、内部划转保留", () => {
	const result = aggregateAnalysis(data, "flow");
	expect(result.edges).toHaveLength(4);
	const outward = result.edges.find(
		(t) => t.from === "赵佳" && t.to === "对手" && t.currency === "CNY",
	);
	expect(outward?.amountMinor).toBe("9007199254741094");
	expect(outward?.count).toBe(2);
	expect(result.edges.find((t) => t.from === "对手")?.amountMinor).toBe("300");
	expect(result.edges.find((t) => t.from === t.to)?.transactionIds).toEqual([
		"4",
	]);
	expect(analysisDirectory(data, "赵佳")[0]?.transactionCount).toBe(5);
});

test("主体/账户、对手、方向和日期筛选先于汇总", () => {
	const filtered = filterAnalysis(data, {
		account: "赵佳",
		counterparty: "b",
		direction: "in",
	});
	expect(filtered.edges.map((t) => t.id)).toEqual(["3"]);
	const cards = projectAccounts(data, "account");
	expect(
		filterAnalysis(cards, { account: "a2", direction: "out" }).edges.map(
			(t) => t.id,
		),
	).toEqual(["2"]);
	expect(filterAnalysis(data, { from: "2022-01-06" }).edges).toHaveLength(0);
	expect(filterAnalysis(data, { to: "2022-01-04" }).edges).toHaveLength(0);
	expect(
		aggregateAnalysis(
			filterAnalysis(data, {
				account: "赵佳",
				counterparty: "b",
				direction: "out",
			}),
			"flow",
		).edges.reduce((n, t) => n + t.count, 0),
	).toBe(3);
});

test("账户追踪不画未参与路径的同主体其他卡", () => {
	const traced = projectTrace(
		{ nodes: data.nodes, edges: data.edges.slice(0, 1) },
		"account",
	);
	expect(traced.nodes.map((n) => n.id).sort()).toEqual(["a1", "b"]);
});

test("双向平行边、不同币种及自环各有样式，边 ID 不丢失", () => {
	const edges = aggregateAnalysis(data, "flow").edges;
	const styles = fundsEdgeStyles(edges, 40, 45);
	expect(styles.size).toBe(edges.length);
	const offsets = edges
		.filter((t) => t.from !== t.to)
		.map(
			(t) => (styles.get(t.id)?.curveOffset ?? 0) * (t.from <= t.to ? 1 : -1),
		);
	expect(new Set(offsets).size).toBe(offsets.length);
	const internal = edges.find((t) => t.from === t.to);
	if (!internal) throw new Error("缺少内部划转");
	expect(styles.get(internal.id)?.loopPlacement).toBe("top");
});

const mark: NodeMark = {
	shape: "diamond",
	size: 160,
	fill: "#123456",
	stroke: "#234567",
	borderWidth: 2,
	borderDash: "dashed",
	edgeColor: "#345678",
	edgeWidth: 3,
	edgeDash: "dotted",
	edgeScope: "out",
};

test("节点详情统计双向独立、内部划转仅计一次、金额保持整数分精度", () => {
	const summary = summarizeNode(data, "赵佳");
	expect(summary.count).toBe(5);
	expect(summary.peers).toBe(1);
	expect(summary.currencies.find((c) => c.currency === "CNY")).toMatchObject({
		incoming: 300n,
		outgoing: 9007199254741094n,
		internal: 200n,
		inCount: 1,
		outCount: 2,
		internalCount: 1,
	});
	expect(summary.currencies.find((c) => c.currency === "USD")?.outgoing).toBe(
		7n,
	);
	expect(summarizeNode(data, "不存在").count).toBe(0);
});

test("标记范围尊重出入方向，双方冲突由最后有效保存决定，重置恢复默认", () => {
	const source = { mark, marked: true, updatedAt: 10 };
	const target = {
		mark: { ...mark, edgeScope: "in" as const, edgeColor: "#abcdef" },
		marked: true,
		updatedAt: 20,
	};
	expect(relatedEdgeMark(source, undefined)).toEqual(mark);
	expect(relatedEdgeMark(undefined, source)).toBeUndefined();
	expect(relatedEdgeMark(source, target)).toEqual(target.mark);
	expect(relatedEdgeMark(source, { ...target, marked: false })).toEqual(mark);
	expect(
		relatedEdgeMark({ ...source, marked: false }, undefined),
	).toBeUndefined();
});

test("显示偏好按案件用户与模式隔离，恢复标记不需更改交易数据", () => {
	expect(graphPresentationStorageKey("u1", "c1")).not.toBe(
		graphPresentationStorageKey("u1", "c2"),
	);
	expect(graphPresentationStorageKey("u1", "c1")).not.toBe(
		graphPresentationStorageKey("u2", "c1"),
	);
	expect(nodePresentationKey("account", "a")).not.toBe(
		nodePresentationKey("subject", "a"),
	);
	const key = nodePresentationKey("account", "a");
	const decoded = decodeGraphPresentation(
		JSON.stringify({
			version: 1,
			nodes: { [key]: { hidden: true, marked: false, mark, updatedAt: 1 } },
		}),
	);
	expect(decoded[key]?.hidden).toBe(true);
	expect(decoded[key]?.marked).toBe(false);
	expect(decoded[key]?.mark).toEqual(mark);
	expect(decodeGraphPresentation("broken")).toEqual({});
	expect(decodeGraphPresentation('{"version":9}')).toEqual({});
	expect(validNodeMark({ ...mark, size: Number.POSITIVE_INFINITY })).toBe(
		false,
	);
	expect(
		validNodeMark({ ...mark, fill: "url(https://example.com/image)" }),
	).toBe(false);
	expect(validNodeMark({ ...mark, edgeWidth: -1 })).toBe(false);
});

test("节点筛选保留往来对手，不扩散到对手之间；严格模式只保留命中端点", () => {
	const graph = aggregateAnalysis(
		{
			...data,
			nodes: [...data.nodes, person("其他", ["c"])],
			edges: [...data.edges, edge("6", "对手", "其他", "b", "c", "100")],
		},
		"flow",
	);
	const filtered = filterGraph(
		graph,
		{ ...emptyNodeFilter, query: "赵佳" },
		emptyEdgeFilter,
		"flow",
		{},
	);
	expect(filtered.nodes.map((n) => n.id)).toEqual(["赵佳", "对手"]);
	expect(filtered.edges.flatMap((e) => e.transactionIds).sort()).toEqual([
		"1",
		"2",
		"3",
		"4",
		"5",
	]);
	const strict = filterGraph(
		graph,
		{ ...emptyNodeFilter, query: "赵佳", scope: "matched" },
		emptyEdgeFilter,
		"flow",
		{},
	);
	expect(strict.edges.flatMap((e) => e.transactionIds)).toEqual(["4"]);
	expect(
		filterGraph(
			graph,
			{ ...emptyNodeFilter, query: "不存在" },
			emptyEdgeFilter,
			"flow",
			{},
		),
	).toEqual({ nodes: [], edges: [] });
});

test("节点资料与标记取交集，账号片段可匹配主体下任一卡", () => {
	const graph = aggregateAnalysis(data, "transaction");
	expect(
		filterGraph(
			graph,
			{ ...emptyNodeFilter, query: "a2", mark: "marked" },
			emptyEdgeFilter,
			"transaction",
			{ 赵佳: { marked: true } },
		).edges,
	).toHaveLength(5);
	expect(
		filterGraph(
			graph,
			{ ...emptyNodeFilter, coverage: "counterparty" },
			emptyEdgeFilter,
			"transaction",
			{},
		).nodes,
	).toHaveLength(0);
});

test("金额筛选用整数分比较，流向笔数仅约束汇总，不抵销反向交易", () => {
	expect(amountToMinor("90071992547410.94")).toBe(9007199254741094n);
	for (const invalid of ["-1", "1e3", "1.001", "1,000", "NaN"])
		expect(amountToMinor(invalid)).toBeNull();
	expect(
		edgeFilterError(
			{ ...emptyEdgeFilter, minAmount: "3", maxAmount: "2" },
			"flow",
		),
	).not.toBe("");
	expect(
		edgeFilterError({ ...emptyEdgeFilter, minCount: "1.5" }, "flow"),
	).not.toBe("");
	const graph = aggregateAnalysis(data, "flow");
	const filter = {
		...emptyEdgeFilter,
		minAmount: "90071992547410.94",
		maxAmount: "90071992547410.94",
		minCount: "2",
	};
	expect(
		filterGraph(graph, emptyNodeFilter, filter, "flow", {}).edges.flatMap(
			(e) => e.transactionIds,
		),
	).toEqual(["1", "2"]);
	expect(
		filterGraph(
			graph,
			emptyNodeFilter,
			{
				...emptyEdgeFilter,
				maxAmount: "3.00",
				currency: "CNY",
				internal: "exclude",
			},
			"flow",
			{},
		).edges.flatMap((e) => e.transactionIds),
	).toEqual(["3"]);
	expect(
		filterGraph(
			aggregateAnalysis(data, "transaction"),
			emptyNodeFilter,
			{ ...emptyEdgeFilter, minCount: "999" },
			"transaction",
			{},
		).edges,
	).toHaveLength(5);
	expect(
		filterGraph(
			graph,
			emptyNodeFilter,
			{ ...emptyEdgeFilter, internal: "only" },
			"flow",
			{},
		).edges.flatMap((e) => e.transactionIds),
	).toEqual(["4"]);
});

test("历史恢复分析条件、隐藏节点与画布；返回后新操作清除前进分支", () => {
	const initial = { account: "", query: "", hidden: [] as string[] };
	const canvas = {
		zoom: 2,
		position: [100, 200] as [number, number],
		nodes: [{ id: "赵佳", x: 13, y: 42 }],
	};
	const first = createViewHistory(initial);
	const second = pushView(first, { ...initial, account: "赵佳" }, canvas);
	const third = pushView(
		second,
		{ ...initial, account: "赵佳", hidden: ["对手"] },
		{ ...canvas, zoom: 3 },
		canvas,
	);
	const back = moveView(third, -1);
	expect(back.frames[back.index]?.state.hidden).toEqual([]);
	expect(back.frames[back.index]?.canvas?.zoom).toBe(3);
	const forward = moveView(back, 1);
	expect(forward.frames[forward.index]?.state.hidden).toEqual(["对手"]);
	expect(forward.frames[forward.index]?.canvas).toEqual(canvas);
	const branch = pushView(back, { ...initial, query: "其他" });
	expect(moveView(branch, 1)).toBe(branch);
	expect(branch.frames).toHaveLength(3);
	expect(branch.frames.at(-1)?.state.query).toBe("其他");
	expect(moveView(first, -1)).toBe(first);
	expect(first.frames[0]?.canvas).toBeUndefined();
	let many = first;
	for (let i = 0; i < 60; i++)
		many = pushView(many, { ...initial, account: String(i) });
	expect(many.frames).toHaveLength(50);
	expect(many.index).toBe(49);
	expect(createViewHistory(initial).frames).toHaveLength(1);
});
