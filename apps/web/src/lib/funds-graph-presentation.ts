/**
 * @file 图谱个人标记、可见性与节点统计的纯规则。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-07
 * 版本作用：显示偏好与交易事实分离，账户和主体标记分别保存。
 * 被调用：图谱偏好 Hook、详情面板、G6 画布及测试。
 * 功能：校验存储、解析关联边标记、按币种统计收付与内部划转。
 * 预期结果：隐藏不减少账目，往返不抵销，重置标记保留原配置。
 */
import { isColorValue } from "./custom-themes";
import type { FundsTransaction } from "./funds";
import type { NodeMode } from "./funds-analysis";

export type NodeMark = {
	shape: "circle" | "rect" | "diamond" | "triangle" | "hexagon";
	size: number;
	fill: string;
	stroke: string;
	borderWidth: number;
	borderDash: "solid" | "dashed" | "dotted";
	edgeColor: string;
	edgeWidth: number;
	edgeDash: "solid" | "dashed" | "dotted";
	edgeScope: "out" | "in" | "both" | "none";
};
export type NodePresentation = {
	hidden?: boolean;
	marked?: boolean;
	mark?: NodeMark;
	updatedAt?: number;
};
export type GraphPresentation = Record<string, NodePresentation>;
export const nodePresentationKey = (mode: NodeMode, id: string) =>
	JSON.stringify([mode, id]);
export const graphPresentationStorageKey = (userId: string, caseId: string) =>
	`funds-graph:v1:${encodeURIComponent(userId)}:${encodeURIComponent(caseId)}`;
export const lineDash = (value: NodeMark["edgeDash"]) =>
	value === "dashed" ? [8, 4] : value === "dotted" ? [2, 4] : [];

/** 不信任浏览器存储，非法条目略过；未知协议或损坏 JSON 回到默认图谱。 */
export function decodeGraphPresentation(
	value: string | null,
): GraphPresentation {
	try {
		const data = JSON.parse(value ?? "null");
		if (data?.version !== 1 || !data.nodes || typeof data.nodes !== "object")
			return {};
		return Object.fromEntries(
			Object.entries(data.nodes).flatMap(([key, raw]) => {
				let pair: unknown;
				try {
					pair = JSON.parse(key);
				} catch {
					return [];
				}
				if (
					!Array.isArray(pair) ||
					pair.length !== 2 ||
					!["account", "subject"].includes(pair[0]) ||
					typeof pair[1] !== "string"
				)
					return [];
				if (!raw || typeof raw !== "object") return [];
				const entry = raw as NodePresentation;
				const mark = validNodeMark(entry.mark) ? entry.mark : undefined;
				return [
					[
						key,
						{
							hidden: entry.hidden === true,
							marked: entry.marked === true && !!mark,
							mark,
							updatedAt:
								typeof entry.updatedAt === "number" &&
								Number.isFinite(entry.updatedAt)
									? entry.updatedAt
									: 0,
						},
					],
				];
			}),
		);
	} catch {
		return {};
	}
}

export function validNodeMark(value: unknown): value is NodeMark {
	if (!value || typeof value !== "object") return false;
	const m = value as NodeMark;
	return (
		["circle", "rect", "diamond", "triangle", "hexagon"].includes(m.shape) &&
		typeof m.size === "number" &&
		m.size >= 60 &&
		m.size <= 240 &&
		[m.fill, m.stroke, m.edgeColor].every(
			(c) => typeof c === "string" && isColorValue(c),
		) &&
		[m.borderWidth, m.edgeWidth].every(
			(n) => typeof n === "number" && n >= 0.5 && n <= 6,
		) &&
		[m.borderDash, m.edgeDash].every((d) =>
			["solid", "dashed", "dotted"].includes(d),
		) &&
		["out", "in", "both", "none"].includes(m.edgeScope)
	);
}

/** 双方都有标记时使用最后保存且方向适用的标记，保证结果稳定且不会交换方向。 */
export function relatedEdgeMark(
	from?: NodePresentation,
	to?: NodePresentation,
) {
	const source =
		from?.marked && ["both", "out"].includes(from.mark?.edgeScope ?? "")
			? from
			: undefined;
	const target =
		to?.marked && ["both", "in"].includes(to.mark?.edgeScope ?? "")
			? to
			: undefined;
	return (
		!source
			? target
			: !target
				? source
				: (source.updatedAt ?? 0) >= (target.updatedAt ?? 0)
					? source
					: target
	)?.mark;
}

/** 统计传入范围，汇总边按原交易笔数计数；内部划转独立统计，不混入对外收付。 */
export function summarizeNode(
	data: {
		edges: readonly (FundsTransaction & {
			count?: number;
			lastTimestamp?: string;
		})[];
	},
	id: string,
) {
	const currencies = new Map<
		string,
		{
			incoming: bigint;
			outgoing: bigint;
			internal: bigint;
			inCount: number;
			outCount: number;
			internalCount: number;
		}
	>();
	const peers = new Set<string>();
	let count = 0;
	let first = "";
	let last = "";
	for (const t of data.edges) {
		if (t.from !== id && t.to !== id) continue;
		const transactionCount = t.count ?? 1;
		count += transactionCount;
		if (!first || t.timestamp < first) first = t.timestamp;
		const end = t.lastTimestamp ?? t.timestamp;
		if (end > last) last = end;
		const row = currencies.get(t.currency) ?? {
			incoming: 0n,
			outgoing: 0n,
			internal: 0n,
			inCount: 0,
			outCount: 0,
			internalCount: 0,
		};
		if (t.from === id && t.to === id) {
			row.internal += BigInt(t.amountMinor);
			row.internalCount += transactionCount;
		} else if (t.from === id) {
			row.outgoing += BigInt(t.amountMinor);
			row.outCount += transactionCount;
			peers.add(t.to);
		} else {
			row.incoming += BigInt(t.amountMinor);
			row.inCount += transactionCount;
			peers.add(t.from);
		}
		currencies.set(t.currency, row);
	}
	return {
		count,
		peers: peers.size,
		first,
		last,
		currencies: [...currencies].map(([currency, amounts]) => ({
			currency,
			...amounts,
		})),
	};
}
