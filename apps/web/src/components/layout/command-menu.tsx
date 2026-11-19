/**
 * @file 页面搜索和快捷导航面板的轻量触发入口。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-11-19
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现，搜索弹窗主体按需懒加载。
 * 被调用：components/layout/app-sidebar.tsx。
 * 调用：ui Button/Tooltip、lucide-react、react、按需加载的 CommandMenuDialog。
 * 功能：维护全局快捷键（Cmd/Ctrl+K 与 /）及侧栏搜索按钮，宽菜单下展示带快捷键提示的横向入口。
 * 预期结果：输入控件内不抢占快捷键，未打开命令面板时不加载 cmdk 与搜索词条字典。
 */
import { Button } from "@leonwillow-electron/ui/components/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@leonwillow-electron/ui/components/tooltip";
import { SearchIcon } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";

const loadCommandMenuDialog = () => import("./command-menu-dialog");
const CommandMenuDialog = lazy(loadCommandMenuDialog);

const isApplePlatform =
	typeof navigator !== "undefined" &&
	/Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);

const CommandMenu = ({ wide = false }: { wide?: boolean }) => {
	const [open, setOpen] = useState(false);
	const [loaded, setLoaded] = useState(false);

	const warmUp = () => {
		void loadCommandMenuDialog();
	};

	useEffect(() => {
		const down = (e: KeyboardEvent) => {
			if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || e.key === "/") {
				if (
					(e.target instanceof HTMLElement && e.target.isContentEditable) ||
					e.target instanceof HTMLInputElement ||
					e.target instanceof HTMLTextAreaElement ||
					e.target instanceof HTMLSelectElement
				) {
					return;
				}

				e.preventDefault();
				setLoaded(true);
				setOpen((current) => !current);
			}
		};

		document.addEventListener("keydown", down);

		return () => document.removeEventListener("keydown", down);
	}, []);

	return (
		<>
			<Tooltip disabled={wide}>
				<TooltipTrigger
					render={
						<Button
							className={
								wide
									? "w-full justify-start gap-2 border-sidebar-border/80 bg-background/60 px-2 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
									: "workspace-nav-item"
							}
							variant={wide ? "outline" : "ghost"}
							size={wide ? "default" : "icon-workspace"}
							aria-label="搜索"
							onPointerEnter={warmUp}
							onFocus={warmUp}
							onClick={() => {
								setLoaded(true);
								setOpen(true);
							}}
						/>
					}
				>
					<SearchIcon aria-hidden="true" />
					{wide && (
						<>
							<span className="min-w-0 flex-1 truncate text-left font-normal">
								搜索
							</span>
							<span
								className="ml-auto flex shrink-0 items-center gap-0.5"
								aria-hidden="true"
							>
								<kbd className="rounded border border-border/80 bg-muted/70 px-1 py-0.5 font-sans text-caption text-muted-foreground leading-none">
									{isApplePlatform ? "⌘" : "Ctrl"}
								</kbd>
								<kbd className="rounded border border-border/80 bg-muted/70 px-1 py-0.5 font-sans text-caption text-muted-foreground leading-none">
									K
								</kbd>
							</span>
						</>
					)}
				</TooltipTrigger>
				<TooltipContent side="right">搜索</TooltipContent>
			</Tooltip>
			{(loaded || open) && (
				<Suspense fallback={null}>
					<CommandMenuDialog open={open} onOpenChange={setOpen} />
				</Suspense>
			)}
		</>
	);
};

export default CommandMenu;
