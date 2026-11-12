/**
 * @file Electron 登录页的服务器连接设置。
 * 创建时间：2026-11-10；修改时间：2026-11-10。
 * 版本作用：复用现有 Dialog/Field/Input，仅通过 preload 的配置接口访问桌面设置。
 * 被调用：LoginForm；调用：desktop-bridge、lib/desktop、共享 UI 和 Sonner。
 * 功能：读取当前地址、修改地址与端口、无凭据测试、恢复默认及保存后重新登录。
 * 预期结果：测试和取消不修改当前连接；过期异步结果不覆盖新表单，保存期间不能重复提交。
 */
import {
	type ConnectionInput,
	type ConnectionStatus,
	connectionInput,
	normalizeConnection,
} from "@leonwillow-electron/desktop-bridge";
import { Button } from "@leonwillow-electron/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@leonwillow-electron/ui/components/dialog";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@leonwillow-electron/ui/components/field";
import { Input } from "@leonwillow-electron/ui/components/input";
import { ServerCogIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getDesktopBridge, restartDesktopLogin } from "@/lib/desktop";

type Operation = "load" | "test" | "save" | null;

export default function ServerConnectionSettings({
	disabled,
	open,
	onOpenChange,
}: {
	disabled: boolean;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const bridge = getDesktopBridge();
	const [status, setStatus] = useState<ConnectionStatus | null>(null);
	const [draft, setDraft] = useState<ConnectionInput>({
		address: "",
		port: "",
	});
	const [useDefault, setUseDefault] = useState(true);
	const [operation, setOperation] = useState<Operation>(null);
	const [loadFailed, setLoadFailed] = useState(false);
	const requestVersion = useRef(0);
	const operationRef = useRef<Operation>(null);

	const loadStatus = useCallback(async () => {
		if (!bridge) return;
		const version = ++requestVersion.current;
		operationRef.current = "load";
		setOperation("load");
		setLoadFailed(false);
		try {
			const next = await bridge.getConnection();
			if (version !== requestVersion.current) return;
			setStatus(next);
			setDraft(connectionInput(next.effectiveUrl));
			setUseDefault(next.customUrl === null);
			if (next.warning) toast.warning(next.warning);
		} catch {
			if (version !== requestVersion.current) return;
			setLoadFailed(true);
			toast.error("无法读取服务器设置，请重试。");
		} finally {
			if (version === requestVersion.current) {
				operationRef.current = null;
				setOperation(null);
			}
		}
	}, [bridge]);

	useEffect(() => {
		void loadStatus();
		return () => {
			requestVersion.current++;
		};
	}, [loadStatus]);

	if (!bridge) return null;

	const changeOpen = (next: boolean) => {
		if (operationRef.current === "save" || (next && disabled)) return;
		// 关闭窗口不取消只读加载，页面上的当前地址仍需等它完成；重开会创建新版本。
		if (!next && operationRef.current === "load") {
			onOpenChange(false);
			return;
		}
		requestVersion.current++;
		operationRef.current = null;
		setOperation(null);
		onOpenChange(next);
		if (next) void loadStatus();
	};

	const run = async (action: "test" | "save") => {
		if (disabled || operationRef.current || !status || loadFailed) return;
		const input = useDefault ? null : draft;
		try {
			if (input) normalizeConnection(input);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "请检查服务器地址和端口。",
			);
			return;
		}
		const version = ++requestVersion.current;
		operationRef.current = action;
		setOperation(action);
		let reloading = false;
		try {
			if (action === "test") {
				const result = await bridge.testConnection(input);
				if (version !== requestVersion.current) return;
				if (result.ok) toast.success(result.message);
				else toast.error(result.message);
			} else {
				await bridge.saveConnection(input);
				restartDesktopLogin();
				// 新文档加载完成前保持互斥，不能用旧登录表单向刚切换的服务器提交。
				reloading = true;
			}
		} catch {
			if (version !== requestVersion.current) return;
			toast.error(
				action === "test"
					? "连接测试失败，请检查地址、端口和网络。"
					: "服务器设置未能保存，请重试。",
			);
		} finally {
			if (!reloading && version === requestVersion.current) {
				operationRef.current = null;
				setOperation(null);
			}
		}
	};

	const busy = operation !== null || disabled;
	return (
		<Dialog open={open} onOpenChange={changeOpen}>
			<div className="flex min-w-0 items-center gap-3">
				<DialogTrigger
					render={
						<Button
							type="button"
							variant="ghost"
							size="sm"
							disabled={disabled}
						/>
					}
				>
					<ServerCogIcon data-icon="inline-start" />
					服务器设置
				</DialogTrigger>
				<p
					className="min-w-0 flex-1 break-all text-muted-foreground text-xs"
					aria-live="polite"
				>
					{status
						? status.effectiveUrl
						: loadFailed
							? "连接设置读取失败"
							: "正在读取服务器…"}
				</p>
			</div>
			<DialogContent
				scrollable
				className="desktop-connection-dialog"
				showCloseButton={operation !== "save"}
			>
				<DialogHeader>
					<DialogTitle>服务器设置</DialogTitle>
					<DialogDescription>
						设置此设备连接的后端服务器。保存后重新登录；取消则保持当前连接。
					</DialogDescription>
				</DialogHeader>
				{!status || loadFailed ? (
					<div className="flex flex-col items-start gap-3">
						<p role="status">
							{operation === "load"
								? "正在读取服务器设置…"
								: "暂时无法读取服务器设置。"}
						</p>
						<Button
							type="button"
							variant="outline"
							disabled={operation === "load"}
							onClick={() => void loadStatus()}
						>
							重新读取
						</Button>
					</div>
				) : (
					<form
						className="flex flex-col gap-4"
						onSubmit={(event) => {
							event.preventDefault();
							void run("save");
						}}
					>
						<FieldGroup>
							<Field>
								<FieldLabel htmlFor="desktop-server-address">
									服务器地址
								</FieldLabel>
								<Input
									id="desktop-server-address"
									autoComplete="off"
									autoCapitalize="none"
									spellCheck={false}
									placeholder="https://api.example.com"
									value={draft.address}
									disabled={busy}
									onChange={(event) => {
										setDraft({ ...draft, address: event.target.value });
										setUseDefault(false);
									}}
								/>
								<FieldDescription>
									填写协议及域名或 IP 地址，不包含 /api 路径。
								</FieldDescription>
							</Field>
							<Field>
								<FieldLabel htmlFor="desktop-server-port">
									端口（选填）
								</FieldLabel>
								<Input
									id="desktop-server-port"
									inputMode="numeric"
									autoComplete="off"
									placeholder="HTTP 80 / HTTPS 443"
									value={draft.port}
									disabled={busy}
									onChange={(event) => {
										setDraft({ ...draft, port: event.target.value });
										setUseDefault(false);
									}}
								/>
								<FieldDescription>
									留空沿用地址中的端口；地址未含端口时使用协议默认值。
								</FieldDescription>
							</Field>
						</FieldGroup>
						<p className="break-all text-muted-foreground text-xs">
							默认服务器：{status.defaultUrl}
							{useDefault
								? status.customUrl === null
									? "（当前使用默认配置）"
									: "（保存后恢复默认配置）"
								: ""}
						</p>
						<div className="flex flex-wrap items-center gap-2">
							<Button
								type="button"
								variant="outline"
								disabled={busy}
								onClick={() => void run("test")}
							>
								{operation === "test" ? "正在测试…" : "测试连接"}
							</Button>
							<Button
								type="button"
								variant="ghost"
								disabled={busy}
								onClick={() => {
									setDraft(connectionInput(status.defaultUrl));
									setUseDefault(true);
								}}
							>
								恢复默认
							</Button>
						</div>
						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								disabled={operation === "save"}
								onClick={() => changeOpen(false)}
							>
								取消
							</Button>
							<Button type="submit" disabled={busy}>
								{operation === "save" ? "正在保存…" : "保存并应用"}
							</Button>
						</DialogFooter>
					</form>
				)}
			</DialogContent>
		</Dialog>
	);
}
