/**
 * @file 案件主体自动识别报告及账户归属更正。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-06
 * 版本作用：展示归组依据，支持跨组人工合并、拆分及软撤销。
 * 被调用：review-panel；调用：主体 Eden API 与共享控件。
 * 预期结果：有版本校验且保留调整历史，后台完成后资金图使用新归属。
 */
import { Button } from "@leonwillow-electron/ui/components/button";
import { Checkbox } from "@leonwillow-electron/ui/components/checkbox";
import { Input } from "@leonwillow-electron/ui/components/input";
import { Label } from "@leonwillow-electron/ui/components/label";
import { useCallback, useState } from "react";
import {
	adjustFundsSubjects,
	type FundsCase,
	fundsError,
	getFundsSubjects,
	scanFundsSubjects,
	undoFundsSubjects,
} from "@/lib/funds";
import { useFundsResource } from "./use-funds-resource";

export default function SubjectPanel({
	record,
	onChanged,
}: {
	record: FundsCase;
	onChanged: () => Promise<void>;
}) {
	const resource = useFundsResource(
		useCallback(() => getFundsSubjects(record.id), [record.id]),
	);
	const [search, setSearch] = useState("");
	const [selected, setSelected] = useState<string[]>([]);
	const [name, setName] = useState("");
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");
	const [all, setAll] = useState(false);
	const accounts = new Map(resource.data?.accounts.map((a) => [a.id, a]));
	const groups =
		resource.data?.groups.filter(
			(s) =>
				s.identityStatus !== "unknown" &&
				(all ||
					search ||
					s.accounts.length > 1 ||
					s.identityStatus === "manual") &&
				(!search ||
					[...s.names, ...s.accounts].some((v) => v.includes(search.trim()))),
		) ?? [];
	const run = async (action: () => Promise<{ message: string }>) => {
		setBusy(true);
		setError("");
		setMessage("");
		try {
			const result = await action();
			setMessage(result.message);
			setSelected([]);
			await resource.reload();
			await onChanged();
		} catch (e) {
			setError(fundsError(e));
		} finally {
			setBusy(false);
		}
	};
	const adjust = (action: "merge" | "separate", ids = selected) =>
		void run(() =>
			adjustFundsSubjects(record.id, {
				revision: resource.data?.revision ?? record.revision,
				action,
				accounts: ids,
				name,
			}),
		);
	return (
		<section className="space-y-4" aria-label="主体归属">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="space-y-1">
					<h3 className="font-medium text-sm">账户归属识别</h3>
					<p className="max-w-3xl text-muted-foreground text-xs">
						证件一致优先；完整户名相同自动归组并标为推断。归属有误时可更正，原始账户及交易仍保留。
					</p>
				</div>
				<Button
					variant="outline"
					disabled={busy}
					onClick={() => void run(() => scanFundsSubjects(record.id))}
				>
					重新识别主体
				</Button>
			</div>
			{resource.data && (
				<p className="text-sm">
					{resource.data.summary.mergedGroups} 个多账户主体 ·{" "}
					{resource.data.summary.inferredGroups} 个按户名推断 ·{" "}
					{resource.data.summary.conflicts} 个因资料缺失或冲突保持独立
				</p>
			)}
			<div className="flex flex-wrap items-center gap-3">
				<Input
					className="max-w-sm"
					aria-label="搜索主体归属"
					placeholder="搜索户名或账号"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
				/>
				<Label>
					<Checkbox checked={all} onCheckedChange={(v) => setAll(!!v)} />
					包含单账户主体
				</Label>
			</div>
			{selected.length > 0 && (
				<div className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
					<span className="text-sm">已选 {selected.length} 个账户</span>
					<Input
						className="max-w-56"
						aria-label="合并后主体名称"
						placeholder="合并后名称（可选）"
						value={name}
						onChange={(e) => setName(e.target.value)}
					/>
					<Button
						disabled={busy || selected.length < 2}
						onClick={() => adjust("merge")}
					>
						合并所选账户
					</Button>
					<Button
						variant="outline"
						disabled={busy || selected.length < 2}
						onClick={() => adjust("separate")}
					>
						分别独立
					</Button>
					<Button
						variant="ghost"
						disabled={busy}
						onClick={() => setSelected([])}
					>
						清空选择
					</Button>
				</div>
			)}
			{message && (
				<p role="status" className="text-sm">
					{message}可在“文件与导入”的后台处理记录查看进度。
				</p>
			)}
			{(error || resource.error) && (
				<div role="alert" className="space-y-2 text-destructive text-sm">
					<p>{error || resource.error}</p>
					<Button variant="outline" onClick={() => void resource.reload()}>
						刷新归属资料
					</Button>
				</div>
			)}
			{resource.loading ? (
				<p role="status" className="text-muted-foreground text-sm">
					正在读取主体归属…
				</p>
			) : (
				<div className="divide-y rounded-lg border">
					{groups.slice(0, 100).map((group) => (
						<details key={group.id} className="p-4">
							<summary className="cursor-pointer text-sm">
								<span className="font-medium">
									{group.names.join(" / ") || "户名待核"}
								</span>
								<span className="ml-3 text-muted-foreground">
									{group.accounts.length} 个账户 ·{" "}
									{group.identityStatus === "name-inferred"
										? "户名推断"
										: group.identityStatus === "documented"
											? "证件一致"
											: group.identityStatus === "manual"
												? "人工调整"
												: "保持独立"}
								</span>
							</summary>
							<div className="mt-3 space-y-3">
								<p className="text-muted-foreground text-xs">{group.basis}</p>
								{group.accounts.map((id) => {
									const account = accounts.get(id);
									return (
										<Label
											key={id}
											className="flex items-start gap-3 break-all"
										>
											<Checkbox
												checked={selected.includes(id)}
												disabled={busy}
												onCheckedChange={(v) =>
													setSelected((old) =>
														v ? [...old, id] : old.filter((a) => a !== id),
													)
												}
												aria-label={`选择账户 ${account?.number ?? id}`}
											/>
											<span>
												{account?.number ?? id} ·{" "}
												{(account?.ownNames.length
													? account.ownNames
													: account?.names
												)?.join(" / ")}
												<span className="ml-2 text-muted-foreground">
													{account?.hasStatement ? "已有流水" : "仅见对手"}
												</span>
											</span>
										</Label>
									);
								})}
								{group.accounts.length > 1 && (
									<Button
										variant="outline"
										disabled={busy}
										onClick={() => adjust("separate", group.accounts)}
									>
										将本组账户分别独立
									</Button>
								)}
							</div>
						</details>
					))}
					{!groups.length && (
						<p className="p-6 text-muted-foreground text-sm">
							当前范围没有主体归组；可搜索户名或包含单账户主体。
						</p>
					)}
				</div>
			)}
			{groups.length > 100 && (
				<p className="text-muted-foreground text-xs">
					显示前 100 组，请搜索定位其余主体。
				</p>
			)}
			{!!resource.data?.overrides.length && (
				<details>
					<summary className="cursor-pointer text-sm">人工调整记录</summary>
					<ul className="mt-3 space-y-2">
						{resource.data.overrides.toReversed().map((item) => (
							<li
								key={item.id}
								className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-xs"
							>
								<div>
									<p>
										{item.action === "merge" ? "合并" : "拆分"}{" "}
										{item.accounts.length} 个账户
										{item.name ? ` · ${item.name}` : ""}
									</p>
									<p className="mt-1 text-muted-foreground">
										{new Date(item.at).toLocaleString("zh-CN")} ·{" "}
										{item.deletedAt ? "已撤销，历史保留" : "生效中"}
									</p>
								</div>
								{!item.deletedAt && (
									<Button
										variant="ghost"
										disabled={busy}
										onClick={() =>
											void run(() =>
												undoFundsSubjects(
													record.id,
													item.id,
													resource.data?.revision ?? record.revision,
												),
											)
										}
									>
										撤销此调整
									</Button>
								)}
							</li>
						))}
					</ul>
				</details>
			)}
		</section>
	);
}
