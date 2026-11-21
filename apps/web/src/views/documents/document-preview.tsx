/**
 * @file 同窗 Word 文书预览与页面适宽。
 * 创建时间：2026-10-10；修改时间：2026-11-20。
 * 版本作用：按需加载 docx-preview，在无脚本且隔离外链与导航的独立 iframe 内保留文书排版。
 * 被调用：document-editor；调用：docx-preview、浏览器 ResizeObserver。
 * 功能与预期结果：模板样式、外链与链接跳转不污染或逃逸应用，首帧即按实测宽度适宽无闪烁。
 */
import { ScrollArea } from "@leonwillow-electron/ui/components/scroll-area";
import { cn } from "@leonwillow-electron/ui/lib/utils";
import { useEffect, useRef, useState } from "react";
import { documentError } from "@/lib/documents";

const PREVIEW_CSP =
	"default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:;";

function stripUnsafeCssUrls(css: string) {
	return css
		.replace(/@import\s+[^;]+;/gi, "")
		.replace(
			/url\(\s*(['"]?)(.*?)\1\s*\)/gi,
			(full, _quote, rawUrl: string) => {
				const trimmed = rawUrl.trim();
				if (!trimmed || /^data:/i.test(trimmed) || trimmed.startsWith("#"))
					return full;
				return "none";
			},
		);
}

function sanitizePreviewSubtree(root: HTMLElement) {
	for (const forbidden of root.querySelectorAll(
		"script, iframe, object, embed, base, link, form",
	)) {
		forbidden.remove();
	}
	for (const anchor of root.querySelectorAll("a")) {
		anchor.removeAttribute("href");
		anchor.removeAttribute("xlink:href");
		anchor.removeAttribute("target");
		anchor.removeAttribute("ping");
	}
	for (const media of root.querySelectorAll("img, image")) {
		for (const attr of ["src", "href", "xlink:href"] as const) {
			const value = media.getAttribute(attr);
			if (value && !/^data:/i.test(value.trim())) {
				media.removeAttribute(attr);
			}
		}
	}
	for (const styleEl of root.querySelectorAll("style")) {
		if (styleEl.textContent) {
			styleEl.textContent = stripUnsafeCssUrls(styleEl.textContent);
		}
	}
	for (const styled of root.querySelectorAll<HTMLElement>("[style]")) {
		const inlineStyle = styled.getAttribute("style");
		if (inlineStyle && /url\(/i.test(inlineStyle)) {
			styled.setAttribute("style", stripUnsafeCssUrls(inlineStyle));
		}
	}
}

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
			const doc = frame.contentDocument;
			if (!doc || cancelled) return;
			const cspMeta = doc.createElement("meta");
			cspMeta.httpEquiv = "Content-Security-Policy";
			cspMeta.content = PREVIEW_CSP;
			doc.head.replaceChildren(cspMeta);
			const { renderAsync } = await import("docx-preview");
			if (cancelled) return;
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
			sanitizePreviewSubtree(styles);
			sanitizePreviewSubtree(body);
			doc.head.replaceChildren(cspMeta, styles);
			doc.body.replaceChildren(body);
			doc.body.style.margin = "0";
			doc.documentElement.style.overflow = "hidden";
			doc.documentElement.style.background = "white";
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
				const viewportWidth =
					frame.clientWidth || frame.parentElement?.clientWidth || 0;
				if (!viewportWidth) return;
				body.style.transform = "";
				const width = body.scrollWidth;
				const height = body.scrollHeight;
				const scale = Math.min(
					1,
					Math.max(0.1, (viewportWidth - 16) / Math.max(1, width)),
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
					className={cn(
						"block w-full border-0 bg-transparent",
						!ready && "invisible",
					)}
					style={{ height: frameHeight || undefined }}
				/>
			</ScrollArea>
		</div>
	);
}
