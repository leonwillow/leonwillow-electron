/**
 * @file 用户授权测试资料的标准化输出准备。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-07
 * 版本作用：生成可核对的中间表，供文档工具导出 CSV/Excel。
 * 被调用：bun src/prepare-funds-delivery.ts <源目录> <中间 JSON 路径>。
 * 调用：文件系统、与正式导入一致的 parser/reconcile/export。
 * 预期结果：处理已符合出入方向契约的文件；原始银行表须先 AI 标准化，不猜测方向。
 */
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import {
	decimalAmount,
	standardFields,
	standardHeaders,
	standardRows,
	templateHeaders,
} from "./modules/funds/export";
import { parseStatement } from "./modules/funds/parser";
import { reconcile } from "./modules/funds/reconcile";

const [directory, output] = process.argv.slice(2);
if (!directory || !output) throw new Error("需要源目录和中间 JSON 输出路径");
const sources = await Promise.all(
	(await readdir(directory))
		.filter((name) => /\.(xlsx|xls|csv|tsv)$/i.test(name))
		.sort()
		.map(async (name) =>
			parseStatement(
				name,
				new Uint8Array(await Bun.file(join(directory, name)).arrayBuffer()),
			),
		),
);
const snapshot = reconcile(sources);
const accountNames = new Map(
	snapshot.accounts.map((a) => [
		a.id,
		a.ownNames.join(" / ") || a.names[0] || "",
	]),
);
const observationSources = new Map(
	sources.flatMap((s) =>
		s.observations.map(
			(o) => [o.id, `${s.name}｜${o.sheet}｜${o.row}`] as const,
		),
	),
);
const txs = new Map(snapshot.transactions.map((t) => [t.id, t]));
const reasonRows = (kind: string) =>
	snapshot.issues
		.filter((i) => i.kind === kind)
		.map((i) => {
			const source = sources.find((s) => s.id === i.sourceId);
			const raw =
				source?.rows.find((r) => r.sheet === i.sheet && r.row === i.row)
					?.fields ?? {};
			return [
				source?.name ?? "",
				i.sheet,
				i.row,
				i.message,
				raw.本方账号 || raw.账号 || raw["查询涉及账（卡）号"] || "",
				raw.本方户名 || raw.客户名称 || "",
				raw.出入方向 || raw.借贷方向 || raw.借贷标志 || "",
				raw.交易金额 || "",
				raw.交易日期 || "",
				raw.交易时间 || "",
				raw.摘要 || raw.交易摘要 || "",
				i.sourceId,
			];
		});
const reasonHeaders = [
	"来源文件",
	"工作表",
	"行号",
	"处理原因",
	"本方账号原文",
	"户名原文",
	"方向原文",
	"金额原文",
	"日期原文",
	"时间原文",
	"摘要原文",
	"文件SHA256",
];
const canonicalHeaders = [
	"规范交易ID",
	"交易时间",
	"付款账号",
	"付款户名",
	"收款账号",
	"收款户名",
	"交易金额",
	"摘要",
	"核对状态",
	"来源证据数",
	"来源定位",
];
const canonicalRows = snapshot.transactions.map((t) => [
	t.id,
	t.timestamp.slice(0, 19).replace("T", " "),
	t.from.startsWith("unknown:") ? "" : t.from,
	accountNames.get(t.from) ?? "",
	t.to.startsWith("unknown:") ? "" : t.to,
	accountNames.get(t.to) ?? "",
	decimalAmount(t.amountMinor),
	t.summary,
	t.reconciliation === "mirror"
		? "双边一致"
		: t.reconciliation === "reviewed"
			? "人工核对"
			: "单边记录",
	t.evidenceIds.length,
	t.evidenceIds.map((id) => observationSources.get(id)).join("；"),
]);
const fileHeaders = [
	"来源文件",
	"编码",
	"原始数据行",
	"标准流水行",
	"查询反馈行",
	"开户资料行",
	"待核行",
	"文件SHA256",
];
const fileRows = sources.map((s) => [
	s.name,
	s.encoding,
	s.rows.length,
	s.observations.length,
	s.feedbackCount,
	s.auxiliaryCount,
	s.issues.filter((i) => i.kind === "quarantine").length,
	s.sha256,
]);
const candidateHeaders = [
	"配对候选ID",
	"付款账号",
	"收款账号",
	"交易金额",
	"时间差（秒）",
	"付款侧规范交易ID",
	"收款侧规范交易ID",
	"付款侧来源",
	"收款侧来源",
];
const candidateRows = snapshot.candidates.map((c) => [
	c.id,
	c.from,
	c.to,
	decimalAmount(c.amountMinor),
	c.seconds,
	c.left,
	c.right,
	(txs.get(c.left)?.evidenceIds ?? [])
		.map((id) => observationSources.get(id))
		.join("；"),
	(txs.get(c.right)?.evidenceIds ?? [])
		.map((id) => observationSources.get(id))
		.join("；"),
]);
await Bun.write(
	output,
	JSON.stringify({
		totals: snapshot.totals,
		fields: standardFields,
		templateHeaders,
		files: sources.map((s, index) => ({
			name: `${String(index + 1).padStart(2, "0")}_${s.name.replace(/\.[^.]+$/, "")}.csv`,
			headers: standardHeaders,
			rows: standardRows(s),
		})),
		sheets: [
			{
				name: "文件核对",
				headers: fileHeaders,
				rows: fileRows,
				numeric: [2, 3, 4, 5, 6],
			},
			{
				name: "标准流水",
				headers: standardHeaders,
				rows: sources.flatMap(standardRows),
				numeric: [6, 7],
				money: [6, 7],
			},
			{
				name: "唯一交易",
				headers: canonicalHeaders,
				rows: canonicalRows,
				numeric: [6, 9],
				money: [6],
			},
			{
				name: "配对候选",
				headers: candidateHeaders,
				rows: candidateRows,
				numeric: [3, 4],
				money: [3],
			},
			{
				name: "待核记录",
				headers: reasonHeaders,
				rows: reasonRows("quarantine"),
				numeric: [2],
			},
			{
				name: "查询反馈",
				headers: reasonHeaders,
				rows: reasonRows("feedback"),
				numeric: [2],
			},
			{
				name: "字段说明",
				headers: ["标准字段", "保留层级", "含义和规则"],
				rows: standardFields,
				numeric: [],
			},
		],
	}),
);
console.info(JSON.stringify(snapshot.totals));
