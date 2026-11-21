/**
 * @file 主题分析模式的画布覆盖层：悬停语义标签、锁定外框、盒模型色带、对齐虚线与测距标尺。
 * 创建时间：2026-11-21
 * 修改时间：2026-11-21
 * 版本作用：通过 Portal 浮于页面之上，仅在分析面板展开时挂载，绝不遮挡页面顶栏按钮。
 * 被调用：components/theme-inspector/theme-inspector.tsx。
 * 调用：react-dom、./dom-inspector、./theme-inspector-types。
 * 功能：绘制悬停/锁定框、外边距/内边距色带、对齐虚线、像素测距胶囊与优先展示中文语义的浮标。
 * 预期结果：全程 pointer-events: none，不拦截页面交互且自动避让视口边界。
 */
import { createPortal } from "react-dom";
import { computeDistanceGuides } from "./dom-inspector";
import type {
	BoxSpacingValues,
	InspectedElementSnapshot,
	RectSnapshot,
} from "./theme-inspector-types";

type ThemeInspectorOverlayProps = {
	hovered: InspectedElementSnapshot | null;
	locked: InspectedElementSnapshot | null;
	picking: boolean;
	showGuides: boolean;
	showBoxModel: boolean;
};

function BoxModelOverlay({
	rect,
	margin,
	padding,
}: {
	rect: RectSnapshot;
	margin: BoxSpacingValues;
	padding: BoxSpacingValues;
}) {
	return (
		<>
			{margin.top > 0 && (
				<div
					className="theme-inspector-margin-band"
					style={{
						left: rect.left - margin.left,
						top: rect.top - margin.top,
						width: rect.width + margin.left + margin.right,
						height: margin.top,
					}}
				/>
			)}
			{margin.bottom > 0 && (
				<div
					className="theme-inspector-margin-band"
					style={{
						left: rect.left - margin.left,
						top: rect.bottom,
						width: rect.width + margin.left + margin.right,
						height: margin.bottom,
					}}
				/>
			)}
			{margin.left > 0 && (
				<div
					className="theme-inspector-margin-band"
					style={{
						left: rect.left - margin.left,
						top: rect.top,
						width: margin.left,
						height: rect.height,
					}}
				/>
			)}
			{margin.right > 0 && (
				<div
					className="theme-inspector-margin-band"
					style={{
						left: rect.right,
						top: rect.top,
						width: margin.right,
						height: rect.height,
					}}
				/>
			)}

			{padding.top > 0 && (
				<div
					className="theme-inspector-padding-band"
					style={{
						left: rect.left,
						top: rect.top,
						width: rect.width,
						height: padding.top,
					}}
				/>
			)}
			{padding.bottom > 0 && (
				<div
					className="theme-inspector-padding-band"
					style={{
						left: rect.left,
						top: rect.bottom - padding.bottom,
						width: rect.width,
						height: padding.bottom,
					}}
				/>
			)}
			{padding.left > 0 && (
				<div
					className="theme-inspector-padding-band"
					style={{
						left: rect.left,
						top: rect.top + padding.top,
						width: padding.left,
						height: Math.max(0, rect.height - padding.top - padding.bottom),
					}}
				/>
			)}
			{padding.right > 0 && (
				<div
					className="theme-inspector-padding-band"
					style={{
						left: rect.right - padding.right,
						top: rect.top + padding.top,
						width: padding.right,
						height: Math.max(0, rect.height - padding.top - padding.bottom),
					}}
				/>
			)}
		</>
	);
}

export function ThemeInspectorOverlay({
	hovered,
	locked,
	picking,
	showGuides,
	showBoxModel,
}: ThemeInspectorOverlayProps) {
	const visibleHovered =
		hovered && (hovered.rect.width > 0 || hovered.rect.height > 0)
			? hovered
			: null;
	const visibleLocked =
		locked && (locked.rect.width > 0 || locked.rect.height > 0) ? locked : null;
	const activeForOverlay = visibleHovered ?? visibleLocked;

	let referenceRect: RectSnapshot | null = null;
	let primaryRect: RectSnapshot | null = null;
	if (showGuides && activeForOverlay) {
		if (
			visibleLocked &&
			visibleHovered &&
			visibleLocked.element !== visibleHovered.element
		) {
			primaryRect = visibleLocked.rect;
			referenceRect = visibleHovered.rect;
		} else if (activeForOverlay.element.parentElement) {
			const pRect =
				activeForOverlay.element.parentElement.getBoundingClientRect();
			primaryRect = activeForOverlay.rect;
			referenceRect = {
				left: pRect.left,
				top: pRect.top,
				width: pRect.width,
				height: pRect.height,
				right: pRect.right,
				bottom: pRect.bottom,
			};
		}
	}

	const guides =
		primaryRect && referenceRect
			? computeDistanceGuides(primaryRect, referenceRect)
			: [];

	const badgeTarget = visibleHovered ?? visibleLocked;
	const badgeTop = badgeTarget
		? badgeTarget.rect.top > 34
			? badgeTarget.rect.top - 28
			: Math.min(window.innerHeight - 32, badgeTarget.rect.bottom + 6)
		: 0;
	const badgeLeft = badgeTarget
		? Math.max(8, Math.min(badgeTarget.rect.left, window.innerWidth - 280))
		: 0;

	const primaryColorHint = badgeTarget
		? (badgeTarget.colors.background.tokenName ??
			badgeTarget.colors.color.tokenName ??
			badgeTarget.colors.border.tokenName)
		: null;

	return createPortal(
		<div
			data-theme-inspector="true"
			aria-hidden="true"
			className="theme-inspector-overlay"
		>
			{showBoxModel && activeForOverlay && (
				<BoxModelOverlay
					rect={activeForOverlay.rect}
					margin={activeForOverlay.layout.margin}
					padding={activeForOverlay.layout.padding}
				/>
			)}

			{showGuides && primaryRect && (
				<>
					<div
						className="theme-inspector-guide-line"
						data-axis="vertical"
						style={{
							left: primaryRect.left,
							top: 0,
							height: "100vh",
							width: 1,
						}}
					/>
					<div
						className="theme-inspector-guide-line"
						data-axis="vertical"
						style={{
							left: primaryRect.right,
							top: 0,
							height: "100vh",
							width: 1,
						}}
					/>
					<div
						className="theme-inspector-guide-line"
						data-axis="horizontal"
						style={{ left: 0, top: primaryRect.top, width: "100vw", height: 1 }}
					/>
					<div
						className="theme-inspector-guide-line"
						data-axis="horizontal"
						style={{
							left: 0,
							top: primaryRect.bottom,
							width: "100vw",
							height: 1,
						}}
					/>
				</>
			)}

			{visibleHovered &&
				(!visibleLocked ||
					visibleHovered.element !== visibleLocked.element) && (
					<div
						className="theme-inspector-hover-box"
						style={{
							left: visibleHovered.rect.left,
							top: visibleHovered.rect.top,
							width: visibleHovered.rect.width,
							height: visibleHovered.rect.height,
						}}
					/>
				)}

			{visibleLocked && (
				<div
					className="theme-inspector-locked-box"
					style={{
						left: visibleLocked.rect.left,
						top: visibleLocked.rect.top,
						width: visibleLocked.rect.width,
						height: visibleLocked.rect.height,
					}}
				/>
			)}

			{guides.map((g, idx) => (
				<div key={`${g.axis}-${idx}-${g.distancePx}`}>
					<div
						className="theme-inspector-measure-line"
						style={
							g.axis === "horizontal"
								? {
										left: Math.min(g.x1, g.x2),
										top: g.y1,
										width: Math.abs(g.x2 - g.x1),
										height: 1,
									}
								: {
										left: g.x1,
										top: Math.min(g.y1, g.y2),
										width: 1,
										height: Math.abs(g.y2 - g.y1),
									}
						}
					/>
					<span
						className="theme-inspector-measure-pill font-medium font-mono text-caption tabular-nums"
						style={{ left: g.labelX, top: g.labelY }}
					>
						{g.distancePx}
					</span>
				</div>
			))}

			{badgeTarget && picking && (
				<div
					className="theme-inspector-hover-badge text-caption"
					style={{ left: badgeLeft, top: badgeTop }}
				>
					<span className="font-semibold">{badgeTarget.semanticLabel}</span>
					{primaryColorHint && (
						<span className="rounded-sm bg-primary/25 px-1 font-mono opacity-95">
							{primaryColorHint}
						</span>
					)}
					<span className="font-mono opacity-75">
						{Math.round(badgeTarget.rect.width)}×
						{Math.round(badgeTarget.rect.height)}
					</span>
				</div>
			)}
		</div>,
		document.body,
	);
}
