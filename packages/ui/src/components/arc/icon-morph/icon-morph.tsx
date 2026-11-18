/**
 * @file Arc UI 双状态 SVG 图标（明暗日月切换与全屏四角旋转）。
 * 创建时间：2026-11-06（@uiarc/icon-morph 注册源码）；修改时间：2026-11-18。
 * 版本作用：纯 CSR 共享 UI 层，仅保留项目实际使用的 SunMoonIcon 与 FullscreenIcon，保持可中断弹簧及减少动态效果处理。
 * 被调用：Web 侧栏明暗和全屏按钮。
 * 调用：motion/react、React、Arc motionTokens、ui/lib/utils。
 * 预期结果：图标在原地连续切换，不获取焦点，不改变按钮尺寸与语义。
 */
import { cn } from "@leonwillow-electron/ui/lib/utils";
import type { Transition } from "motion/react";
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode, SVGProps } from "react";
import { useId } from "react";
import { motionTokens } from "../motion-tokens";

interface IconMorphIconProps
	extends Omit<SVGProps<SVGSVGElement>, "ref" | "children"> {
	/** 图标的第二状态：SunMoonIcon 为深色月牙，FullscreenIcon 为收起全屏。 */
	state?: boolean;
	/** 渲染尺寸（px），默认 24。 */
	size?: number;
	/** 24 单位画布下的描边宽度，默认 1.75。 */
	strokeWidth?: number;
}

const { spring } = motionTokens;
const instant: Transition = { duration: 0 };

function useIds() {
	return useId().replace(/[^a-zA-Z0-9-]/g, "");
}

function Frame({
	size = 24,
	strokeWidth = 1.75,
	className,
	children,
	...rest
}: IconMorphIconProps & { children: ReactNode }) {
	return (
		<svg
			viewBox="0 0 24 24"
			width={size}
			height={size}
			fill="none"
			stroke="currentColor"
			strokeWidth={strokeWidth}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			focusable="false"
			className={cn("block shrink-0 overflow-visible", className)}
			{...rest}
		>
			{children}
		</svg>
	);
}

const RAYS = Array.from({ length: 8 }, (_, index) => {
	const angle = (index * Math.PI) / 4;
	const c = Math.cos(angle);
	const s = Math.sin(angle);
	const r = (value: number) => Math.round(value * 100) / 100;
	return `M${r(12 + c * 7.5)} ${r(12 + s * 7.5)} L${r(12 + c * 10)} ${r(12 + s * 10)}`;
});

/** 日月形态连续过渡：圆盘放大、右上角阴影切出月牙，光芒旋转收拢。 */
export function SunMoonIcon({ state = false, ...props }: IconMorphIconProps) {
	const reduced = !!useReducedMotion();
	const id = useIds();
	const t = reduced ? instant : spring.morph;
	const disc = { r: state ? 8.5 : 4.5 };
	const shadow = state ? { cx: 18, cy: 6, r: 6.5 } : { cx: 30, cy: -6, r: 6.5 };
	return (
		<Frame {...props}>
			<defs>
				<mask
					id={`${id}-bite`}
					maskUnits="userSpaceOnUse"
					x="-8"
					y="-8"
					width="40"
					height="40"
				>
					<rect
						x="-8"
						y="-8"
						width="40"
						height="40"
						fill="white"
						stroke="none"
					/>
					<motion.circle
						cx={30}
						cy={-6}
						r={6.5}
						fill="black"
						stroke="none"
						initial={false}
						animate={shadow}
						transition={t}
					/>
				</mask>
				<clipPath id={`${id}-disc`}>
					<motion.circle
						cx={12}
						cy={12}
						r={4.5}
						initial={false}
						animate={disc}
						transition={t}
					/>
				</clipPath>
			</defs>
			<motion.circle
				cx={12}
				cy={12}
				r={4.5}
				mask={`url(#${id}-bite)`}
				initial={false}
				animate={disc}
				transition={t}
			/>
			<motion.circle
				cx={30}
				cy={-6}
				r={6.5}
				clipPath={`url(#${id}-disc)`}
				initial={false}
				animate={shadow}
				transition={t}
			/>
			<motion.g
				initial={false}
				animate={
					state
						? { rotate: 90, scale: 0.4, opacity: 0 }
						: { rotate: 0, scale: 1, opacity: 1 }
				}
				transition={
					reduced
						? instant
						: {
								...spring.morph,
								opacity: { duration: motionTokens.duration.fast },
							}
				}
			>
				{RAYS.map((d) => (
					<path key={d} d={d} />
				))}
			</motion.g>
		</Frame>
	);
}

const EXPAND_CORNERS = [
	"M8 3H5a2 2 0 0 0-2 2v3",
	"M16 3h3a2 2 0 0 1 2 2v3",
	"M8 21H5a2 2 0 0 1-2-2v-3",
	"M16 21h3a2 2 0 0 0 2-2v-3",
];
const CORNER_TURNS = [180, -180, -180, 180];

/** 四角绕各自中心对称旋转，半周后的描边与原收起图标重合。 */
export function FullscreenIcon({
	state = false,
	...props
}: IconMorphIconProps) {
	const reduced = !!useReducedMotion();
	const t = reduced ? instant : spring.snappy;
	return (
		<Frame {...props}>
			{EXPAND_CORNERS.map((d, index) => (
				<motion.path
					key={d}
					d={d}
					style={{ transformBox: "fill-box", transformOrigin: "50% 50%" }}
					initial={false}
					animate={{ rotate: state ? CORNER_TURNS[index] : 0 }}
					transition={t}
				/>
			))}
		</Frame>
	);
}
