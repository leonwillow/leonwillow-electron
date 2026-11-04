/**
 * @file 当前人员的常用询问人管理。
 * 创建时间：2026-11-04；修改时间：2026-11-04。
 * 版本作用：沿用 haoji 姓名和检查证号目录，编辑时可直接填入。
 * 被调用：笔录工作区；调用：Eden、共享表格/表单/弹窗。
 * 预期结果：支持新增、修改、删除和搜索，历史笔录中的人员快照不受影响。
 */
import { Button } from "@leonwillow-electron/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
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
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@leonwillow-electron/ui/components/table";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useRef, useState } from "react";
import {
	deleteInquiryInquirer,
	type FrequentInquirer,
	inquiryError,
	listInquiryInquirers,
	saveInquiryInquirer,
} from "@/lib/inquiries";
import { InquiryConfirm, InquiryIconButton, InquiryState } from "./controls";
import { useInquiryResource } from "./use-inquiry-resource";

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
	const [error, setError] = useState("");
	const save = async () => {
		if (lock.current) return;
		lock.current = true;
		setBusy(true);
		setError("");
		try {
			await saveInquiryInquirer({ name, badgeNumber }, row);
			onSaved();
			onClose();
		} catch (cause) {
			setError(inquiryError(cause));
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
						<DialogDescription>
							在笔录中选择姓名后，将自动填入检查证号。
						</DialogDescription>
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
					{error && (
						<p role="alert" className="text-destructive text-sm">
							{error}
						</p>
					)}
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
	const resource = useInquiryResource(listInquiryInquirers);
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
		<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-workspace-gutter">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h2 className="font-semibold text-base">常用询问人</h2>
				<Button onClick={() => setEditing("new")}>
					<PlusIcon data-icon="inline-start" />
					新增询问人
				</Button>
			</div>
			<Input
				className="w-full sm:w-72"
				aria-label="搜索常用询问人"
				placeholder="搜索姓名、检查证号"
				value={search}
				onChange={(e) => setSearch(e.target.value)}
			/>
			<InquiryState
				loading={resource.loading}
				error={resource.error}
				retry={resource.reload}
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
								<InquiryIconButton
									label={`编辑询问人 ${r.name}`}
									onClick={() => setEditing(r)}
								>
									<PencilIcon />
								</InquiryIconButton>
								<InquiryIconButton
									label={`删除询问人 ${r.name}`}
									onClick={() => {
										setError("");
										setRemoving(r);
									}}
								>
									<Trash2Icon />
								</InquiryIconButton>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
			{!resource.loading && !resource.error && !rows.length && (
				<p className="py-8 text-center text-muted-foreground text-sm">
					{search
						? "没有匹配的询问人。"
						: "还没有常用询问人，点击上方按钮新增。"}
				</p>
			)}
			{editing && (
				<InquirerDialog
					row={editing === "new" ? undefined : editing}
					onClose={() => setEditing(null)}
					onSaved={() => void resource.reload()}
				/>
			)}
			<InquiryConfirm
				title="删除常用询问人"
				open={!!removing}
				busy={busy}
				error={error}
				onClose={() => setRemoving(null)}
				onConfirm={() => void remove()}
			>
				从常用名单中移除“{removing?.name}”。已有笔录中的姓名和检查证号会保留。
			</InquiryConfirm>
		</div>
	);
}
