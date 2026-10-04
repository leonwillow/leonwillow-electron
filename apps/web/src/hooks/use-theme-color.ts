/**
 * @file CSS 主题色到 Canvas RGB 色值的适配。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：components/auth/auth-showcase.tsx。
 * 调用：react。
 * 功能：监听根元素主题变化，用像素采样解析实际颜色。
 * 预期结果：背景随预设和草稿变化，颜色无效时保留最后有效值。
 */
import { useEffect, useState } from "react";

/**
 * 将根元素的 CSS 颜色变量采样为 Canvas 背景使用的六位 HEX。
 * @param cssVar CSS 自定义属性名，例如 `--primary`。
 * @param fallback 首次采样前使用的颜色；无效值或全透明颜色保留上次结果。
 * @returns 随根元素 class/style 变化更新的 RGB 色值。
 */
export function useThemeColorHex(cssVar: string, fallback: string): string {
	const [hex, setHex] = useState(fallback);

	useEffect(() => {
		const resolve = () => {
			const raw = getComputedStyle(document.documentElement)
				.getPropertyValue(cssVar)
				.trim();

			if (!raw || !CSS.supports("color", raw)) return;

			// fillStyle 的序列化格式因浏览器而异；采样像素可统一取得 sRGB 通道。
			const canvas = document.createElement("canvas");

			canvas.width = 1;
			canvas.height = 1;

			const ctx = canvas.getContext("2d", { willReadFrequently: true });

			if (!ctx) return;

			ctx.fillStyle = "#000";
			ctx.fillStyle = raw;
			ctx.fillRect(0, 0, 1, 1);

			const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;

			// 全透明色没有可用于不透明背景的 RGB；纯黑则是有效主题色。
			if (r === undefined || g === undefined || b === undefined || a === 0)
				return;

			const toHex = (n: number) => n.toString(16).padStart(2, "0");

			setHex(`#${toHex(r)}${toHex(g)}${toHex(b)}`);
		};

		resolve();

		const observer = new MutationObserver(resolve);

		// class 表示明暗模式，style 承载预设和未保存草稿的颜色。
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class", "style"],
		});

		return () => observer.disconnect();
	}, [cssVar]);

	return hex;
}
