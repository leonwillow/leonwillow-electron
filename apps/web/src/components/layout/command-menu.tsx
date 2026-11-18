/**
 * @file 页面搜索和快捷导航面板的轻量触发入口。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-11-18
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现，搜索弹窗主体按需懒加载。
 * 被调用：components/layout/app-sidebar.tsx。
 * 调用：ui Button/Tooltip、lucide-react、react、按需加载的 CommandMenuDialog。
 * 功能：维护全局快捷键（Cmd/Ctrl+K 与 /）及侧栏搜索按钮，首次打开时加载命令面板。
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

const CommandMenu = () => {
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
			<Tooltip>
				<TooltipTrigger
					render={
						<Button
							className="workspace-nav-item"
							variant="ghost"
							size="icon-workspace"
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
					<SearchIcon />
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
