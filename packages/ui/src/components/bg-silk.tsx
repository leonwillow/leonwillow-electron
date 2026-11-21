/**
 * @file 不依赖 WebGL 的动态丝绸背景。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-11-21
 * 版本作用：共享 UI 基础层，随工作区维护。
 * 被调用：components/auth/auth-showcase.tsx。
 * 调用：ui/lib/utils、react。
 * 功能：在有限分辨率下绘制纹理，外提帧级三角函数常量，限制刷新频率并监听可见性、窗口失焦、视口相交和动态偏好。
 * 预期结果：装饰背景随主题变化，隐藏、离屏或失焦时暂停循环，无逐像素临时数组分配，高刷屏不空转帧回调。
 */
import { cn } from "@leonwillow-electron/ui/lib/utils";
import { useCallback, useEffect, useRef } from "react";

// 丝绸是低频背景纹理，不需要按显示器 DPR 逐像素重算。
const MAX_RENDER_EDGE = 320;
const FRAME_INTERVAL_MS = 1000 / 30;

interface SilkBackgroundProps {
	speed?: number;
	scale?: number;
	color?: string;
	noiseIntensity?: number;
	rotation?: number;
	className?: string;
}

function hexToRgb(hex: string): [number, number, number] {
	const clean = hex.replace("#", "");

	return [
		Number.parseInt(clean.slice(0, 2), 16),
		Number.parseInt(clean.slice(2, 4), 16),
		Number.parseInt(clean.slice(4, 6), 16),
	];
}

// 用坐标生成可重复噪声，不依赖每帧随机数，避免背景颗粒闪烁。
function noise(x: number, y: number): number {
	const G = Math.E;
	const rx = G * Math.sin(G * x);
	const ry = G * Math.sin(G * y);

	return (((rx * ry * (1.0 + x)) % 1) + 1) % 1;
}

export default function SilkBackground({
	speed = 5,
	scale = 1,
	color = "#7B7481",
	noiseIntensity = 1.5,
	rotation = 0,
	className = "",
}: SilkBackgroundProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const animRef = useRef<number>(0);
	const timerRef = useRef<number>(0);
	const timeRef = useRef<number>(0);
	const lastTimestampRef = useRef<number | null>(null);
	const lastPaintRef = useRef<number | null>(null);
	const imageDataRef = useRef<ImageData | null>(null);
	const reducedMotionRef = useRef(false);
	const focusedRef = useRef(
		typeof document === "undefined" ? true : document.hasFocus(),
	);
	const inViewRef = useRef(true);
	const drawRef = useRef<(timestamp: number) => void>(() => {});

	const [baseR, baseG, baseB] = hexToRgb(color);

	const stopSchedule = useCallback(() => {
		if (timerRef.current) {
			window.clearTimeout(timerRef.current);
			timerRef.current = 0;
		}
		if (animRef.current) {
			cancelAnimationFrame(animRef.current);
			animRef.current = 0;
		}
	}, []);

	const draw = useCallback(
		(timestamp: number) => {
			animRef.current = 0;
			const canvas = canvasRef.current;

			if (!canvas) return;
			const ctx = canvas.getContext("2d");

			if (!ctx) return;

			const w = canvas.width;
			const h = canvas.height;
			if (document.hidden || !inViewRef.current || w <= 0 || h <= 0) return;

			const shouldAnimate = !reducedMotionRef.current && focusedRef.current;
			if (shouldAnimate && lastPaintRef.current !== null) {
				const elapsed = timestamp - lastPaintRef.current;
				if (elapsed < FRAME_INTERVAL_MS) {
					timerRef.current = window.setTimeout(() => {
						timerRef.current = 0;
						animRef.current = requestAnimationFrame(drawRef.current);
					}, FRAME_INTERVAL_MS - elapsed);
					return;
				}
			}
			lastPaintRef.current = timestamp;

			// 限制恢复绘制时的时间步长，避免切回页面时纹理突然跳动。
			const delta = lastTimestampRef.current
				? Math.min((timestamp - lastTimestampRef.current) / 1000, 0.05)
				: 0.016;

			lastTimestampRef.current = timestamp;
			timeRef.current += 0.1 * delta;

			const t = timeRef.current;
			if (
				!imageDataRef.current ||
				imageDataRef.current.width !== w ||
				imageDataRef.current.height !== h
			) {
				imageDataRef.current = ctx.createImageData(w, h);
			}
			const imageData = imageDataRef.current;
			const data = imageData.data;

			const tOffset = speed * t;
			// 旋转角、归一化步长与时间偏移在单帧内恒定，外提避免逐像素重复三角运算与数组分配。
			const cosAngle = Math.cos(rotation);
			const sinAngle = Math.sin(rotation);
			const scaleSq = scale * scale;
			const stepX = scaleSq / w;
			const stepY = scaleSq / h;
			const innerTime = 0.02 * tOffset;
			const outerTime = 0.1 * tOffset;
			const noiseScale = (noiseIntensity / 15.0) * 255;

			for (let py = 0; py < h; py++) {
				const vScaled = py * stepY;
				const rowTexX = -sinAngle * vScaled;
				const rowTexY = cosAngle * vScaled;
				let idx = py * w * 4;

				for (let px = 0; px < w; px++) {
					const uScaled = px * stepX;
					const texX = cosAngle * uScaled + rowTexX;
					const texY =
						sinAngle * uScaled +
						rowTexY +
						0.03 * Math.sin(8.0 * texX - tOffset);
					const texSum = texX + texY;

					const inner =
						5.0 * (texSum + Math.cos(3.0 * texX + 5.0 * texY) + innerTime);
					const outer = 20.0 * (texSum - outerTime);
					const pattern = 0.6 + 0.4 * Math.sin(inner + Math.sin(outer));
					const adjust = noiseScale === 0 ? 0 : noise(px, py) * noiseScale;

					data[idx] = Math.min(255, Math.max(0, baseR * pattern - adjust));
					data[idx + 1] = Math.min(255, Math.max(0, baseG * pattern - adjust));
					data[idx + 2] = Math.min(255, Math.max(0, baseB * pattern - adjust));
					data[idx + 3] = 255;
					idx += 4;
				}
			}

			ctx.putImageData(imageData, 0, 0);
			if (shouldAnimate)
				animRef.current = requestAnimationFrame(drawRef.current);
		},
		[speed, scale, noiseIntensity, rotation, baseR, baseG, baseB],
	);

	useEffect(() => {
		const canvas = canvasRef.current;

		if (!canvas) return;

		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const { width, height } = entry.contentRect;
				const resolution = Math.min(
					1,
					MAX_RENDER_EDGE / Math.max(width, height, 1),
				);
				const nextWidth = Math.floor(width * resolution);
				const nextHeight = Math.floor(height * resolution);
				if (canvas.width === nextWidth && canvas.height === nextHeight)
					continue;
				canvas.width = nextWidth;
				canvas.height = nextHeight;
				imageDataRef.current = null;
				lastTimestampRef.current = null;
				lastPaintRef.current = null;
				stopSchedule();
				if (
					nextWidth > 0 &&
					nextHeight > 0 &&
					!document.hidden &&
					inViewRef.current
				)
					animRef.current = requestAnimationFrame(drawRef.current);
			}
		});

		observer.observe(canvas.parentElement ?? canvas);

		return () => {
			stopSchedule();
			observer.disconnect();
		};
	}, [stopSchedule]);

	// 属性、可见性、窗口焦点、视口相交和动态偏好变化共用重启流程，避免重复注册动画循环。
	useEffect(() => {
		drawRef.current = draw;
		const media = window.matchMedia("(prefers-reduced-motion: reduce)");
		const restart = () => {
			stopSchedule();
			lastTimestampRef.current = null;
			lastPaintRef.current = null;
			reducedMotionRef.current = media.matches;
			const canvas = canvasRef.current;
			if (
				canvas &&
				canvas.width > 0 &&
				canvas.height > 0 &&
				!document.hidden &&
				inViewRef.current
			)
				animRef.current = requestAnimationFrame(drawRef.current);
		};
		const onBlur = () => {
			focusedRef.current = false;
			stopSchedule();
		};
		const onFocus = () => {
			focusedRef.current = true;
			restart();
		};
		let intersection: IntersectionObserver | undefined;
		if (canvasRef.current && typeof IntersectionObserver !== "undefined") {
			intersection = new IntersectionObserver((entries) => {
				const visible = entries.some((entry) => entry.isIntersecting);
				if (inViewRef.current === visible) return;
				inViewRef.current = visible;
				if (visible) restart();
				else stopSchedule();
			});
			intersection.observe(canvasRef.current);
		}
		restart();
		document.addEventListener("visibilitychange", restart);
		window.addEventListener("blur", onBlur);
		window.addEventListener("focus", onFocus);
		media.addEventListener("change", restart);
		return () => {
			stopSchedule();
			intersection?.disconnect();
			document.removeEventListener("visibilitychange", restart);
			window.removeEventListener("blur", onBlur);
			window.removeEventListener("focus", onFocus);
			media.removeEventListener("change", restart);
		};
	}, [draw, stopSchedule]);

	return (
		<canvas
			ref={canvasRef}
			tabIndex={-1}
			aria-hidden="true"
			className={cn("block size-full", className)}
		/>
	);
}
