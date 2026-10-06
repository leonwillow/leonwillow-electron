/**
 * @file 页面搜索和快捷导航面板。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-06
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：components/layout/app-sidebar.tsx。
 * 调用：ui 基础组件/样式、@tanstack/react-router、lucide-react、react、assets/data/search。
 * 功能：处理打开快捷键、分组检索及选择后的路由跳转。
 * 预期结果：输入控件内不抢占快捷键，执行命令后关闭面板。
 */

import { canAccessPath } from "@leonwillow-electron/access";
import { Button } from "@leonwillow-electron/ui/components/button";
import {
	Command,
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from "@leonwillow-electron/ui/components/command";
import { getRouteApi, useNavigate, useSearch } from "@tanstack/react-router";
import { SearchIcon } from "lucide-react";
import { Fragment, useCallback, useEffect, useState } from "react";

import { searchData } from "@/assets/data/search";

const CommandMenu = () => {
	const { user, moduleIds } = getRouteApi("/_workspace").useRouteContext();
	const groups = searchData
		.map((group) => ({
			...group,
			data: group.data.filter((item) =>
				canAccessPath({ role: user.role, moduleIds }, item.href),
			),
		}))
		.filter((group) => group.data.length);
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");

	const navigate = useNavigate();
	const { caseId } = useSearch({ strict: false });

	const runCommand = useCallback((command: () => unknown) => {
		setOpen(false);
		command();
	}, []);

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
				setOpen((open) => !open);
			}
		};

		document.addEventListener("keydown", down);

		return () => document.removeEventListener("keydown", down);
	}, []);

	return (
		<>
			<Button
				className="hover:bg-primary/10 hover:text-primary"
				variant="ghost"
				size="icon-lg"
				aria-label="搜索"
				onClick={() => setOpen(true)}
			>
				<SearchIcon />
			</Button>
			<CommandDialog
				title="命令面板"
				description="搜索并跳转到工作区页面。"
				open={open}
				onOpenChange={setOpen}
			>
				<Command
					className="**:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
					filter={(value, search, keywords) => {
						const query = search.toLowerCase();
						const name = value.toLowerCase();

						if (name === query) return 2;

						if (name.includes(query)) return 1.5;

						if (keywords && keywords.length > 0) {
							if (keywords.some((keyword) => keyword.toLowerCase() === query))
								return 1.25;

							const extendedValue = `${name} ${keywords.join(" ").toLowerCase()}`;

							if (extendedValue.includes(query)) return 1;
						}

						return 0;
					}}
				>
					<CommandInput
						aria-label="搜索命令"
						placeholder="输入命令或搜索…"
						value={search}
						onValueChange={setSearch}
					/>
					<CommandList label="搜索结果">
						<CommandEmpty>没有找到结果。</CommandEmpty>
						{search ? (
							groups.map((searchGroup, index) => (
								<Fragment key={searchGroup.title}>
									<CommandGroup heading={searchGroup.title}>
										{searchGroup.data.map((item) => (
											<CommandItem
												key={item.href}
												value={item.name}
												keywords={item.tags}
												onSelect={() =>
													runCommand(() =>
														navigate({
															to: item.href,
															search:
																item.href === "/funds" ||
																item.href === "/funds/cases"
																	? { caseId }
																	: undefined,
														}),
													)
												}
											>
												<item.icon />
												<span>{item.name}</span>
											</CommandItem>
										))}
									</CommandGroup>
									{index !== groups.length - 1 && <CommandSeparator />}
								</Fragment>
							))
						) : (
							<CommandGroup heading="建议">
								{groups
									.flatMap((group) => group.data)
									.slice(0, 4)
									.map((item) => (
										<CommandItem
											key={item.href}
											onSelect={() =>
												runCommand(() =>
													navigate({
														to: item.href,
														search:
															item.href === "/funds" ||
															item.href === "/funds/cases"
																? { caseId }
																: undefined,
													}),
												)
											}
										>
											<item.icon />
											<span>{item.name}</span>
										</CommandItem>
									))}
							</CommandGroup>
						)}
					</CommandList>
				</Command>
			</CommandDialog>
		</>
	);
};

export default CommandMenu;
