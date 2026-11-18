/**
 * @file 案件菜单的新增案件对话框。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-06
 * 版本作用：复用既有案件创建表单，与浮动菜单开关独立。
 * 被调用：FundsCaseSidebar；调用：共享表单、Eden、TanStack Router。
 * 预期结果：创建成功进入此案的导入页；失败保留名称和重试入口。
 */
import { Button } from "@leonwillow-electron/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@leonwillow-electron/ui/components/dialog";
import {
	Field,
	FieldGroup,
	FieldLabel,
} from "@leonwillow-electron/ui/components/field";
import { Input } from "@leonwillow-electron/ui/components/input";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useId, useState } from "react";
import { createFundsCase, fundsError } from "@/lib/funds";

export default function CreateCaseDialog({
	open,
	onOpenChange,
	onCreated,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCreated: () => void;
}) {
	const [name, setName] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const fieldId = useId();
	const router = useRouter();
	const navigate = useNavigate();
	const create = async () => {
		if (!name.trim() || busy) return;
		setBusy(true);
		setError("");
		try {
			const record = await createFundsCase(name);
			onCreated();
			onOpenChange(false);
			setName("");
			await router.invalidate();
			await navigate({ to: "/funds/cases", search: { caseId: record.id } });
		} catch (e) {
			setError(fundsError(e));
		} finally {
			setBusy(false);
		}
	};
	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!busy) {
					onOpenChange(next);
					if (!next) setError("");
				}
			}}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>新增案件</DialogTitle>
					<DialogDescription>
						同一案件的银行流水放在一起，后续可继续补充。
					</DialogDescription>
				</DialogHeader>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						void create();
					}}
				>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor={fieldId}>案件名称</FieldLabel>
							<Input
								id={fieldId}
								value={name}
								disabled={busy}
								required
								maxLength={100}
								onChange={(event) => setName(event.target.value)}
								placeholder="输入便于识别的案件名称"
							/>
						</Field>
						{error && (
							<p role="alert" className="text-destructive text-sm">
								{error}
							</p>
						)}
						<Button type="submit" disabled={!name.trim() || busy}>
							{busy ? "正在创建…" : "创建案件"}
						</Button>
					</FieldGroup>
				</form>
			</DialogContent>
		</Dialog>
	);
}
