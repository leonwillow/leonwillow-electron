/**
 * @file 笔录目录操作与当前编辑器之间的保存协调。
 * 创建时间：2026-11-04；修改时间：2026-11-05。
 * 版本作用：目录归档或删除前锁定匹配的编辑器，获取已保存的最新修订号。
 * 被调用：InquiryNavigationProvider、笔录菜单、useInquiryEditor；调用：React 上下文。
 * 预期结果：保存失败阻止目录写操作，操作结束释放编辑锁，不接管普通页面导航。
 */
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useRef,
} from "react";

import type { InquiryRecord } from "@/lib/inquiries";

type SavedRecord = { id: string; revision: number };
type EditorActions = {
	caseId: string;
	recordId: string;
	prepare: () => Promise<SavedRecord | null>;
	finish: () => void;
	accept: (record: InquiryRecord) => void;
};
type InquiryEditorActions = {
	registerEditor: (editor: EditorActions) => () => void;
	prepareMutation: (
		caseId: string,
		recordId?: string,
	) => Promise<SavedRecord | null | undefined>;
	finishMutation: () => void;
	acceptMutation: (record: InquiryRecord) => void;
};
const Context = createContext<InquiryEditorActions | null>(null);

export function InquiryEditorActionsProvider({
	children,
}: {
	children: ReactNode;
}) {
	const active = useRef<EditorActions | null>(null);
	const locked = useRef<EditorActions | null>(null);
	const registerEditor = useCallback((editor: EditorActions) => {
		active.current = editor;
		return () => {
			if (active.current === editor) active.current = null;
		};
	}, []);
	const finishMutation = useCallback(() => {
		locked.current?.finish();
		locked.current = null;
	}, []);
	/**
	 * caseId 限定案件，recordId 可进一步限定单份笔录。无匹配编辑器返回 undefined，
	 * 保存失败或并发操作返回 null；调用方无论成功/失败，都必须在 finally 释放锁。
	 */
	const prepareMutation = useCallback(
		async (caseId: string, recordId?: string) => {
			if (locked.current) return null;
			const editor = active.current;
			if (
				!editor ||
				editor.caseId !== caseId ||
				(recordId && editor.recordId !== recordId)
			)
				return undefined;
			locked.current = editor;
			const record = await editor.prepare();
			// 保存期间离开或切换编辑器时不再提交原目录操作。
			return active.current === editor ? record : null;
		},
		[],
	);
	const acceptMutation = useCallback((record: InquiryRecord) => {
		const editor = locked.current;
		if (editor && editor === active.current && editor.recordId === record.id)
			editor.accept(record);
	}, []);
	const value = useMemo(
		() => ({ registerEditor, prepareMutation, finishMutation, acceptMutation }),
		[registerEditor, prepareMutation, finishMutation, acceptMutation],
	);
	return <Context value={value}>{children}</Context>;
}

export function useInquiryEditorActions() {
	const actions = useContext(Context);
	if (!actions) throw new Error("笔录编辑操作必须位于笔录导航上下文中。");
	return actions;
}
