/**
 * @file 同窗 Word 文书预览与页面适宽。
 * 创建时间：2026-10-10；修改时间：2026-11-05。
 * 版本作用：按需加载 docx-preview，在无脚本的独立 iframe 内保留文书排版。
 * 被调用：document-editor；调用：docx-preview、浏览器 ResizeObserver。
 * 功能与预期结果：模板样式不污染应用，切换内容不会显示过期结果，窄窗适宽。
 */
import { ScrollArea } from "@leonwillow-electron/ui/components/scroll-area";
import { cn } from "@leonwillow-electron/ui/lib/utils";
import { useEffect, useRef, useState } from "react";
import { documentError } from "@/lib/documents";

export default function DocumentPreview({ blob }: { blob: Blob | null }) {
	const frameRef = useRef<HTMLIFrameElement>(null);
	const [status, setStatus] = useState("正在准备文书预览…");
	const [ready, setReady] = useState(false);
	const [frameHeight, setFrameHeight] = useState(0);
	useEffect(() => {
		if (!blob) {
			setStatus("正在准备文书预览…");
			setReady(false);
			frameRef.current?.contentDocument?.body.replaceChildren();
			return;
		}
		const frame = frameRef.current;
		if (!frame) return;
		let cancelled = false;
		let observer: ResizeObserver | undefined;
		setStatus("正在呈现 Word 文书…");
		void (async () => {
			const { renderAsync } = await import("docx-preview");
			const doc = frame.contentDocument;
			if (!doc || cancelled) return;
			const body = doc.createElement("div");
			const styles = doc.createElement("div");
			await renderAsync(blob, body, styles, {
				inWrapper: true,
				breakPages: true,
				useBase64URL: true,
				renderAltChunks: false,
				renderComments: false,
				ignoreLastRenderedPageBreak: false,
			});
			if (cancelled) return;
			doc.head.replaceChildren(styles);
			doc.body.replaceChildren(body);
			doc.body.style.margin = "0";
			doc.documentElement.style.overflow = "hidden";
			doc.body.style.background = "white";
			// 预览使用 Word 自带字号；这里只缩放整张纸，不改变 UI 的 rem 令牌。
			const wrapper = body.querySelector<HTMLElement>(".docx-wrapper");
			if (wrapper) {
				wrapper.style.padding = "0";
				wrapper.style.background = "white";
			}
			body.style.position = "absolute";
			body.style.transformOrigin = "top left";
			const fit = () => {
				body.style.transform = "";
				const width = body.scrollWidth;
				const height = body.scrollHeight;
				const scale = Math.min(
					1,
					Math.max(0.1, (frame.clientWidth - 16) / Math.max(1, width)),
				);
				body.style.transform = `scale(${scale})`;
				doc.body.style.height = `${height * scale}px`;
				setFrameHeight(Math.ceil(height * scale));
			};
			observer = new ResizeObserver(fit);
			observer.observe(frame);
			fit();
			void doc.fonts.ready.then(() => {
				if (!cancelled) fit();
			});
			// Base64 内嵌资源随 iframe 销毁回收；更新期间保留上一份纸张，避免闪烁。
			setReady(true);
			setStatus("");
		})().catch((error) => {
			if (!cancelled) setStatus(documentError(error));
		});
		return () => {
			cancelled = true;
			observer?.disconnect();
		};
	}, [blob]);
	return (
		<div className="relative flex min-h-80 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border bg-muted/30 lg:min-h-0">
			{status && (
				<p
					className={cn(
						"text-muted-foreground text-sm",
						ready ? "absolute inset-x-0 top-0 bg-background/90 p-3" : "p-6",
					)}
					role="status"
				>
					{status}
				</p>
			)}
			<ScrollArea className="min-h-0 flex-1">
				<iframe
					ref={frameRef}
					title="Word 文书预览"
					sandbox="allow-same-origin"
					className="min-h-80 w-full border-0 bg-background lg:min-h-0"
					style={{ height: frameHeight || undefined }}
					hidden={!ready}
				/>
			</ScrollArea>
		</div>
	);
}
