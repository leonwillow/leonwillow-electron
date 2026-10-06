/**
 * @file 规范交易稳定标识与案件内主体归属。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-06
 * 版本作用：追加证据不重置交易 ID；证件依据仅在当前案件内使用。
 * 被调用：版本提交服务；调用：纯快照契约。
 * 预期结果：账户事实保留，主体自动归组有依据且可撤销，双边后补仍能找到原交易。
 */
import { digest } from "./parser";
import { identifySubjects } from "./subjects";
import type { FundsSnapshot, ParsedSource } from "./types";

export function prepareCanonical(
	snapshot: FundsSnapshot,
	previous: FundsSnapshot | undefined,
	sources: ParsedSource[],
) {
	const byEvidence = new Map<string, string>();
	for (const tx of previous?.transactions ?? [])
		for (const id of tx.evidenceIds) byEvidence.set(id, tx.id);
	const used = new Set<string>();
	const held = new Set(snapshot.heldTransactionIds ?? []);
	const heldIds: string[] = [];
	for (const tx of snapshot.transactions) {
		const oldId = tx.evidenceIds
			.map((id) => byEvidence.get(id))
			.find((id) => id && !used.has(id));
		const wasHeld = held.has(tx.id);
		if (oldId) tx.id = oldId;
		if (used.has(tx.id)) tx.id = digest(`${tx.id}:${tx.evidenceIds.join(":")}`);
		used.add(tx.id);
		if (wasHeld) heldIds.push(tx.id);
	}
	snapshot.heldTransactionIds = heldIds;
	snapshot.subjectOverrides ??= previous?.subjectOverrides ?? [];
	snapshot.subjects = identifySubjects(
		snapshot.accounts,
		sources,
		snapshot.subjectOverrides,
	);
	snapshot.subjectRuleVersion = 2;
	return snapshot;
}
