/**
 * @file 文书工作区：类型导航、类型内记录表格与模板管理。
 * 创建时间：2026-10-10；修改时间：2026-11-04。
 * 版本作用：按类型组织文书，工具栏新增只使用当前类型，类型选择保留在 URL。
 * 被调用：documents 文件路由；调用：导航上下文、records-workspace、template-panel、Eden。
 * 功能与预期结果：切换类型隔离表格和编辑状态，停用类型的历史记录仍可进入。
 */
import { Button } from "@leonwillow-electron/ui/components/button";
import { TooltipText } from "@leonwillow-electron/ui/components/tooltip";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { ChevronRightIcon, FileTextIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useDocumentNavigation } from "@/components/layout/document-navigation-provider";
import { listDocumentCatalog, listDocumentTypes } from "@/lib/documents";
import RecordsWorkspace from "./records-workspace";
import TemplatePanel from "./template-panel";

const route = getRouteApi("/_workspace/documents");
export default function DocumentsView() {
	const initial = route.useLoaderData();
	const { typeId, view } = route.useSearch();
	const menu = useDocumentNavigation();
	const navigate = useNavigate();
	const { user } = getRouteApi("/_workspace").useRouteContext();
	const admin = user.role === "admin";
	const [data, setData] = useState(initial);
	const managing = view === "templates" && admin;
	useEffect(() => setData(initial), [initial]);
	useEffect(() => {
		menu.setCatalog(data.catalog);
	}, [data.catalog, menu.setCatalog]);
	const selected = data.catalog.find((type) => type.id === typeId);
	const template = data.types.find((type) => type.id === typeId);
	const reloadTypes = async () => {
		const [types, catalog] = await Promise.all([
			listDocumentTypes(),
			listDocumentCatalog(),
		]);
		setData({ types, catalog });
	};
	const showTypes = menu.focusPanel;
	const manage = () => {
		void navigate({ to: "/documents", search: { view: "templates" } });
	};
	return (
		<div className="flex h-full min-h-0 min-w-0">
			<div className="flex min-h-0 min-w-0 flex-1 flex-col">
				<header className="flex h-workspace-header shrink-0 items-center gap-2 border-b px-workspace-gutter">
					<FileTextIcon className="hidden size-4 shrink-0 text-muted-foreground sm:block" />
					<h1 className="flex min-w-0 items-center gap-2 font-medium text-base">
						<span className="shrink-0">文书取号</span>
						{(managing || selected) && (
							<>
								<ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
								<TooltipText
									content={managing ? "模板管理" : (selected?.name ?? "")}
								>
									<span className="truncate">
										{managing ? "模板管理" : selected?.name}
									</span>
								</TooltipText>
							</>
						)}
					</h1>
				</header>
				{managing && admin ? (
					<TemplatePanel types={data.types} onSaved={reloadTypes} />
				) : selected ? (
					<RecordsWorkspace
						key={`${user.id}-${selected.id}-${menu.selection}`}
						type={selected}
						template={template}
						userId={user.id}
						admin={admin}
					/>
				) : (
					<div className="flex flex-1 flex-col items-center justify-center gap-3 p-workspace-gutter text-center">
						<h2 className="font-medium text-base">
							{typeId ? "该文书类型已不可用" : "选择文书类型"}
						</h2>
						<p className="max-w-md text-muted-foreground text-sm">
							{typeId
								? "请从类型列表中重新选择。"
								: data.catalog.length
									? "从文书类型菜单选择类型，查看取号记录或新增文书。"
									: "管理员导入模板后，即可开始取号。"}
						</p>
						<Button variant="outline" onClick={showTypes}>
							打开文书类型列表
						</Button>
						{admin && !data.catalog.length && (
							<Button onClick={manage}>导入文书模板</Button>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
