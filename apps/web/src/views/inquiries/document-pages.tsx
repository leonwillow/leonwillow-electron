/**
 * @file 询问笔录的实测分页、A4 预览和打印页面。
 * 创建时间：2026-11-04；修改时间：2026-11-05。
 * 版本作用：沿用 haoji 的字形测量和二分拆段，所有文字通过 React/textContent 输出。
 * 被调用：RecordEditor、打印 Portal；调用：文书共享 CSS、中文数字、浏览器字体与尺寸 API。
 * 预期结果：长问答跨页不断字、不丢文；预览点击定位字段，打印保持物理纸张尺寸。
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { InquiryDocument } from "@/lib/inquiries";
import { toChineseUpperNumber } from "./chinese-number";
import { inquiryRelationshipName, relationships } from "./record-fields";

type Fragment = {
	key: string;
	label: string;
	text: string;
	target: string;
	kind: "metadata" | "notice" | "qa";
	continued?: boolean;
};
type Page = { key: string; fragments: Fragment[] };
const WIDTH = 793.7008;
const HEIGHT = 1122.5197;
function dateText(value: string) {
	const match = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/.exec(value);
	return match
		? `${match[1]}年${match[2]}月${match[3]}日${match[4] ?? "　"}时${match[5] ?? "　"}分`
		: "　年　月　日　时　分";
}
function fragments(c: InquiryDocument["content"]): Fragment[] {
	const relationship = inquiryRelationshipName(c.subjectRelationship);
	const person = (p: (typeof c.inquirers)[number]) =>
		`${p.name}${p.badgeNumber ? `（${p.badgeNumber}）` : ""}`;
	const recorder = c.inquirers.find((p) => p.isRecorder);
	const field = (
		key: string,
		label: string,
		text: string,
		target = `inquiry-${key}`,
	): Fragment => ({ key, label, text, target, kind: "metadata" });
	return [
		field(
			"inquiryStartAt",
			"时　间：",
			`${dateText(c.inquiryStartAt)} 至 ${dateText(c.inquiryEndAt)}`,
		),
		field("inquiryLocation", "地　点：", c.inquiryLocation),
		...c.inquirers.map((p, i) =>
			field(
				p.id,
				i === 0 ? "询问（调查）人：" : "",
				person(p),
				`inquirer-name-${p.id}`,
			),
		),
		field(
			"recorder",
			"记录人：",
			recorder ? person(recorder) : "",
			recorder ? `recorder-${recorder.id}` : "",
		),
		field(
			"subjectName",
			"被询问（调查）人：",
			`${c.subjectName || "　　　"}　性别：${c.subjectGender}　年龄：${c.subjectAge || "　"}`,
		),
		field(
			"subjectIdNumber",
			"证件种类：",
			`${c.subjectIdType}　证件号码：${c.subjectIdNumber}`,
		),
		field("subjectOrg", "工作单位：", c.subjectOrg),
		field(
			"subjectPosition",
			"职务：",
			`${c.subjectPosition || "　　　"}　联系电话：${c.subjectPhone}`,
		),
		field("subjectAddress", "住址：", c.subjectAddress),
		field(
			"subjectRelationship",
			"与被检查人关系：",
			relationships
				.map(
					(r) =>
						`${r === relationship ? "☑" : "☐"}${r}${r === "其他" && relationship === r ? `：${c.subjectRelationshipOther}` : ""}`,
				)
				.join("　"),
		),
		{
			key: "notice-1",
			kind: "notice",
			label: "询问人：",
			text: `您好！我们是${c.enforcementUnitName || "国家税务总局XXX税务局XXX稽查局"}的税务执法人员，这是我们的税务检查证（出示税务检查证），请您确认。`,
			target: "inquiry-enforcementUnitName",
		},
		{
			key: "notice-2",
			kind: "notice",
			label: "被询问人：",
			text: "□已确认/□不确认",
			target: "",
		},
		{
			key: "notice-3",
			kind: "notice",
			label: "询问人：",
			text: "现依法就（被检查人、具体事由）有关情况进行询问，请如实回答问题。如不如实回答问题，将承担相应法律后果。您有权进行陈述和申辩。",
			target: "",
		},
		...c.qaItems.flatMap((qa): Fragment[] => [
			{
				key: `q-${qa.id}`,
				kind: "qa",
				label: "问：",
				text: qa.question.replace(/\r\n?/g, "\n"),
				target: `question-${qa.id}`,
			},
			{
				key: `a-${qa.id}`,
				kind: "qa",
				label: "答：",
				text: qa.answer.replace(/\r\n?/g, "\n"),
				target: `answer-${qa.id}`,
			},
		]),
	];
}
function FragmentLine({
	fragment: f,
	focus,
}: {
	fragment: Fragment;
	focus?: (id: string) => void;
}) {
	const className = `inquiry-document-line inquiry-document-line--${f.kind}`;
	const children = (
		<>
			{!f.continued && f.label}
			<span className="inquiry-document-line-text">{f.text || "　"}</span>
		</>
	);
	return focus && f.target ? (
		<button
			type="button"
			className={`${className} inquiry-document-focus-target`}
			onClick={() => focus(f.target)}
			aria-label={`定位${f.label || "对应字段"}`}
		>
			{children}
		</button>
	) : (
		<p className={className}>{children}</p>
	);
}
export default function InquiryDocumentPages({
	draft,
	preview = true,
	focus,
	onReady,
	onError,
}: {
	draft: InquiryDocument;
	preview?: boolean;
	focus?: (id: string) => void;
	onReady?: () => void;
	onError?: (message: string) => void;
}) {
	const host = useRef<HTMLDivElement>(null);
	const measure = useRef<HTMLDivElement>(null);
	const [scale, setScale] = useState(1);
	const [pages, setPages] = useState<Page[]>([]);
	const [paginating, setPaginating] = useState(true);
	const [error, setError] = useState("");
	const source = useMemo(() => fragments(draft.content), [draft.content]);
	const readyRef = useRef(onReady);
	readyRef.current = onReady;
	const errorRef = useRef(onError);
	errorRef.current = onError;
	useEffect(() => {
		if (!preview || !host.current) return;
		const element = host.current;
		const resize = () =>
			setScale(Math.min(1, Math.max(0.1, element.clientWidth / WIDTH)));
		const observer = new ResizeObserver(resize);
		observer.observe(element);
		resize();
		return () => observer.disconnect();
	}, [preview]);
	useEffect(() => {
		let cancelled = false;
		setPaginating(true);
		setError("");
		const timer = setTimeout(
			() => {
				void (async () => {
					await document.fonts.load('14pt "Inquiry FangSong"');
					await document.fonts.ready;
					const container = measure.current;
					if (!container || cancelled) return;
					container.replaceChildren();
					const all: Page[] = [{ key: "page-1", fragments: [] }];
					let current = all[0];
					if (!current) return;
					const fits = (fragment: Fragment) => {
						const p = document.createElement("p");
						p.className = `inquiry-document-line inquiry-document-line--${fragment.kind}`;
						const span = document.createElement("span");
						span.className = "inquiry-document-line-text";
						span.textContent = fragment.text || "　";
						p.append(fragment.continued ? "" : fragment.label, span);
						container.append(p);
						const height = container.scrollHeight;
						const available = container.clientHeight;
						p.remove();
						return height <= available + 0.75;
					};
					const append = (f: Fragment) => {
						current?.fragments.push(f);
						const p = document.createElement("p");
						p.className = `inquiry-document-line inquiry-document-line--${f.kind}`;
						const span = document.createElement("span");
						span.className = "inquiry-document-line-text";
						span.textContent = f.text || "　";
						p.append(f.continued ? "" : f.label, span);
						container.append(p);
					};
					const nextPage = () => {
						current = { key: `page-${all.length + 1}`, fragments: [] };
						all.push(current);
						container.replaceChildren();
					};
					const segmenter = new Intl.Segmenter("zh-CN", {
						granularity: "grapheme",
					});
					for (let index = 0; index < source.length; index++) {
						const original = source[index];
						if (!original || cancelled) return;
						let remaining = Array.from(
							segmenter.segment(original.text),
							(s) => s.segment,
						);
						if (!remaining.length) remaining = [""];
						let part = 0;
						while (remaining.length) {
							const candidate = {
								...original,
								key: `${original.key}-${part}`,
								continued: part > 0,
								text: remaining.join(""),
							};
							if (fits(candidate)) {
								append(candidate);
								break;
							}
							let low = 1;
							let high = remaining.length;
							let max = 0;
							while (low <= high) {
								const mid = Math.floor((low + high) / 2);
								if (
									fits({ ...candidate, text: remaining.slice(0, mid).join("") })
								) {
									max = mid;
									low = mid + 1;
								} else high = mid - 1;
							}
							if (!max) {
								if (!current?.fragments.length)
									throw new Error("无法测量文书页面，请重新打开预览。");
								nextPage();
								continue;
							}
							append({ ...candidate, text: remaining.slice(0, max).join("") });
							remaining = remaining.slice(max);
							part++;
							nextPage();
						}
						if (index % 8 === 0)
							await new Promise<void>((resolve) =>
								requestAnimationFrame(() => resolve()),
							);
					}
					if (cancelled) return;
					container.replaceChildren();
					setPages(all.filter((p) => p.fragments.length));
					setPaginating(false);
				})().catch((cause) => {
					if (!cancelled) {
						const message =
							cause instanceof Error ? cause.message : "文书分页失败。";
						setError(message);
						setPaginating(false);
						errorRef.current?.(message);
					}
				});
			},
			preview ? 180 : 0,
		);
		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [source, preview]);
	useEffect(() => {
		if (!paginating && pages.length && !error) {
			const frame = requestAnimationFrame(() => readyRef.current?.());
			return () => cancelAnimationFrame(frame);
		}
	}, [paginating, pages, error]);
	const c = draft.content;
	return (
		<div ref={host} className="inquiry-document-pages">
			{preview && (
				<p className="mb-2 text-muted-foreground text-xs" role="status">
					{error ||
						(paginating
							? "正在分页…"
							: `A4 文书 · 共 ${pages.length} 页 · 点击内容可定位编辑`)}
				</p>
			)}
			{!preview && error && <p role="alert">{error}</p>}
			<div className="inquiry-document-stage">
				{pages.map((page, index) => (
					<div
						key={page.key}
						className="inquiry-document-page-frame"
						style={
							preview
								? { width: WIDTH * scale, height: HEIGHT * scale }
								: undefined
						}
					>
						<article
							className="inquiry-document-page"
							style={preview ? { transform: `scale(${scale})` } : undefined}
							aria-label={`询问调查笔录第 ${index + 1} 页，共 ${pages.length} 页`}
						>
							<header
								className={`inquiry-document-page-header inquiry-document-page-header--${index ? "continuation" : "first"}`}
							>
								{index === 0 && (
									<div className="inquiry-document-authority">
										{c.enforcementUnitName || "国家税务总局XXX税务局XXX稽查局"}
									</div>
								)}
								<h1>{index ? "询问（调查）笔录续页" : "询问（调查）笔录"}</h1>
								{index === 0 && (
									<div className="inquiry-document-inquiry-count">
										（第{toChineseUpperNumber(c.inquiryCount)}次）
									</div>
								)}
								<div className="inquiry-document-page-count">
									共{toChineseUpperNumber(pages.length)}页　第
									{toChineseUpperNumber(index + 1)}页
								</div>
							</header>
							<div className="inquiry-document-page-body">
								{page.fragments.map((fragment) => (
									<FragmentLine
										key={fragment.key}
										fragment={fragment}
										focus={preview ? focus : undefined}
									/>
								))}
							</div>
							<footer className="inquiry-document-signature-footer">
								<div>询问（调查）人签字：</div>
								<div>记录人签字：</div>
								<div>被询问（调查）人签字并押印：</div>
								<div className="inquiry-document-signature-date">
									<span>年　　月　　日</span>
									<span>— {index + 1} —</span>
								</div>
							</footer>
						</article>
					</div>
				))}
			</div>
			<article
				className="inquiry-document-page inquiry-document-measurement"
				aria-hidden="true"
			>
				<div ref={measure} className="inquiry-document-page-body" />
			</article>
		</div>
	);
}
