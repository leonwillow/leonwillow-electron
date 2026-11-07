/**
 * @file 浏览器文本复制，兼容普通 HTTP 局域网。
 * 创建时间：2026-11-07；修改时间：2026-11-07。
 * 版本作用：优先 Clipboard API，仅在缺失时用用户手势内的同步复制兼容路径。
 * 被调用：表格、复制文本与主题导出；调用：目标 Document 的剪贴板、选区与焦点 API。
 * 预期结果：复制后恢复原焦点和选区，拒绝授权或复制失败时抛错，不误报成功。
 */
export async function copyText(text: string, doc: Document = document) {
	const clipboard = doc.defaultView?.navigator.clipboard;
	if (clipboard?.writeText) {
		await clipboard.writeText(text);
		return;
	}
	// HTTP 局域网没有异步 Clipboard API；此兼容分支须由点击/键盘事件直接调用。
	const active = doc.activeElement as HTMLElement | null;
	const selection = doc.getSelection();
	const ranges = selection
		? Array.from({ length: selection.rangeCount }, (_, index) =>
				selection.getRangeAt(index).cloneRange(),
			)
		: [];
	const input = active?.matches("input, textarea")
		? (active as HTMLInputElement | HTMLTextAreaElement)
		: null;
	const start = input?.selectionStart;
	const end = input?.selectionEnd;
	const direction = input?.selectionDirection;
	const field = doc.createElement("textarea");
	field.value = text;
	field.readOnly = true;
	field.tabIndex = -1;
	field.className = "sr-only";
	field.setAttribute("aria-label", "复制内容");
	field.addEventListener("copy", (event) => {
		if (event.clipboardData) {
			event.clipboardData.setData("text/plain", text);
			event.preventDefault();
		}
		event.stopPropagation();
	});
	(active?.closest('[role="dialog"], [role="alertdialog"]') ?? doc.body).append(
		field,
	);
	try {
		field.focus({ preventScroll: true });
		field.select();
		if (!doc.execCommand("copy")) throw Error("浏览器未允许复制，请手动复制");
	} finally {
		field.remove();
		if (active?.isConnected) active.focus({ preventScroll: true });
		if (input && start != null && end != null) {
			input.setSelectionRange(start, end, direction ?? undefined);
		} else if (selection) {
			selection.removeAllRanges();
			for (const range of ranges) selection.addRange(range);
		}
	}
}
