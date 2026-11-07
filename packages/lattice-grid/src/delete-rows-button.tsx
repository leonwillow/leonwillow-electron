/**
 * @file 表格所选行的删除确认入口。
 * 创建时间：2026-11-07；修改时间：2026-11-07。
 * 版本作用：固定待删行 ID，确认后通过原有原子事务和历史记录删除。
 * 被调用：DataGrid；调用：GridView、共享 Dialog/Button、Sonner。
 * 预期结果：取消不改数据，待提交编辑先校验，异步失败保留确认框与原行。
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
import { Trash2Icon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import type { GridView } from "./view-controller";

export function DeleteRowsButton<T>({
	view,
	disabled,
}: {
	view: GridView<T>;
	disabled: boolean;
}) {
	const [ids, setIds] = useState<readonly string[] | null>(null);
	const [busy, setBusy] = useState(false);
	const locked = useRef(false);
	const revision = useRef(0);
	const open = async () => {
		if (disabled || locked.current) return;
		locked.current = true;
		try {
			if (!(await view.commitEdit())) return;
			const snapshot = view.store.getSnapshot();
			const selected = new Set(snapshot.state.selectedRows);
			const getRowId = view.store.getOptions().getRowId;
			const targets = snapshot.rows
				.map(getRowId)
				.filter((id) => selected.has(id));
			if (targets.length) {
				revision.current = snapshot.externalRevision;
				setIds(targets);
			}
		} finally {
			locked.current = false;
		}
	};
	const confirm = async () => {
		if (!ids || disabled || locked.current) return;
		if (revision.current !== view.store.getSnapshot().externalRevision) {
			setIds(null);
			toast.error("表格数据已变化，请重新勾选要删除的行");
			return;
		}
		locked.current = true;
		setBusy(true);
		try {
			if ((await view.store.deleteRows(ids)).ok) setIds(null);
		} finally {
			locked.current = false;
			setBusy(false);
		}
	};
	return (
		<>
			<Button
				variant="destructive"
				size="sm"
				data-lg-edit-scope={view.options.id}
				disabled={disabled || busy}
				disabledReason="当前表格不可编辑或正在提交"
				onClick={() => void open()}
			>
				<Trash2Icon data-icon="inline-start" />
				{view.messages().delete}
			</Button>
			<Dialog
				open={ids !== null}
				onOpenChange={(open) => {
					if (!open && !locked.current) setIds(null);
				}}
			>
				<DialogContent
					finalFocus={() => {
						view.focusGrid();
						return false;
					}}
				>
					<DialogHeader>
						<DialogTitle>删除所选的 {ids?.length ?? 0} 行？</DialogTitle>
						<DialogDescription>
							所选行及其内容将从表格中移除。
							{(view.store.getOptions().historyLimit ?? 50) > 0 &&
								"可在当前表格使用“撤销”恢复。"}
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							disabled={busy}
							onClick={() => setIds(null)}
						>
							取消
						</Button>
						<Button
							variant="destructive"
							disabled={disabled || busy}
							onClick={() => void confirm()}
						>
							{busy ? "正在删除…" : "确认删除"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
