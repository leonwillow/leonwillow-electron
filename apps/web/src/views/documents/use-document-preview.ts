/**
 * @file 文书草稿随输入更新的真实 Word 预览请求。
 * 创建时间：2026-10-11；修改时间：2026-11-21。
 * 版本作用：初次打开立即预览，输入合并 350ms，过期响应不覆盖最新草稿。
 * 被调用：document-editor；调用：文书 Eden 预览接口。
 * 功能与预期结果：预览不占号；历史记录使用原号码和模板，失败可独立重试。
 */
import { useEffect, useRef, useState } from "react";
import {
	type DocumentDetails,
	type DocumentDraft,
	documentError,
	previewDocument,
	previewExistingDocument,
	previewStoredDocument,
} from "@/lib/documents";

type PreviewInput = {
	draft: DocumentDraft;
	record?: { id: string; revision: number };
	changed: boolean;
};

/** 使用序列化草稿区分输入版本；取消定时器并忽略旧响应，不中断填写与保存。 */
export function useDocumentPreview(
	draft: DocumentDraft,
	details: DocumentDetails | undefined,
	changed: boolean,
) {
	const input = JSON.stringify({
		draft,
		record: details
			? { id: details.record.id, revision: details.record.revision }
			: undefined,
		changed,
	} satisfies PreviewInput);
	const [blob, setBlob] = useState<Blob | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [retry, setRetry] = useState(0);
	const renderedRef = useRef<{
		recordId?: string;
		draftKey: string;
		retry: number;
	} | null>(null);
	useEffect(() => {
		const current = JSON.parse(input) as PreviewInput;
		if (
			!Number.isInteger(current.draft.year) ||
			current.draft.year < 2000 ||
			current.draft.year > 9999
		) {
			renderedRef.current = null;
			setLoading(false);
			setBlob(null);
			setError("填写有效年份后会自动预览。");
			return;
		}
		const draftKey = JSON.stringify(current.draft);
		// 已保存的既有文书若正文与最近一次已呈现的预览一致，保存回刷 revision 时跳过冗余重建。
		if (
			current.record &&
			!current.changed &&
			renderedRef.current &&
			renderedRef.current.recordId === current.record.id &&
			renderedRef.current.draftKey === draftKey &&
			renderedRef.current.retry === retry
		) {
			setLoading(false);
			setError("");
			return;
		}
		let live = true;
		setLoading(true);
		setError("");
		const timer = setTimeout(
			() => {
				const request = current.record
					? current.changed
						? previewExistingDocument(current.record.id, {
								values: current.draft.values,
								subject: current.draft.subject,
								revision: current.record.revision,
							})
						: previewStoredDocument(current.record.id)
					: previewDocument(current.draft);
				void request
					.then((file) => {
						if (live) {
							renderedRef.current = {
								recordId: current.record?.id,
								draftKey,
								retry,
							};
							setBlob(file);
						}
					})
					.catch((cause) => {
						if (live) setError(documentError(cause));
					})
					.finally(() => {
						if (live) setLoading(false);
					});
			},
			current.changed ? 350 : 0,
		);
		return () => {
			live = false;
			clearTimeout(timer);
		};
	}, [input, retry]);
	return { blob, loading, error, retry: () => setRetry((value) => value + 1) };
}
