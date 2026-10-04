/**
 * @file 主题导出和调色盘的颜色格式转换。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：apps/web/test/custom-themes.test.ts、utils/theme/theme-style-generator.ts、utils/theme/shadows.ts、components/theme-editor/theme-color-panel.tsx、components/theme-editor/theme-control-panel.tsx。
 * 调用：chroma-js。
 * 功能：通过 chroma 解析并输出 HEX、RGB、HSL 或 OKLCH。
 * 预期结果：转换保留透明度，同格式色值避免无谓的精度损失。
 */
import chroma from "chroma-js";

export type ColorFormat = "hsl" | "rgb" | "oklch" | "hex";

const formatNumber = (num: number, precision = 5) => {
	return Number.isInteger(num) ? num.toString() : num.toFixed(precision);
};

/**
 * 转换 CSS 色值并保留透明度；同格式值原样保留以避免色域裁剪。
 * @param colorValue 独立可解析的颜色字符串。
 * @param format 导出格式，默认 OKLCH。
 * @returns 目标格式；解析失败时返回原值，输入合法性由调用边界负责。
 */
export const colorFormatter = (
	colorValue: string,
	format: ColorFormat = "oklch",
): string => {
	try {
		// chroma-js 3.2 原生解析现代 CSS 色值；避免旧预处理丢失透明度或把 1% HSL 饱和度当作 100%。
		const color = chroma(colorValue);
		const alpha = color.alpha();
		// 同格式导出保留原值，避免 RGB 中转裁剪 OKLCH 色域或损失精度。
		if (
			format !== "hex" &&
			colorValue.trim().toLowerCase().startsWith(`${format}(`)
		) {
			return colorValue.trim();
		}

		switch (format) {
			case "hex": {
				const hexColor = color.hex();

				return alpha < 1
					? hexColor.slice(0, 7) +
							Math.round(alpha * 255)
								.toString(16)
								.padStart(2, "0")
					: hexColor;
			}

			case "rgb": {
				const [r, g, b] = color.rgb();

				return alpha < 1
					? `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)} / ${alpha})`
					: `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)})`;
			}

			case "hsl": {
				const [h, s, l] = color.hsl();

				if (s === 0) {
					return alpha < 1
						? `hsl(0 0% ${Math.round(l * 100)}% / ${alpha})`
						: `hsl(0 0% ${Math.round(l * 100)}%)`;
				}

				return alpha < 1
					? `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}% / ${alpha})`
					: `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;
			}

			case "oklch": {
				const [l, c, h] = color.oklch();

				if (c < 0.002) {
					return alpha < 1
						? `oklch(${formatNumber(l)} 0 0 / ${formatNumber(alpha * 100)}%)`
						: `oklch(${formatNumber(l)} 0 0)`;
				}

				return alpha < 1
					? `oklch(${formatNumber(l)} ${formatNumber(c)} ${formatNumber(h)} / ${formatNumber(alpha * 100)}%)`
					: `oklch(${formatNumber(l)} ${formatNumber(c)} ${formatNumber(h)})`;
			}

			default:
				return colorValue;
		}
	} catch (error) {
		console.warn("Color conversion error:", error);

		return colorValue;
	}
};
