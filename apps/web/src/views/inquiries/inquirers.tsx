/**
 * @file 当前人员的常用询问人管理。
 * 创建时间：2026-11-04；修改时间：2026-11-19。
 * 版本作用：沿用 haoji 姓名和检查证号目录，编辑时可直接填入。
 * 被调用：笔录工作区；调用：Eden、Sonner、共享表格/表单/搜索/弹窗。
 * 预期结果：支持新增、修改、删除和搜索，历史笔录中的人员快照不受影响。
 */

import { Button } from "@leonwillow-electron/ui/components/button";
import { ConfirmDialog } from "@leonwillow-electron/ui/components/confirm-dialog";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@leonwillow-electron/ui/components/dialog";
import {
	Field,
	FieldGroup,
	FieldLabel,
} from "@leonwillow-electron/ui/components/field";
import { Input } from "@leonwillow-electron/ui/components/input";
import { ScrollArea } from "@leonwillow-electron/ui/components/scroll-area";
import { SearchInput } from "@leonwillow-electron/ui/components/search-input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@leonwillow-electron/ui/components/table";
import { TooltipIconButton } from "@leonwillow-electron/ui/components/tooltip-icon-button";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { AsyncStatusBlock } from "@/components/layout/async-state";
import { useAsyncResource } from "@/hooks/use-async-resource";
import {
	deleteInquiryInquirer,
	type FrequentInquirer,
	inquiryError,
	listInquiryInquirers,
	saveInquiryInquirer,
} from "@/lib/inquiries";

function InquirerDialog({
	row,
	onClose,
	onSaved,
}: {
	row?: FrequentInquirer;
	onClose: () => void;
	onSaved: () => void;
}) {
	const [name, setName] = useState(row?.name ?? "");
	const [badgeNumber, setBadgeNumber] = useState(row?.badgeNumber ?? "");
	const [busy, setBusy] = useState(false);
	const lock = useRef(false);
	const save = async () => {
		if (lock.current) return;
		lock.current = true;
		setBusy(true);
		try {
			await saveInquiryInquirer({ name, badgeNumber }, row);
			onSaved();
			onClose();
		} catch (cause) {
			toast.error(inquiryError(cause));
		} finally {
			lock.current = false;
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
			<DialogContent>
				<form
					className="flex flex-col gap-5"
					onSubmit={(e) => {
						e.preventDefault();
						void save();
					}}
				>
					<DialogHeader>
						<DialogTitle>
							{row ? "编辑常用询问人" : "新增常用询问人"}
						</DialogTitle>
					</DialogHeader>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="inquirer-name">姓名</FieldLabel>
							<Input
								id="inquirer-name"
								autoFocus
								required
								maxLength={80}
								value={name}
								onChange={(e) => setName(e.target.value)}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="inquirer-badge">检查证号</FieldLabel>
							<Input
								id="inquirer-badge"
								required
								maxLength={80}
								value={badgeNumber}
								onChange={(e) => setBadgeNumber(e.target.value)}
							/>
						</Field>
					</FieldGroup>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							disabled={busy}
							onClick={onClose}
						>
							取消
						</Button>
						<Button
							type="submit"
							disabled={busy || !name.trim() || !badgeNumber.trim()}
						>
							{busy ? "正在保存…" : "保存"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
export default function InquiryInquirers() {
	const resource = useAsyncResource(listInquiryInquirers, {
		fallbackError: "无法连接笔录服务，请稍后重试。",
		keepPreviousOnReload: true,
	});
	const [search, setSearch] = useState("");
	const [editing, setEditing] = useState<FrequentInquirer | "new" | null>(null);
	const [removing, setRemoving] = useState<FrequentInquirer | null>(null);
	const [busy, setBusy] = useState(false);
	const lock = useRef(false);
	const [error, setError] = useState("");
	const rows = (resource.data ?? []).filter((r) =>
		`${r.name} ${r.badgeNumber}`.includes(search.trim()),
	);
	const remove = async () => {
		if (lock.current || !removing) return;
		lock.current = true;
		setBusy(true);
		setError("");
		try {
			await deleteInquiryInquirer(removing);
			setRemoving(null);
			await resource.reload();
		} catch (cause) {
			setError(inquiryError(cause));
		} finally {
			lock.current = false;
			setBusy(false);
		}
	};
	return (
		<ScrollArea
			className="min-h-0 flex-1"
			contentClassName="flex flex-col gap-4 p-workspace-gutter"
		>
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h2 className="font-semibold text-base">常用询问人</h2>
				<Button onClick={() => setEditing("new")}>
					<PlusIcon data-icon="inline-start" />
					新增询问人
				</Button>
			</div>
			<SearchInput
				className="w-full sm:w-72"
				aria-label="搜索常用询问人"
				placeholder="搜索姓名、检查证号"
				value={search}
				onValueChange={setSearch}
			/>
			<AsyncStatusBlock
				compact
				loading={resource.loading}
				error={resource.error}
				onRetry={resource.reload}
			/>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>姓名</TableHead>
						<TableHead>检查证号</TableHead>
						<TableHead>操作</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{rows.map((r) => (
						<TableRow key={r.id}>
							<TableCell>{r.name}</TableCell>
							<TableCell>{r.badgeNumber}</TableCell>
							<TableCell>
								<TooltipIconButton
									label={`编辑询问人 ${r.name}`}
									variant="info"
									onClick={() => setEditing(r)}
								>
									<PencilIcon />
								</TooltipIconButton>
								<TooltipIconButton
									label={`删除询问人 ${r.name}`}
									variant="destructive"
									onClick={() => {
										setError("");
										setRemoving(r);
									}}
								>
									<Trash2Icon />
								</TooltipIconButton>
							</TableCell>
						</TableRow>
					))}
					{!resource.loading && !resource.error && !rows.length && (
						<TableRow>
							<TableCell
								colSpan={3}
								className="py-8 text-center text-muted-foreground"
							>
								{search
									? "没有匹配的询问人。"
									: "还没有常用询问人，点击上方按钮新增。"}
							</TableCell>
						</TableRow>
					)}
				</TableBody>
			</Table>
			{editing && (
				<InquirerDialog
					row={editing === "new" ? undefined : editing}
					onClose={() => setEditing(null)}
					onSaved={() => void resource.reload()}
				/>
			)}
			<ConfirmDialog
				title="删除常用询问人"
				open={!!removing}
				busy={busy}
				busyLabel="正在处理…"
				error={error}
				onClose={() => setRemoving(null)}
				onConfirm={() => void remove()}
			>
				从常用名单中移除“{removing?.name}”。已有笔录中的姓名和检查证号会保留。
			</ConfirmDialog>
		</ScrollArea>
	);
}
