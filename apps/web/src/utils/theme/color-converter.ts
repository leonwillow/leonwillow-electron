// 迁移自 shadcnstudio/shadcn-studio，来源与适配见 docs/custom-theme-migration.md。
import chroma from "chroma-js";

export type ColorFormat = "hsl" | "rgb" | "oklch" | "hex";

const formatNumber = (num: number, precision = 5) => {
	return Number.isInteger(num) ? num.toString() : num.toFixed(precision);
};

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

				// Always include alpha if it's less than 1
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

				// Handle grayscale values in HSL
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

				// Handle grayscale values in OKLCH
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

export const convertToHSL = (colorValue: string): string =>
	colorFormatter(colorValue, "hsl");
