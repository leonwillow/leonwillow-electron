// React Imports

// Component Imports
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
	CommandShortcut,
} from "@leonwillow-electron/ui/components/command";
// Router Imports
import { useNavigate } from "@tanstack/react-router";
// Third-party Imports
import { BarChart3Icon, InboxIcon, SearchIcon } from "lucide-react";
import { Fragment, useCallback, useEffect, useState } from "react";

// Data Imports
import { searchData } from "@/assets/data/search";

const CommandMenu = ({
	variant = "default",
}: {
	variant?: "default" | "icon";
}) => {
	// States
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");

	// Hooks
	const navigate = useNavigate();

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
			{variant === "icon" ? (
				<Button
					className="hover:bg-primary/10 hover:text-primary"
					variant="ghost"
					size="icon-lg"
					aria-label="搜索"
					onClick={() => setOpen(true)}
				>
					<SearchIcon />
				</Button>
			) : (
				<Button
					variant="ghost"
					className="hidden px-2.5 font-normal sm:block"
					onClick={() => setOpen(true)}
				>
					<div className="hidden items-center gap-1.5 text-muted-foreground text-sm sm:flex">
						<SearchIcon />
						<span>输入以搜索…</span>
					</div>
				</Button>
			)}
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

						// Exact match with item name (highest priority)
						if (name === query) return 2;

						// Partial match with item name (medium priority)
						if (name.includes(query)) return 1.5;

						// Match in tags/keywords (lowest priority)
						if (keywords && keywords.length > 0) {
							// Check for exact tag match first
							if (keywords.some((keyword) => keyword.toLowerCase() === query))
								return 1.25;

							// Then check for partial matches in tags
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
							searchData.map((searchGroup, index) => (
								<Fragment key={searchGroup.title}>
									<CommandGroup heading={searchGroup.title}>
										{searchGroup.data.map((item) => (
											<CommandItem
												key={item.href}
												value={item.name}
												keywords={item.tags}
												onSelect={() =>
													runCommand(() => {
														if (item.openInNewTab) {
															window.open(
																item.href,
																"_blank",
																"noopener,noreferrer",
															);
														} else {
															navigate({ to: item.href });
														}
													})
												}
											>
												<item.icon />
												<span>{item.name}</span>
												{item.shortcut && (
													<CommandShortcut>{item.shortcut}</CommandShortcut>
												)}
											</CommandItem>
										))}
									</CommandGroup>
									{index !== searchData.length - 1 && <CommandSeparator />}
								</Fragment>
							))
						) : (
							<CommandGroup heading="建议">
								<CommandItem
									onSelect={() => runCommand(() => navigate({ to: "/inbox" }))}
								>
									<InboxIcon />
									<span>收件箱</span>
								</CommandItem>
								<CommandItem
									onSelect={() =>
										runCommand(() => navigate({ to: "/reports" }))
									}
								>
									<BarChart3Icon />
									<span>报表</span>
								</CommandItem>
							</CommandGroup>
						)}
					</CommandList>
				</Command>
			</CommandDialog>
		</>
	);
};

export default CommandMenu;
