/**
 * @file 规范交易稳定标识与案件内主体归属。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-06
 * 版本作用：追加证据不重置交易 ID；证件依据仅在当前案件内使用。
 * 被调用：版本提交服务；调用：纯快照契约。
 * 预期结果：人员同名不自动合并，双边后补仍能找到原交易。
 */
import { digest } from "./parser";
import type { FundsSnapshot, FundsSubject, ParsedSource } from "./types";

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
	const identities = new Map<string, Set<string>>();
	for (const source of sources)
		for (const row of source.rows) {
			const account = (
				row.fields.账号 ||
				row.fields.本方账号 ||
				row.fields.账户号码 ||
				""
			).trim();
			const identity = (row.fields.证件号码 || row.fields.本方证件号码 || "")
				.trim()
				.toUpperCase();
			if (
				account &&
				/^[A-Z0-9-]{8,25}$/.test(identity) &&
				!/^0+$/.test(identity)
			) {
				const ids = identities.get(account) ?? new Set<string>();
				ids.add(identity);
				identities.set(account, ids);
			}
		}
	const subjects = new Map<string, FundsSubject>();
	for (const account of snapshot.accounts) {
		const ids = identities.get(account.number);
		const documented = ids?.size === 1;
		const id = documented ? `person:${digest([...ids][0] ?? "")}` : account.id;
		const subject = subjects.get(id) ?? {
			id,
			names: [],
			accounts: [],
			identityStatus: documented
				? "documented"
				: account.unknown
					? "unknown"
					: "account-owner",
		};
		subject.accounts.push(account.id);
		subject.names = [
			...new Set([...subject.names, ...account.ownNames, ...account.names]),
		];
		subjects.set(id, subject);
	}
	snapshot.subjects = [...subjects.values()];
	return snapshot;
}
