/**
 * @file Neo4j 资金图连接、原子投影及受限查询。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-06
 * 版本作用：规范交易以 TRANSFER 边存储，统计、列表和穿透均查询图。
 * 被调用：启动入口和 funds 服务；调用：neo4j-driver。
 * 功能：按案件替换完整图版本，提供参数化分页、账户筛选和时间有序路径。
 * 预期结果：案件隔离、整数金额无精度损失，图版本落后时由服务拒绝分析。
 */
import neo4j, { type Driver, type QueryResult } from "neo4j-driver";
import type { FundsSnapshot, GraphFilter } from "./types";

const number = (value: unknown) =>
	neo4j.isInt(value) ? value.toNumber() : Number(value);
const accountProps = (value: Record<string, unknown>) => ({
	id: String(value.subjectId),
	number: String(value.number),
	names: value.names as string[],
	ownNames: value.ownNames as string[],
	hasStatement: Boolean(value.hasStatement),
	unknown: Boolean(value.unknown),
	firstSeen: String(value.firstSeen),
	lastSeen: String(value.lastSeen),
	accountNumbers: (value.accountNumbers ?? []) as string[],
	identityStatus: String(value.identityStatus ?? "account-owner"),
});
const transferProps = (value: Record<string, unknown>) => ({
	id: String(value.transactionId),
	from: String(value.from),
	to: String(value.to),
	fromAccount: String(value.fromAccount ?? value.from),
	toAccount: String(value.toAccount ?? value.to),
	amountMinor: String(value.amountMinor),
	currency: String(value.currency),
	timestamp: String(value.timestamp),
	summary: String(value.summary),
	evidenceIds: value.evidenceIds as string[],
	reconciliation: String(value.reconciliation),
});

/** 创建延迟连接的驱动；调用方负责 close，连接失败不阻塞健康检查和认证。 */
export function createFundsGraph(
	uri: string,
	username: string,
	password: string,
) {
	const driver = neo4j.driver(uri, neo4j.auth.basic(username, password), {
		connectionAcquisitionTimeout: 10_000,
		connectionTimeout: 10_000,
		maxTransactionRetryTime: 5_000,
		maxConnectionPoolSize: 10,
	});
	let constraints: Promise<void> | undefined;
	const ensure = () =>
		(constraints ??= ensureConstraints(driver).catch((error) => {
			constraints = undefined;
			throw error;
		}));
	const run = async (query: string, parameters: Record<string, unknown>) => {
		const session = driver.session({
			database: "neo4j",
			defaultAccessMode: neo4j.session.READ,
		});
		try {
			return await session.run(query, parameters, { timeout: 15_000 });
		} finally {
			await session.close();
		}
	};
	return {
		close: () => driver.close(),
		/** PG 已提交完整版本后调用；整个案件替换在单一 Neo4j 事务内，失败保留旧图。 */
		async project(caseId: string, revision: number, snapshot: FundsSnapshot) {
			await ensure();
			const accountMap = new Map(snapshot.accounts.map((a) => [a.id, a]));
			const subjects =
				snapshot.subjects ??
				snapshot.accounts.map((a) => ({
					id: a.id,
					accounts: [a.id],
					names: a.names,
					identityStatus: a.unknown ? "unknown" : "account-owner",
				}));
			const owners = new Map(
				subjects.flatMap((s) => s.accounts.map((a) => [a, s.id] as const)),
			);
			const held = new Set(snapshot.heldTransactionIds ?? []);
			const transactions = snapshot.transactions.filter((t) => !held.has(t.id));
			const session = driver.session({ database: "neo4j" });
			try {
				await session.executeWrite(
					async (tx) => {
						await tx.run(
							"MATCH (n:FundsNode {caseId: $caseId}) DETACH DELETE n",
							{ caseId },
						);
						await tx.run(
							"UNWIND $rows AS row CREATE (a:FundsNode:FundsSubject) SET a = row, a.caseId = $caseId, a.revision = $revision",
							{
								caseId,
								revision: neo4j.int(revision),
								rows: subjects.map((s) => {
									const accounts = s.accounts.flatMap((id) => {
										const a = accountMap.get(id);
										return a ? [a] : [];
									});
									return {
										subjectId: s.id,
										number: accounts[0]?.number ?? "",
										accountNumbers: accounts.map((a) => a.id),
										ownAccountNumbers: accounts
											.filter((a) => a.hasStatement)
											.map((a) => a.id),
										names: s.names,
										ownNames: [...new Set(accounts.flatMap((a) => a.ownNames))],
										hasStatement: accounts.some((a) => a.hasStatement),
										unknown: accounts.every((a) => a.unknown),
										identityStatus: s.identityStatus,
										firstSeen: accounts.map((a) => a.firstSeen).sort()[0] ?? "",
										lastSeen:
											accounts
												.map((a) => a.lastSeen)
												.sort()
												.at(-1) ?? "",
									};
								}),
							},
						);
						await tx.run(
							"MATCH (c:FundsCase {caseId: $caseId}) DETACH DELETE c",
							{ caseId },
						);
						for (let start = 0; start < transactions.length; start += 1000) {
							await tx.run(
								"UNWIND $rows AS row MATCH (a:FundsSubject {caseId: $caseId, subjectId: row.from}), (b:FundsSubject {caseId: $caseId, subjectId: row.to}) CREATE (a)-[t:TRANSFER]->(b) SET t = row, t.caseId = $caseId, t.revision = $revision",
								{
									caseId,
									revision: neo4j.int(revision),
									rows: transactions.slice(start, start + 1000).map((t) => ({
										...t,
										from: owners.get(t.from) ?? t.from,
										to: owners.get(t.to) ?? t.to,
										fromAccount: t.from,
										toAccount: t.to,
										transactionId: t.id,
										amountMinor: neo4j.int(t.amountMinor),
									})),
								},
							);
						}
					},
					{ timeout: 60_000 },
				);
			} finally {
				await session.close();
			}
		},
		async summary(caseId: string) {
			const result = await run(
				"MATCH (a:FundsSubject {caseId: $caseId}) OPTIONAL MATCH (a)-[t:TRANSFER {caseId: $caseId}]->() RETURN count(DISTINCT a) AS accounts, reduce(total = 0, node IN collect(DISTINCT a) | total + size(node.ownAccountNumbers)) AS statements, count(t) AS transactions, min(t.timestamp) AS first, max(t.timestamp) AS last",
				{ caseId },
			);
			const row = result.records[0];
			const currencies = await run(
				"MATCH ()-[t:TRANSFER {caseId: $caseId}]->() RETURN t.currency AS currency, toString(sum(t.amountMinor)) AS amountMinor, count(t) AS count ORDER BY currency",
				{ caseId },
			);
			return {
				accounts: number(row?.get("accounts") ?? 0),
				statementAccounts: number(row?.get("statements") ?? 0),
				transactions: number(row?.get("transactions") ?? 0),
				first: row?.get("first") as string | null,
				last: row?.get("last") as string | null,
				currencies: currencies.records.map((r) => ({
					currency: String(r.get("currency")),
					amountMinor: String(r.get("amountMinor")),
					count: number(r.get("count")),
				})),
			};
		},
		async accounts(caseId: string, search = "") {
			const result = await run(
				"MATCH (a:FundsSubject {caseId: $caseId}) WHERE NOT a.unknown AND ($search = '' OR any(account IN a.accountNumbers WHERE account CONTAINS $search) OR any(name IN a.names WHERE name CONTAINS $search)) OPTIONAL MATCH (a)-[t:TRANSFER {caseId: $caseId}]-() RETURN a, count(DISTINCT t) AS count ORDER BY a.hasStatement DESC, count DESC, a.subjectId LIMIT 200",
				{ caseId, search },
			);
			return result.records.map((r) => ({
				...accountProps(r.get("a").properties),
				transactionCount: number(r.get("count")),
			}));
		},
		/** 完整返回已入图的事实，含仅见对手的节点；无筛选时也返回无边节点，不设交易笔数上限。 */
		async graph(caseId: string, filter: Omit<GraphFilter, "limit" | "offset">) {
			const parameters = graphParameters(caseId, filter);
			const result = await run(
				`MATCH (a:FundsSubject)-[t:TRANSFER]->(b:FundsSubject)
WHERE ${transactionWhere}
RETURN a,t,b ORDER BY t.timestamp, t.transactionId
UNION ALL
MATCH (a:FundsSubject {caseId: $caseId})
WHERE $unfiltered AND NOT (a)-[:TRANSFER {caseId: $caseId}]-()
RETURN a, null AS t, null AS b`,
				{
					...parameters,
					unfiltered:
						!filter.account &&
						!filter.counterparty &&
						!filter.transaction &&
						!filter.from &&
						!filter.to,
				},
			);
			const graph = graphRows(result);
			return { ...graph, total: graph.edges.length };
		},
		/** 返回筛选后的交易分页及精确总笔数；分页仅用于明细，不限制完整图。 */
		async transactions(caseId: string, filter: GraphFilter) {
			const parameters = {
				...graphParameters(caseId, filter),
				limit: neo4j.int(Math.min(filter.limit ?? 50, 200)),
				offset: neo4j.int(filter.offset ?? 0),
			};
			const count = await run(
				`MATCH (a:FundsSubject)-[t:TRANSFER]->(b:FundsSubject) WHERE ${transactionWhere} RETURN count(t) AS count`,
				parameters,
			);
			const result = await run(
				`MATCH (a:FundsSubject)-[t:TRANSFER]->(b:FundsSubject) WHERE ${transactionWhere} RETURN a,t,b ORDER BY t.timestamp, t.transactionId SKIP $offset LIMIT $limit`,
				parameters,
			);
			return {
				...graphRows(result),
				total: number(count.records[0]?.get("count") ?? 0),
			};
		},
		/** 有向时间有序关联路径；不做资金归属分配，不宣称路径是同一笔钱。 */
		async trace(
			caseId: string,
			account: string,
			transaction: string,
			depth: number,
			from: string,
			to: string,
		) {
			const hops = Math.max(1, Math.min(4, Math.trunc(depth)));
			const result = await run(
				`MATCH p=(a:FundsSubject {caseId: $caseId})-[:TRANSFER*1..${hops}]->(b:FundsSubject)
    WHERE (a.subjectId = $account OR relationships(p)[0].fromAccount = $account) AND all(t IN relationships(p) WHERE t.caseId = $caseId AND ($from = '' OR t.timestamp >= $from) AND ($to = '' OR t.timestamp <= $to))
    AND ($transaction = '' OR relationships(p)[0].transactionId = $transaction)
    AND all(i IN range(1, size(relationships(p)) - 1) WHERE relationships(p)[i].timestamp >= relationships(p)[i-1].timestamp AND relationships(p)[i].fromAccount = relationships(p)[i-1].toAccount)
    RETURN p LIMIT 201`,
				{
					caseId,
					account,
					transaction,
					from: from ? `${from}T00:00:00+08:00` : "",
					to: to ? `${to}T23:59:59+08:00` : "",
				},
			);
			const nodes = new Map<string, ReturnType<typeof accountProps>>();
			const edges = new Map<string, ReturnType<typeof transferProps>>();
			for (const row of result.records.slice(0, 200))
				for (const segment of row.get("p").segments) {
					for (const node of [segment.start, segment.end]) {
						const item = accountProps(node.properties);
						nodes.set(item.id, item);
					}
					const item = transferProps(segment.relationship.properties);
					edges.set(item.id, item);
				}
			return {
				nodes: [...nodes.values()],
				edges: [...edges.values()],
				truncated: result.records.length > 200,
				paths: Math.min(result.records.length, 200),
			};
		},
	};
}

async function ensureConstraints(driver: Driver) {
	const session = driver.session({ database: "neo4j" });
	try {
		for (const query of [
			"CREATE CONSTRAINT funds_subject IF NOT EXISTS FOR (a:FundsSubject) REQUIRE (a.caseId, a.subjectId) IS UNIQUE",
			"CREATE CONSTRAINT funds_case IF NOT EXISTS FOR (c:FundsCase) REQUIRE c.caseId IS UNIQUE",
			"CREATE CONSTRAINT funds_transaction IF NOT EXISTS FOR ()-[t:TRANSFER]-() REQUIRE (t.caseId, t.transactionId) IS UNIQUE",
		])
			await session.run(query);
	} finally {
		await session.close();
	}
}
function graphRows(result: QueryResult) {
	const nodes = new Map<string, ReturnType<typeof accountProps>>();
	const edges: ReturnType<typeof transferProps>[] = [];
	for (const record of result.records) {
		for (const key of ["a", "b"]) {
			const node = record.get(key);
			if (!node) continue;
			const item = accountProps(node.properties);
			nodes.set(item.id, item);
		}
		const transfer = record.get("t");
		if (transfer) edges.push(transferProps(transfer.properties));
	}
	return { nodes: [...nodes.values()], edges };
}

// 图与分页明细采用同一事实范围，取得对手流水与否只影响资料标记。
const transactionWhere = `t.caseId = $caseId AND a.caseId = $caseId AND b.caseId = $caseId
AND ($account = '' OR ($direction <> 'in' AND (a.subjectId = $account OR t.fromAccount = $account)) OR ($direction <> 'out' AND (b.subjectId = $account OR t.toAccount = $account)))
AND ($counterparty = '' OR a.subjectId = $counterparty OR t.fromAccount = $counterparty OR b.subjectId = $counterparty OR t.toAccount = $counterparty)
AND ($transaction = '' OR t.transactionId = $transaction)
AND ($from = '' OR t.timestamp >= $from) AND ($to = '' OR t.timestamp <= $to)`;

function graphParameters(caseId: string, filter: GraphFilter) {
	return {
		caseId,
		account: filter.account ?? "",
		counterparty: filter.counterparty ?? "",
		transaction: filter.transaction ?? "",
		direction: filter.direction ?? "both",
		from: filter.from ? `${filter.from}T00:00:00+08:00` : "",
		to: filter.to ? `${filter.to}T23:59:59+08:00` : "",
	};
}
export type FundsGraph = ReturnType<typeof createFundsGraph>;
