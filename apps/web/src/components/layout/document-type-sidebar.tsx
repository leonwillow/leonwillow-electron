/**
 * @file 文书类型菜单的内容和模板入口。
 * 创建时间：2026-10-11；修改时间：2026-11-05。
 * 版本作用：为统一菜单框 提供文书类型标题、模板操作及类型列表。
 * 被调用：WorkspaceSecondaryMenu；调用：DocumentNavigationProvider、共享控件、路由。
 * 功能与预期结果：未固定时选类型收起，固定偏好按用户保留，窄窗回到浮层。
 */

import {
	Button,
	buttonVariants,
} from "@leonwillow-electron/ui/components/button";
import { Input } from "@leonwillow-electron/ui/components/input";
import { MenuLabel } from "@leonwillow-electron/ui/components/menu-label";
import { ScrollArea } from "@leonwillow-electron/ui/components/scroll-area";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@leonwillow-electron/ui/components/tooltip";
import { cn } from "@leonwillow-electron/ui/lib/utils";
import { getRouteApi, Link, useSearch } from "@tanstack/react-router";
import { FileTextIcon, Settings2Icon } from "lucide-react";
import { useState } from "react";
import { useDocumentNavigation } from "./document-navigation-provider";
import type { WorkspaceMenuContent } from "./workspace-menu";

export default function useDocumentTypeMenu(): WorkspaceMenuContent {
	const menu = useDocumentNavigation();
	const { typeId, view } = useSearch({ strict: false });
	const { user } = getRouteApi("/_workspace").useRouteContext();
	const [search, setSearch] = useState("");
	const types = (menu.catalog ?? []).filter((type) =>
		type.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
	);
	return {
		label: "文书类型菜单",
		title: "文书类型",
		toolbar: user.role === "admin" && (
			<Tooltip>
				<TooltipTrigger
					render={
						<Link
							to="/documents"
							search={{ view: "templates" }}
							aria-label="管理文书模板"
							onClick={menu.dismiss}
							className={buttonVariants({ variant: "ghost", size: "icon" })}
						/>
					}
				>
					<Settings2Icon />
				</TooltipTrigger>
				<TooltipContent>管理文书模板</TooltipContent>
			</Tooltip>
		),
		children: (
			<>
				<div className="p-workspace-gutter">
					<Input
						aria-label="搜索文书类型"
						placeholder="搜索文书类型"
						value={search}
						onChange={(event) => setSearch(event.target.value)}
					/>
				</div>
				<ScrollArea
					aria-label="文书类型列表"
					className="min-h-0 flex-1"
					contentClassName="w-full min-w-0! px-workspace-gutter pb-workspace-gutter"
					render={<nav />}
				>
					{menu.loading || (!menu.error && menu.catalog === null) ? (
						<p role="status" className="p-2 text-muted-foreground text-xs">
							正在读取文书类型…
						</p>
					) : menu.error ? (
						<div className="flex flex-col gap-2 p-2">
							<p role="alert" className="text-destructive text-xs">
								{menu.error}
							</p>
							<Button
								variant="outline"
								size="sm"
								onClick={() => void menu.refreshCatalog()}
							>
								重新加载
							</Button>
						</div>
					) : (
						<>
							{[false, true].map((archived) => {
								const group = types.filter(
									(type) => type.archived === archived,
								);
								return group.length ? (
									<div key={String(archived)} className="mb-3">
										{archived && (
											<p className="px-2 py-2 text-muted-foreground text-xs">
												已停用 · 历史文书
											</p>
										)}
										<ul className="flex flex-col gap-1">
											{group.map((type) => (
												<li key={type.id} data-menu-row>
													<Link
														to="/documents"
														search={{ typeId: type.id }}
														aria-current={
															view !== "templates" && typeId === type.id
																? "page"
																: undefined
														}
														onClick={menu.selectType}
														className={cn(
															buttonVariants({
																variant: "ghost",
																size: "lg",
															}),
															"w-full justify-start",
															view !== "templates" &&
																typeId === type.id &&
																"bg-sidebar-accent",
														)}
													>
														<FileTextIcon />
														<MenuLabel>{type.name}</MenuLabel>
													</Link>
												</li>
											))}
										</ul>
									</div>
								) : null;
							})}
							{!types.length && (
								<p className="p-2 text-muted-foreground text-xs">
									{search
										? "没有找到该文书类型。"
										: "暂无文书类型，请联系管理员导入模板。"}
								</p>
							)}
						</>
					)}
				</ScrollArea>
			</>
		),
	};
}
