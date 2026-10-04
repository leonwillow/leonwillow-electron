/**
 * @file 阴影参数到各档 CSS 阴影的纯计算。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：apps/web/test/custom-themes.test.ts、utils/theme-script.ts、utils/theme/theme-style-generator.ts。
 * 调用：types/theme、./color-converter。
 * 功能：组合偏移、模糊、扩散与透明度，生成单层和双层阴影。
 * 预期结果：预览和导出使用相同阴影计算，不在算法中写 DOM。
 */
import type { ThemeStyleProps } from "@/types/theme";
import type { ColorFormat } from "./color-converter";

import { colorFormatter } from "./color-converter";

/**
 * 由基础阴影参数生成八档 CSS 阴影；大档增加第二层，最终不透明度最多为 1。
 * @param styles 当前模式的部分样式，未提供的阴影参数使用默认值。
 * @param colorFormat 颜色输出格式，默认 OKLCH。
 * @returns 不含 -- 前缀的阴影变量映射；不修改 DOM。
 */
export const getShadowMap = (
	styles: Partial<ThemeStyleProps>,
	colorFormat: ColorFormat = "oklch",
) => {
	const shadowColor = styles["shadow-color"] || "hsl(0 0% 0%)";
	const formattedColor = colorFormatter(shadowColor, colorFormat);
	const offsetX = styles["shadow-offset-x"] || "0px";
	const offsetY = styles["shadow-offset-y"] || "1px";
	const blur = styles["shadow-blur"] || "2px";
	const spread = styles["shadow-spread"] || "0px";
	const opacity = Number.parseFloat(styles["shadow-opacity"] || "0.1");

	const createColorWithOpacity = (baseOpacity: number) => {
		const finalOpacity = Math.min(1, opacity * baseOpacity).toFixed(2);

		if (colorFormat === "oklch") {
			const oklchValues =
				formattedColor
					.match(/oklch\((.*?)\)/)?.[1]
					?.split("/")[0]
					?.trim() || "0 0 0";

			return `oklch(${oklchValues} / ${finalOpacity})`;
		}
		if (colorFormat === "hsl") {
			const hslValues =
				formattedColor
					.match(/hsl\((.*?)\)/)?.[1]
					?.split("/")[0]
					?.trim() || "0 0% 0%";

			return `hsl(${hslValues} / ${finalOpacity})`;
		}
		if (colorFormat === "rgb") {
			const rgbValues =
				formattedColor
					.match(/rgb\((.*?)\)/)?.[1]
					?.split("/")[0]
					?.trim() || "0 0 0";

			return `rgb(${rgbValues} / ${finalOpacity})`;
		}

		return formattedColor;
	};

	const secondLayer = (fixedOffsetY: string, fixedBlur: string): string => {
		const offsetX2 = offsetX;

		const offsetY2 = fixedOffsetY;

		const blur2 = fixedBlur;

		const spread2 =
			(Number.parseFloat(spread?.replace("px", "") ?? "0") - 1).toString() +
			"px";

		const color2 = createColorWithOpacity(1.0);

		return `${offsetX2} ${offsetY2} ${blur2} ${spread2} ${color2}`;
	};

	const shadowMap: { [key: string]: string } = {
		"shadow-2xs": `${offsetX} ${offsetY} ${blur} ${spread} ${createColorWithOpacity(0.5)}`,
		"shadow-xs": `${offsetX} ${offsetY} ${blur} ${spread} ${createColorWithOpacity(0.5)}`,
		"shadow-2xl": `${offsetX} ${offsetY} ${blur} ${spread} ${createColorWithOpacity(2.5)}`,

		"shadow-sm": `${offsetX} ${offsetY} ${blur} ${spread} ${createColorWithOpacity(1.0)}, ${secondLayer("1px", "2px")}`,
		shadow: `${offsetX} ${offsetY} ${blur} ${spread} ${createColorWithOpacity(1.0)}, ${secondLayer("1px", "2px")}`,
		"shadow-md": `${offsetX} ${offsetY} ${blur} ${spread} ${createColorWithOpacity(1.0)}, ${secondLayer("2px", "4px")}`,
		"shadow-lg": `${offsetX} ${offsetY} ${blur} ${spread} ${createColorWithOpacity(1.0)}, ${secondLayer("4px", "6px")}`,
		"shadow-xl": `${offsetX} ${offsetY} ${blur} ${spread} ${createColorWithOpacity(1.0)}, ${secondLayer("8px", "10px")}`,
	};

	return shadowMap;
};
