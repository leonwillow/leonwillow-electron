/**
 * @file 不依赖 WebGL 的动态丝绸背景。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：共享 UI 基础层，随工作区维护。
 * 被调用：components/auth/auth-showcase.tsx。
 * 调用：ui/lib/utils、react。
 * 功能：在有限分辨率下绘制纹理，限制刷新频率并监听可见性和动态偏好。
 * 预期结果：装饰背景随主题变化，隐藏时暂停，减少动态模式只绘制静态帧。
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

function rotateUV(u: number, v: number, angle: number): [number, number] {
	const c = Math.cos(angle);
	const s = Math.sin(angle);

	return [c * u - s * v, s * u + c * v];
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
	const timeRef = useRef<number>(0);
	const lastTimestampRef = useRef<number | null>(null);
	const lastPaintRef = useRef<number | null>(null);
	const imageDataRef = useRef<ImageData | null>(null);
	const reducedMotionRef = useRef(false);
	const drawRef = useRef<(timestamp: number) => void>(() => {});

	const [baseR, baseG, baseB] = hexToRgb(color);

	const draw = useCallback(
		(timestamp: number) => {
			const canvas = canvasRef.current;

			if (!canvas) return;
			const ctx = canvas.getContext("2d");

			if (!ctx) return;

			const w = canvas.width;
			const h = canvas.height;
			if (document.hidden || w <= 0 || h <= 0) return;

			if (
				!reducedMotionRef.current &&
				lastPaintRef.current !== null &&
				timestamp - lastPaintRef.current < FRAME_INTERVAL_MS
			) {
				animRef.current = requestAnimationFrame(drawRef.current);
				return;
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

			for (let py = 0; py < h; py++) {
				for (let px = 0; px < w; px++) {
					// 像素坐标归一化后再旋转，使纹理方向不依赖绘制分辨率。
					const u = px / w;
					const v = py / h;

					const [ru, rv] = rotateUV(u * scale, v * scale, rotation);
					const texX = ru * scale;
					let texY = rv * scale;

					// Y 方向缓慢扰动叠加两层正弦波，形成连续的丝绸褶皱。
					texY += 0.03 * Math.sin(8.0 * texX - tOffset);

					const inner =
						5.0 *
						(texX + texY + Math.cos(3.0 * texX + 5.0 * texY) + 0.02 * tOffset);

					const outer = 20.0 * (texX + texY - 0.1 * tOffset);

					const pattern = 0.6 + 0.4 * Math.sin(inner + Math.sin(outer));

					const rnd = noiseIntensity === 0 ? 0 : noise(px, py);

					const adjust = (rnd / 15.0) * noiseIntensity;
					const r = Math.min(
						255,
						Math.max(0, (baseR / 255) * pattern * 255 - adjust * 255),
					);
					const g = Math.min(
						255,
						Math.max(0, (baseG / 255) * pattern * 255 - adjust * 255),
					);
					const b = Math.min(
						255,
						Math.max(0, (baseB / 255) * pattern * 255 - adjust * 255),
					);

					const idx = (py * w + px) * 4;

					data[idx] = r;
					data[idx + 1] = g;
					data[idx + 2] = b;
					data[idx + 3] = 255;
				}
			}

			ctx.putImageData(imageData, 0, 0);
			if (!reducedMotionRef.current)
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
				canvas.width = Math.floor(width * resolution);
				canvas.height = Math.floor(height * resolution);
				imageDataRef.current = null;
				lastTimestampRef.current = null;
				lastPaintRef.current = null;
				cancelAnimationFrame(animRef.current);
				animRef.current = requestAnimationFrame(drawRef.current);
			}
		});

		observer.observe(canvas.parentElement ?? canvas);

		return () => observer.disconnect();
	}, []);

	// 属性、可见性和动态偏好变化共用重启流程，避免重复注册动画循环。
	useEffect(() => {
		drawRef.current = draw;
		const media = window.matchMedia("(prefers-reduced-motion: reduce)");
		const restart = () => {
			cancelAnimationFrame(animRef.current);
			lastTimestampRef.current = null;
			lastPaintRef.current = null;
			reducedMotionRef.current = media.matches;
			if (!document.hidden)
				animRef.current = requestAnimationFrame(drawRef.current);
		};
		restart();
		document.addEventListener("visibilitychange", restart);
		media.addEventListener("change", restart);
		return () => {
			cancelAnimationFrame(animRef.current);
			document.removeEventListener("visibilitychange", restart);
			media.removeEventListener("change", restart);
		};
	}, [draw]);

	return (
		<canvas
			ref={canvasRef}
			tabIndex={-1}
			aria-hidden="true"
			className={cn("block size-full", className)}
		/>
	);
}
