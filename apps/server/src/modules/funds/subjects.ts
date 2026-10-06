/**
 * @file 案件内账户归属识别及可撤销人工调整。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-06
 * 版本作用：证件优先，完整一致户名自动归组并标明推断，冲突账户保持独立。
 * 被调用：canonical / Worker；调用：纯快照与摘要函数。
 * 预期结果：每个账户恰好属于一个主体，原账户和交易不改写，人工调整保留历史。
 */
import { digest } from "./parser";
import type {
	FundsAccount,
	FundsSubject,
	ParsedSource,
	SubjectOverride,
} from "./types";

const cleanName = (value: string) =>
	value.normalize("NFKC").replace(/\s+/g, "").trim();
const usableName = (value: string) =>
	value.length >= 2 &&
	!/[＊*×?？]/.test(value) &&
	!/^(未知|不详|其他|对方账户待核|户名待核|无|空|NULL)$/i.test(value);

/** 身份资料只从本案来源读取；同名但证件冲突不按姓名连接。人工决定按时间应用，删除标记表示撤销。 */
export function identifySubjects(
	accounts: FundsAccount[],
	sources: ParsedSource[],
	overrides: SubjectOverride[] = [],
): FundsSubject[] {
	const identities = new Map<string, Set<string>>();
	for (const source of sources) {
		const owners = new Map(
			source.observations.map((o) => [
				JSON.stringify([o.sheet, o.row]),
				o.ownerAccount,
			]),
		);
		for (const row of source.rows) {
			const account = (
				owners.get(JSON.stringify([row.sheet, row.row])) ||
				row.fields["查询涉及账（卡）号"] ||
				row.fields["查询涉及账(卡)号"] ||
				row.fields.账号 ||
				row.fields.本方账号 ||
				row.fields.账户号码 ||
				""
			).trim();
			const identity = (
				row.fields.证件号码 ||
				row.fields.本方证件号码 ||
				row.fields.证照号码 ||
				row.fields.身份证号码 ||
				row.fields.证件号 ||
				row.fields.统一社会信用代码 ||
				""
			)
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
	}
	const names = new Map<string, string>();
	const nameIdentities = new Map<string, Set<string>>();
	for (const a of accounts) {
		const candidates = [
			...new Set(
				(a.ownNames.length ? a.ownNames : a.names)
					.map(cleanName)
					.filter(Boolean),
			),
		];
		const name =
			!a.unknown && candidates.length === 1 && usableName(candidates[0] ?? "")
				? candidates[0]
				: undefined;
		if (!name) continue;
		names.set(a.id, name);
		const ids = nameIdentities.get(name) ?? new Set<string>();
		for (const id of identities.get(a.number) ?? []) ids.add(id);
		nameIdentities.set(name, ids);
	}
	const groups = new Map<string, FundsSubject>();
	const put = (
		id: string,
		a: FundsAccount,
		status: FundsSubject["identityStatus"],
		basis: string,
	) => {
		const group = groups.get(id) ?? {
			id,
			accounts: [],
			names: [],
			identityStatus: status,
			basis,
		};
		group.accounts.push(a.id);
		group.names = [
			...new Set([
				...group.names,
				...(a.ownNames.length ? a.ownNames : a.names)
					.map(cleanName)
					.filter(Boolean),
			]),
		];
		if (status === "name-inferred") {
			group.identityStatus = status;
			group.basis = basis;
		}
		groups.set(id, group);
	};
	for (const a of accounts) {
		const ids = identities.get(a.number) ?? new Set<string>();
		const name = names.get(a.id);
		const nameIds = name ? nameIdentities.get(name) : undefined;
		if (a.unknown) {
			put(a.id, a, "unknown", "账号缺失，按交易保留独立待核节点");
			continue;
		}
		if (ids.size > 1) {
			put(a.id, a, "conflict", "同一账户存在不同证件标识，未自动归组");
			continue;
		}
		if (ids.size === 1) {
			put(
				`person:${digest([...ids][0] ?? "")}`,
				a,
				"documented",
				"来源证件标识一致",
			);
			continue;
		}
		if (name && (nameIds?.size ?? 0) <= 1) {
			const document = [...(nameIds ?? [])][0];
			put(
				document ? `person:${digest(document)}` : `name:${digest(name)}`,
				a,
				"name-inferred",
				"完整户名一致，自动归组；同名身份尚未独立核验",
			);
		} else
			put(
				a.id,
				a,
				"conflict",
				name
					? "同名账户存在不同证件标识，未按姓名归组"
					: "户名缺失、遮蔽或冲突，保持独立账户",
			);
	}
	const accountMap = new Map(accounts.map((a) => [a.id, a]));
	for (const decision of overrides) {
		if (decision.deletedAt) continue;
		const selected = new Set(
			decision.accounts.filter((id) => accountMap.has(id)),
		);
		for (const [id, group] of groups) {
			group.accounts = group.accounts.filter((a) => !selected.has(a));
			if (!group.accounts.length) groups.delete(id);
			else if (group.identityStatus !== "manual")
				group.names = [
					...new Set(
						group.accounts.flatMap((key) => {
							const a = accountMap.get(key);
							return a
								? (a.ownNames.length ? a.ownNames : a.names)
										.map(cleanName)
										.filter(Boolean)
								: [];
						}),
					),
				];
		}
		for (const id of selected) {
			const a = accountMap.get(id);
			if (!a) continue;
			const key =
				decision.action === "merge"
					? `manual:${decision.id}`
					: `separate:${id}`;
			put(
				key,
				a,
				"manual",
				decision.action === "merge" ? "人工合并，可撤销" : "人工拆分，可撤销",
			);
			if (decision.action === "merge" && decision.name.trim()) {
				const group = groups.get(key);
				if (group) group.names = [decision.name.trim()];
			}
		}
	}
	return [...groups.values()];
}

export function subjectSummary(subjects: FundsSubject[] = []) {
	const known = subjects.filter((s) => s.identityStatus !== "unknown");
	return {
		subjects: known.length,
		mergedGroups: known.filter((s) => s.accounts.length > 1).length,
		mergedAccounts: known.reduce(
			(n, s) => n + Math.max(0, s.accounts.length - 1),
			0,
		),
		inferredGroups: known.filter(
			(s) => s.accounts.length > 1 && s.identityStatus === "name-inferred",
		).length,
		conflicts: known.filter((s) => s.identityStatus === "conflict").length,
	};
}
