/**
 * @file 命令搜索与页面快捷跳转的按需弹窗主体。
 * 创建时间：2026-11-18
 * 修改时间：2026-11-20
 * 版本作用：将 cmdk 搜索组件与导航词条数据从工作台首屏包拆出，打开时按需加载。
 * 被调用：components/layout/command-menu.tsx。
 * 调用：ui Command 组件、@leonwillow-electron/access、@tanstack/react-router、assets/data/search。
 * 功能：按当前用户权限过滤可访问页面，支持关键词检索与快捷跳转。
 * 预期结果：搜索与跳转行为保持原样，未触发搜索时不加载命令面板依赖。
 */
import { canAccessPath } from "@leonwillow-electron/access";
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
import { Fragment, useCallback, useState } from "react";
import { type SearchItem, searchData } from "@/assets/data/search";

function itemKey(item: SearchItem) {
	return item.search
		? `${item.href}?${new URLSearchParams(item.search).toString()}`
		: item.href;
}

export default function CommandMenuDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const { user, moduleIds } = getRouteApi("/_workspace").useRouteContext();
	const groups = searchData
		.map((group) => ({
			...group,
			data: group.data.filter(
				(item) =>
					(!item.adminOnly || user.role === "admin") &&
					canAccessPath({ role: user.role, moduleIds }, item.href),
			),
		}))
		.filter((group) => group.data.length);
	const [search, setSearch] = useState("");

	const navigate = useNavigate();
	const { caseId } = useSearch({ strict: false });

	const handleOpenChange = useCallback(
		(nextOpen: boolean) => {
			if (!nextOpen) setSearch("");
			onOpenChange(nextOpen);
		},
		[onOpenChange],
	);

	const runCommand = useCallback(
		(command: () => unknown) => {
			handleOpenChange(false);
			command();
		},
		[handleOpenChange],
	);

	const navigateToItem = useCallback(
		(item: SearchItem) => {
			const nextSearch =
				item.href === "/funds" || item.href === "/funds/cases"
					? { caseId }
					: item.search;
			runCommand(() =>
				navigate({
					to: item.href,
					search: nextSearch as never,
				}),
			);
		},
		[caseId, navigate, runCommand],
	);

	return (
		<CommandDialog
			title="命令面板"
			description="搜索并跳转到工作区页面。"
			open={open}
			onOpenChange={handleOpenChange}
		>
			<Command
				filter={(value, queryText, keywords) => {
					const query = queryText.toLowerCase();
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
					{groups.map((searchGroup, index) => (
						<Fragment key={searchGroup.title}>
							<CommandGroup heading={searchGroup.title}>
								{searchGroup.data.map((item) => (
									<CommandItem
										key={itemKey(item)}
										value={item.name}
										keywords={item.tags}
										onSelect={() => navigateToItem(item)}
									>
										<item.icon />
										<span>{item.name}</span>
									</CommandItem>
								))}
							</CommandGroup>
							{index !== groups.length - 1 && <CommandSeparator />}
						</Fragment>
					))}
				</CommandList>
			</Command>
		</CommandDialog>
	);
}
