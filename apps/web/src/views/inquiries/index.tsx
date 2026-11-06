/**
 * @file 笔录模块的编辑、未选择引导和常用人员工作区入口。
 * 创建时间：2026-11-04；修改时间：2026-11-05。
 * 版本作用：路由选择案件和笔录，业务展示位于专用视图。
 * 被调用：inquiries 文件路由；调用：共享工作台顶栏、Eden 资源和笔录视图。
 * 预期结果：目录笔录直接进入编辑，未选择时提供引导，不再重复展示案件笔录表格。
 */
import { Button } from "@leonwillow-electron/ui/components/button";
import { getRouteApi } from "@tanstack/react-router";
import { FilePlus2Icon, FolderOpenIcon, FolderPlusIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { useInquiryNavigation } from "@/components/layout/inquiry-navigation-provider";
import { getInquiryCase, getInquiryRecord } from "@/lib/inquiries";
import InquiryCaseDialog from "./case-dialog";
import { InquiryState } from "./controls";
import InquiryInquirers from "./inquirers";
import InquiryRecordEditor from "./record-editor";
import { useCreateInquiry } from "./use-create-inquiry";
import { useInquiryResource } from "./use-inquiry-resource";
import InquiryWorkspaceHeader from "./workspace-header";

function EditorResource({
	caseId,
	recordId,
}: {
	caseId: string;
	recordId: string;
}) {
	const resource = useInquiryResource(
		useCallback(async () => {
			const [folder, record] = await Promise.all([
				getInquiryCase(caseId),
				getInquiryRecord(caseId, recordId),
			]);
			return { folder, record };
		}, [caseId, recordId]),
	);
	return resource.data ? (
		<InquiryRecordEditor
			key={recordId}
			record={resource.data.record}
			readOnly={resource.data.folder.archived || resource.data.record.archived}
		/>
	) : (
		<>
			<InquiryWorkspaceHeader />
			<InquiryState
				loading={resource.loading}
				error={resource.error}
				retry={resource.reload}
			/>
		</>
	);
}
export default function InquiriesView() {
	const { inquiryCaseId, recordId, inquiryView } = getRouteApi(
		"/_workspace/inquiries",
	).useSearch();
	const menu = useInquiryNavigation();
	const [creating, setCreating] = useState(false);
	const creation = useCreateInquiry();
	return (
		<div className="flex min-h-0 min-w-0 flex-1 flex-col">
			{(inquiryView === "inquirers" || !inquiryCaseId || !recordId) && (
				<InquiryWorkspaceHeader />
			)}
			{inquiryView === "inquirers" ? (
				<InquiryInquirers />
			) : inquiryCaseId && recordId ? (
				<EditorResource
					key={`${inquiryCaseId}:${recordId}`}
					caseId={inquiryCaseId}
					recordId={recordId}
				/>
			) : (
				<div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
					<FolderOpenIcon className="size-10 text-muted-foreground" />
					<h2 className="font-semibold text-lg">选择或新建一份笔录</h2>
					<p className="max-w-sm text-muted-foreground text-sm">
						从左侧目录选择笔录开始编辑，也可以新建笔录或案件文件夹。
					</p>
					<div className="flex flex-wrap justify-center gap-2">
						<Button
							disabled={creation.busy}
							onClick={() => void creation.create()}
						>
							<FilePlus2Icon data-icon="inline-start" />
							{creation.busy ? "正在创建…" : "新建笔录"}
						</Button>
						<Button variant="outline" onClick={() => setCreating(true)}>
							<FolderPlusIcon data-icon="inline-start" />
							新建案件文件夹
						</Button>
						<Button variant="outline" onClick={menu.focusPanel}>
							打开笔录目录
						</Button>
					</div>
					{creation.error && (
						<p role="alert" className="text-destructive text-sm">
							{creation.error}
						</p>
					)}
				</div>
			)}
			{creating && <InquiryCaseDialog onClose={() => setCreating(false)} />}
		</div>
	);
}
