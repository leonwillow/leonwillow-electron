/**
 * @file 增值税历史导入、手工补月及新旧方案备份恢复弹窗。
 * 创建时间：2026-11-05；修改时间：2026-11-06。
 * 版本作用：共享组件承载读取、预览、确认三步；导入 HTML 只读取文本。
 * 被调用：VatEditor；调用：共享领域解析、Dialog/Tabs/Table/ScrollArea 与 Sonner。
 * 预期结果：确认前不改变方案，冲突整体拒绝；恢复明确替换调整而保留旧历史。
 */
import {
	calculate,
	fields,
	labels,
	mergeHistory,
	normalizeHistoryRow,
	readBackup,
	type VatData,
} from "@leonwillow-electron/calculators";
import {
	gridToHistory,
	parseDelimited,
} from "@leonwillow-electron/calculators/import";
import { Button } from "@leonwillow-electron/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@leonwillow-electron/ui/components/dialog";
import { Input } from "@leonwillow-electron/ui/components/input";
import { Label } from "@leonwillow-electron/ui/components/label";
import { ScrollArea } from "@leonwillow-electron/ui/components/scroll-area";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@leonwillow-electron/ui/components/table";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@leonwillow-electron/ui/components/tabs";
import { Textarea } from "@leonwillow-electron/ui/components/textarea";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { calculatorError } from "@/lib/calculators";

type Preview = {
	data: VatData;
	added: number;
	skipped: number;
	excluded: number;
	issues: number;
	restore: boolean;
};
async function fileText(file: File) {
	if (file.size > 5 * 1024 * 1024) throw Error("文件不能超过5MB");
	const bytes = new Uint8Array(await file.arrayBuffer());
	if (
		(bytes[0] === 0x50 && bytes[1] === 0x4b) ||
		(bytes[0] === 0xd0 && bytes[1] === 0xcf)
	)
		throw Error(
			"二进制 Excel 请另存为 CSV 后导入；税务系统导出的网页 .xls 可直接读取。",
		);
	try {
		return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
	} catch {
		return new TextDecoder("gb18030").decode(bytes);
	}
}
function parseText(text: string) {
	if (text.length > 5 * 1024 * 1024) throw Error("内容不能超过5MB");
	if (/<table[\s>]/i.test(text)) {
		const doc = new DOMParser().parseFromString(text, "text/html");
		return gridToHistory(
			[...doc.querySelectorAll("tr")].map((tr) =>
				[...tr.children]
					.filter((el) => ["TH", "TD"].includes(el.tagName))
					.map((el) => el.textContent?.trim() ?? ""),
			),
		);
	}
	return gridToHistory(parseDelimited(text));
}
export default function ImportDialog({
	data,
	month,
	onClose,
	onApply,
}: {
	data: VatData;
	month?: string;
	onClose: () => void;
	onApply: (data: VatData) => Promise<boolean>;
}) {
	const [tab, setTab] = useState(month ? "manual" : "file");
	const [text, setText] = useState("");
	const [file, setFile] = useState<File | null>(null);
	const [manual, setManual] = useState({
		month: month ?? "",
		x: "",
		i: "",
		t: "",
		tax: "",
		end: "",
	});
	const [preview, setPreview] = useState<Preview | null>(null);
	const [busy, setBusy] = useState(false);
	const generation = useRef(0);
	const invalidate = () => {
		generation.current++;
		setPreview(null);
	};
	const read = async () => {
		const token = ++generation.current;
		setBusy(true);
		setPreview(null);
		try {
			let incoming: VatData;
			let excluded = 0;
			let restore = false;
			if (tab === "manual")
				incoming = {
					history: [normalizeHistoryRow(manual)],
					adjustments: data.adjustments,
					source: "手工录入",
				};
			else {
				if (tab === "file" && !file)
					throw Error("请先选择历史表或方案备份文件");
				const content = tab === "file" && file ? await fileText(file) : text;
				if (/^\s*\{/.test(content)) {
					incoming = readBackup(JSON.parse(content));
					restore = true;
				} else {
					const parsed = parseText(content);
					excluded = parsed.excluded;
					incoming = {
						history: parsed.rows,
						adjustments: data.adjustments,
						source:
							file && tab === "file" ? file.name.slice(0, 200) : "粘贴历史表",
					};
				}
			}
			const merged = mergeHistory(data.history, incoming.history);
			const next = { ...incoming, history: merged.rows };
			const issues = calculate(next.history, next.adjustments).rows.filter(
				(r) => r.status === "gap" || r.status === "error",
			).length;
			if (token === generation.current)
				setPreview({
					data: next,
					added: merged.added,
					skipped: merged.skipped,
					excluded,
					issues,
					restore,
				});
		} catch (error) {
			if (token === generation.current)
				toast.error("无法读取导入内容", {
					description: calculatorError(error),
				});
		} finally {
			setBusy(false);
		}
	};
	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open && !busy) onClose();
			}}
		>
			<DialogContent
				className="vat-import-dialog"
				scrollable
				showCloseButton={!busy}
			>
				<DialogHeader>
					<DialogTitle>导入历史 / 恢复方案</DialogTitle>
					<DialogDescription>
						历史金额保存后只读；同月相同数据跳过，冲突数据不会覆盖。
					</DialogDescription>
				</DialogHeader>
				<Tabs
					value={tab}
					onValueChange={(v) => {
						setTab(String(v));
						invalidate();
					}}
				>
					<TabsList>
						<TabsTrigger value="file">选择文件</TabsTrigger>
						<TabsTrigger value="paste">粘贴表格</TabsTrigger>
						<TabsTrigger value="manual">手工录入</TabsTrigger>
					</TabsList>
					<TabsContent value="file" className="flex flex-col gap-3 pt-3">
						<Label htmlFor="vat-import-file">历史表或方案备份（兼容 V5）</Label>
						<Input
							id="vat-import-file"
							type="file"
							accept=".csv,.tsv,.txt,.xls,.html,.htm,.json"
							disabled={busy}
							onChange={(e) => {
								setFile(e.target.files?.[0] ?? null);
								invalidate();
							}}
						/>
						<p className="text-muted-foreground text-xs">
							支持 CSV、TSV、税务网页 XLS、HTML 和方案 JSON，最大5MB。二进制
							Excel 请先另存为 CSV。
						</p>
					</TabsContent>
					<TabsContent value="paste" className="flex flex-col gap-3 pt-3">
						<Label htmlFor="vat-paste">含标题行的历史数据</Label>
						<ScrollArea
							className="vat-paste-area"
							contentClassName="w-full min-w-0!"
						>
							<Textarea
								id="vat-paste"
								placeholder="月份、销项税额、进项税额、进项税额转出、应纳税额、期末留抵"
								value={text}
								disabled={busy}
								onChange={(e) => {
									setText(e.target.value);
									invalidate();
								}}
							/>
						</ScrollArea>
					</TabsContent>
					<TabsContent
						value="manual"
						className="grid grid-cols-1 gap-3 pt-3 sm:grid-cols-2"
					>
						{(["month", ...fields] as const).map((key) => (
							<div key={key} className="flex flex-col gap-2">
								<Label htmlFor={`vat-history-${key}`}>
									{key === "month" ? "所属月份" : labels[key]}
								</Label>
								<Input
									id={`vat-history-${key}`}
									type={key === "month" ? "month" : "text"}
									inputMode={key === "month" ? undefined : "decimal"}
									placeholder={key === "month" ? "YYYY-MM" : "0.00"}
									value={manual[key]}
									disabled={busy}
									onChange={(e) => {
										setManual({ ...manual, [key]: e.target.value });
										invalidate();
									}}
								/>
							</div>
						))}
					</TabsContent>
				</Tabs>
				<Button variant="outline" disabled={busy} onClick={() => void read()}>
					{busy ? "正在处理…" : "读取并预览"}
				</Button>
				{preview && (
					<div className="flex flex-col gap-3">
						<p role="status" className="text-sm">
							新增 {preview.added} 个月 · 相同记录跳过 {preview.skipped} 条 ·
							排除小规模 {preview.excluded} 条
						</p>
						{preview.issues > 0 && (
							<p className="text-warning-foreground text-xs">
								有 {preview.issues}{" "}
								处缺月或核对问题。历史将原样保留，相应月份计算暂停。
							</p>
						)}
						{preview.restore && (
							<p className="text-sm text-warning-foreground">
								确认后将用备份中的调整替换当前全部调整，额外的历史月份仍会保留。
							</p>
						)}
						<Table containerProps={{ className: "vat-import-preview" }}>
							<TableHeader>
								<TableRow>
									<TableHead>月份</TableHead>
									{fields.map((key) => (
										<TableHead key={key}>{labels[key]}</TableHead>
									))}
								</TableRow>
							</TableHeader>
							<TableBody>
								{preview.data.history.slice(0, 12).map((row) => (
									<TableRow key={row.month}>
										<TableCell>{row.month}</TableCell>
										{fields.map((key) => (
											<TableCell key={key}>{row[key]}</TableCell>
										))}
									</TableRow>
								))}
							</TableBody>
						</Table>
						<p className="text-muted-foreground text-xs">
							合并后共 {preview.data.history.length} 个月，预览前12个月。
						</p>
					</div>
				)}
				<DialogFooter>
					<Button variant="outline" disabled={busy} onClick={onClose}>
						取消
					</Button>
					<Button
						disabled={
							busy || !preview || (!preview.restore && preview.added === 0)
						}
						disabledReason="请先读取并核对新增记录"
						onClick={async () => {
							if (!preview) return;
							setBusy(true);
							try {
								if (await onApply(preview.data)) {
									toast.success(
										preview.restore
											? "方案已恢复并保存"
											: "历史数据已保存并锁定",
									);
									onClose();
								}
							} finally {
								setBusy(false);
							}
						}}
					>
						{preview?.restore ? "确认恢复并保存" : "确认导入并锁定"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
