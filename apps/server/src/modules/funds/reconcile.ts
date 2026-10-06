/**
 * @file 跨文件去重、双边记账核对及案件图快照生成。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-06
 * 版本作用：可重放的纯计算；姓名相同不构成账户归并依据。
 * 被调用：导入/核对服务与测试；调用：parser.digest、内部契约。
 * 功能：保留文件内重复次数、跨文件证据、未确认双边候选及未知对手。
 * 预期结果：相同银行流水号的手续费不吞并；双边互唯一和完整同额组自动匹配，冲突暂缓入图。
 */
import { digest } from "./parser";
import type {
	FundsAccount,
	FundsSnapshot,
	MatchCandidate,
	MatchDecision,
	Observation,
	ParsedSource,
	Transaction,
} from "./types";

type Group = { id: string; observation: Observation; evidence: Observation[] };
const endpoints = (row: Observation) =>
	row.direction === "out"
		? [row.ownerAccount, row.otherAccount]
		: [row.otherAccount, row.ownerAccount];

/**
 * 从完整案件原始观测重建规范图。相同指纹按文件内出现次数对齐，避免吞掉真实重复付款。
 * 账户/金额/币种一致的秒级对应、60 秒内互唯一和完整同额组可自动配对；其余留候选。
 * 人工决定须引用仍存在的组且金额/方向相容，否则忽略并保留观测。
 */
export function reconcile(
	sources: ParsedSource[],
	decisions: MatchDecision[] = [],
): FundsSnapshot {
	const groups = new Map<string, Group>();
	const all = sources.flatMap((source) => source.observations);
	for (const source of [...sources].sort((a, b) => a.id.localeCompare(b.id))) {
		const occurrences = new Map<string, number>();
		for (const row of source.observations) {
			const fingerprint = digest(
				JSON.stringify([
					row.ownerAccount,
					row.otherAccount,
					row.direction,
					row.amountMinor,
					row.balanceMinor,
					row.currency,
					row.timestamp,
					row.bankReference,
					row.summary,
				]),
			);
			const occurrence = (occurrences.get(fingerprint) ?? 0) + 1;
			occurrences.set(fingerprint, occurrence);
			const id = digest(`${fingerprint}:${occurrence}`);
			const existing = groups.get(id);
			if (existing) existing.evidence.push(row);
			else groups.set(id, { id, observation: row, evidence: [row] });
		}
	}
	const buckets = new Map<string, Group[]>();
	for (const group of groups.values()) {
		const row = group.observation;
		if (!row.otherAccount || row.otherAccount === row.ownerAccount) continue;
		const key = JSON.stringify([
			...endpoints(row),
			row.currency,
			row.amountMinor,
		]);
		const bucket = buckets.get(key) ?? [];
		bucket.push(group);
		buckets.set(key, bucket);
	}
	const near: MatchCandidate[] = [];
	const exact = new Map<string, string[]>();
	for (const bucket of buckets.values()) {
		const incoming = bucket
			.filter((group) => group.observation.direction === "in")
			.sort((a, b) =>
				a.observation.timestamp.localeCompare(b.observation.timestamp),
			);
		for (const out of bucket.filter(
			(group) => group.observation.direction === "out",
		)) {
			for (const into of incoming) {
				const seconds =
					Math.abs(
						Date.parse(out.observation.timestamp) -
							Date.parse(into.observation.timestamp),
					) / 1000;
				if (seconds > 60) continue;
				const [from = "", to = ""] = endpoints(out.observation);
				near.push({
					id: digest(`${out.id}:${into.id}`),
					left: out.id,
					right: into.id,
					seconds,
					amountMinor: out.observation.amountMinor,
					from,
					to,
				});
				if (!seconds) {
					exact.set(out.id, [...(exact.get(out.id) ?? []), into.id]);
					exact.set(into.id, [...(exact.get(into.id) ?? []), out.id]);
				}
			}
		}
	}
	const matched = new Map<
		string,
		{ other: string; kind: "mirror" | "reviewed" }
	>();
	const separated = new Set(
		decisions
			.filter((d) => d.action === "separate")
			.map((d) => digest(`${d.left}:${d.right}`)),
	);
	for (const decision of decisions.filter((d) => d.action === "merge")) {
		if (
			near.some(
				(c) => c.left === decision.left && c.right === decision.right,
			) &&
			!matched.has(decision.left) &&
			!matched.has(decision.right)
		) {
			matched.set(decision.left, { other: decision.right, kind: "reviewed" });
			matched.set(decision.right, { other: decision.left, kind: "reviewed" });
		}
	}
	for (const candidate of near) {
		if (
			!candidate.seconds &&
			exact.get(candidate.left)?.length === 1 &&
			exact.get(candidate.right)?.length === 1 &&
			!separated.has(candidate.id) &&
			!matched.has(candidate.left) &&
			!matched.has(candidate.right)
		) {
			matched.set(candidate.left, { other: candidate.right, kind: "mirror" });
			matched.set(candidate.right, { other: candidate.left, kind: "mirror" });
		}
	}
	// 使用整组的一对一约束：双向唯一的近时记录先配对，平衡组按时间/原行顺序配对。
	let changed = true;
	while (changed) {
		changed = false;
		const remaining = near.filter(
			(c) =>
				!matched.has(c.left) && !matched.has(c.right) && !separated.has(c.id),
		);
		const degree = new Map<string, number>();
		for (const c of remaining)
			for (const id of [c.left, c.right])
				degree.set(id, (degree.get(id) ?? 0) + 1);
		for (const c of remaining)
			if (degree.get(c.left) === 1 && degree.get(c.right) === 1) {
				matched.set(c.left, { other: c.right, kind: "mirror" });
				matched.set(c.right, { other: c.left, kind: "mirror" });
				changed = true;
			}
	}
	const unresolved = near.filter(
		(c) =>
			!matched.has(c.left) && !matched.has(c.right) && !separated.has(c.id),
	);
	const neighbors = new Map<string, Set<string>>();
	for (const c of unresolved) {
		for (const [a, b] of [
			[c.left, c.right],
			[c.right, c.left],
		] as const) {
			const set = neighbors.get(a) ?? new Set<string>();
			set.add(b);
			neighbors.set(a, set);
		}
	}
	const visited = new Set<string>();
	for (const start of neighbors.keys()) {
		if (visited.has(start)) continue;
		const stack = [start];
		const component: Group[] = [];
		while (stack.length) {
			const id = stack.pop();
			if (!id || visited.has(id)) continue;
			visited.add(id);
			const group = groups.get(id);
			if (group) component.push(group);
			stack.push(...(neighbors.get(id) ?? []));
		}
		const order = (a: Group, b: Group) =>
			a.observation.timestamp.localeCompare(b.observation.timestamp) ||
			a.observation.row - b.observation.row ||
			a.id.localeCompare(b.id);
		const out = component
			.filter((g) => g.observation.direction === "out")
			.sort(order);
		const into = component
			.filter((g) => g.observation.direction === "in")
			.sort(order);
		if (
			out.length !== into.length ||
			!out.length ||
			!out.every((g, i) => neighbors.get(g.id)?.has(into[i]?.id ?? ""))
		)
			continue;
		for (let i = 0; i < out.length; i++) {
			const a = out[i];
			const b = into[i];
			if (!a || !b) continue;
			matched.set(a.id, { other: b.id, kind: "mirror" });
			matched.set(b.id, { other: a.id, kind: "mirror" });
		}
	}
	const candidates = near.filter(
		(c) =>
			!matched.has(c.left) && !matched.has(c.right) && !separated.has(c.id),
	);
	const accounts = new Map<string, FundsAccount>();
	function remember(
		number: string,
		name: string,
		own: boolean,
		timestamp: string,
	) {
		if (!number) return;
		const item = accounts.get(number) ?? {
			id: number,
			number,
			names: [],
			ownNames: [],
			hasStatement: false,
			unknown: false,
			firstSeen: timestamp,
			lastSeen: timestamp,
		};
		if (name && !item.names.includes(name)) item.names.push(name);
		if (own && name && !item.ownNames.includes(name)) item.ownNames.push(name);
		item.hasStatement ||= own;
		item.firstSeen = [item.firstSeen, timestamp].sort()[0] ?? timestamp;
		item.lastSeen = [item.lastSeen, timestamp].sort()[1] ?? timestamp;
		accounts.set(number, item);
	}
	for (const row of all) {
		remember(row.ownerAccount, row.ownerName, true, row.timestamp);
		remember(row.otherAccount, row.otherName, false, row.timestamp);
	}
	const transactions: Transaction[] = [];
	const used = new Set<string>();
	for (const group of groups.values()) {
		if (used.has(group.id)) continue;
		const pairing = matched.get(group.id);
		const other = pairing ? groups.get(pairing.other) : undefined;
		const anchor = other?.observation.direction === "out" ? other : group;
		const row = anchor.observation;
		const [fromNumber = "", toNumber = ""] = endpoints(row);
		const from = fromNumber || `unknown:${anchor.id}:from`;
		const to = toNumber || `unknown:${anchor.id}:to`;
		for (const number of [from, to])
			if (number.startsWith("unknown:"))
				accounts.set(number, {
					id: number,
					number: "",
					names: [row.otherName || "对方账户待核"],
					ownNames: [],
					hasStatement: false,
					unknown: true,
					firstSeen: row.timestamp,
					lastSeen: row.timestamp,
				});
		transactions.push({
			id: anchor.id,
			groupIds: [group.id, ...(other ? [other.id] : [])],
			from,
			to,
			amountMinor: row.amountMinor,
			currency: row.currency,
			timestamp: row.timestamp,
			summary: row.summary,
			evidenceIds: [...group.evidence, ...(other?.evidence ?? [])]
				.map((item) => item.id)
				.sort(),
			reconciliation: pairing?.kind ?? "single",
		});
		used.add(group.id);
		if (other) used.add(other.id);
	}
	const issues = sources.flatMap((source) => source.issues);
	const conflicted = [...accounts.values()].filter(
		(account) => account.ownNames.length > 1,
	);
	for (const account of conflicted) {
		const row = all.find((item) => item.ownerAccount === account.id);
		if (row)
			issues.push({
				id: digest(`name:${account.id}`),
				sourceId: row.sourceId,
				sheet: row.sheet,
				row: row.row,
				kind: "name-conflict",
				message: `同一账号出现多个本方户名：${account.ownNames.join(" / ")}；保留别名，暂不确认主体归属`,
			});
	}
	const held = new Set(candidates.flatMap((c) => [c.left, c.right]));
	const heldTransactionIds = transactions
		.filter((t) => t.groupIds?.some((id) => held.has(id)))
		.map((t) => t.id);
	return {
		version: 1,
		accounts: [...accounts.values()],
		transactions: transactions.sort(
			(a, b) =>
				a.timestamp.localeCompare(b.timestamp) || a.id.localeCompare(b.id),
		),
		candidates,
		issues,
		heldTransactionIds,
		totals: {
			sourceCount: sources.length,
			rawRows: sources.reduce((n, s) => n + s.rows.length, 0),
			observations: all.length,
			duplicates: all.length - groups.size,
			mirrored: matched.size / 2,
			transactionCount: transactions.length - heldTransactionIds.length,
			heldTransactions: heldTransactionIds.length,
			feedback: sources.reduce((n, s) => n + s.feedbackCount, 0),
			auxiliary: sources.reduce((n, s) => n + s.auxiliaryCount, 0),
			quarantined: issues.filter((i) => i.kind === "quarantine").length,
			nameConflicts: conflicted.length,
			candidates: candidates.length,
		},
	};
}
