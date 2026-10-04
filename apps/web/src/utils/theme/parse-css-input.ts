/**
 * @file 主题变量文本的轻量提取器。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：apps/web/test/custom-themes.test.ts、utils/theme/theme-draft.ts、utils/theme/css-import.ts。
 * 调用：configs/theme-variables、types/theme。
 * 功能：识别简单 :root/.dark 块并解析颜色与阴影参数。
 * 预期结果：返回部分变量供导入层校验；不会执行 CSS。
 */
import { EDITABLE_STYLE_KEYS } from "@/configs/theme-variables";
import type { ThemeStyleProps } from "@/types/theme";

const VARIABLE_NAMES = [...EDITABLE_STYLE_KEYS, "radius", "font-sans"];
const NON_COLOR_VARIABLES: readonly string[] = [
	"radius",
	"font-sans",
	"letter-spacing",
	"shadow-opacity",
	"shadow-blur",
	"shadow-spread",
	"shadow-offset-x",
	"shadow-offset-y",
];
const VARIABLE_PREFIX = "--";

/**
 * 提取 :root 和 .dark 中白名单变量，兼容省略 hsl() 的旧式 HSL 值。
 * @param input CSS 文本；仅识别简单变量块，不执行样式或处理完整 CSS 语法。
 * @returns 浅深色的部分变量；缺失字段保持缺失，值由导入边界进一步校验。
 */
export const parseCssInput = (input: string) => {
	const lightColors: Partial<ThemeStyleProps> = {};
	const darkColors: Partial<ThemeStyleProps> = {};

	try {
		const rootContent = extractCssBlockContent(input, ":root");
		const darkContent = extractCssBlockContent(input, ".dark");

		if (rootContent) {
			parseColorVariables(rootContent, lightColors, VARIABLE_NAMES);
		}

		if (darkContent) {
			parseColorVariables(darkContent, darkColors, VARIABLE_NAMES);
		}
	} catch (error) {
		console.error("Error parsing CSS input:", error);
	}

	return { lightColors, darkColors };
};

const extractCssBlockContent = (
	input: string,
	selector: string,
): string | null => {
	const regex = new RegExp(`${escapeRegExp(selector)}\\s*{([^}]+)}`);

	return input.match(regex)?.[1]?.trim() || null;
};

const parseColorVariables = (
	cssContent: string,
	target: Partial<ThemeStyleProps>,
	validNames: string[],
) => {
	const variableDeclarations = cssContent.match(/--[^:]+:\s*[^;]+/g) || [];

	variableDeclarations.forEach((declaration) => {
		const [name, value] = declaration.split(":").map((part) => part.trim());
		if (name === undefined || value === undefined) return;
		const cleanName = name.replace(VARIABLE_PREFIX, "");

		if (validNames.includes(cleanName)) {
			if (NON_COLOR_VARIABLES.includes(cleanName)) {
				target[cleanName as keyof ThemeStyleProps] = value;

				return;
			}

			const colorValue = processColorValue(value);

			target[cleanName as keyof ThemeStyleProps] = colorValue;
		}
	});
};

const processColorValue = (value: string): string => {
	if (/^\d/.test(value)) {
		return `hsl(${value})`;
	}

	const cleanValue = value.trim();

	if (/^(rgb|hsl|oklch)/.test(cleanValue)) {
		return cleanValue.replace(/\s+/g, " ");
	}

	return cleanValue;
};

const escapeRegExp = (string: string): string => {
	return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

/**
 * 读取阴影参数；优先采用 shadow-color 等独立参数，否则从阴影简写估算。
 * @param cssContent 含 :root/.dark 的 CSS 文本。
 * @returns 两种模式的部分样式；调用方只合并实际包含阴影声明的模式。
 */
export const parseShadowVariables = (cssContent: string) => {
	const lightShadows: Partial<ThemeStyleProps> = {};
	const darkShadows: Partial<ThemeStyleProps> = {};

	try {
		const rootContent = extractCssBlockContent(cssContent, ":root");
		const darkContent = extractCssBlockContent(cssContent, ".dark");

		if (rootContent) {
			extractBasicShadowProperties(rootContent, lightShadows);
		}

		if (darkContent) {
			extractBasicShadowProperties(darkContent, darkShadows);
		}
	} catch (error) {
		console.error("Error parsing shadow variables:", error);
	}

	return { lightShadows, darkShadows };
};

/**
 * 写入一个模式的阴影参数：显式参数优先，否则优先选择较小的单层阴影。
 * @param cssContent 当前模式的变量块。
 * @param target 要写入的样式对象；缺省阴影参数采用本地默认值。
 * @returns 无返回值；此简写解析仅覆盖项目支持的阴影格式。
 */
const extractBasicShadowProperties = (
	cssContent: string,
	target: Partial<ThemeStyleProps>,
) => {
	const directPropertiesRegex =
		/--shadow-(color|opacity|blur|spread|offset-x|offset-y):\s*([^;]+);/g;

	target["shadow-offset-x"] = "0";
	target["shadow-offset-y"] = "1px";
	target["shadow-blur"] = "3px";
	target["shadow-spread"] = "0px";
	target["shadow-color"] = "hsl(0 0% 0%)";
	target["shadow-opacity"] = "0.1";

	let foundDirectProperties = false;

	for (const match of cssContent.matchAll(directPropertiesRegex)) {
		if (match[1] === undefined || match[2] === undefined) continue;
		const property = `shadow-${match[1]}`;
		const value = match[2].trim();

		target[property as keyof ThemeStyleProps] = value;
		foundDirectProperties = true;
	}

	if (foundDirectProperties) {
		return;
	}

	const shadowRegex = /--shadow(?:-[a-z0-9]+)?:\s*([^;]+);/g;
	const shadowValues = [];

	for (const match of cssContent.matchAll(shadowRegex)) {
		if (match[1] === undefined) continue;
		shadowValues.push({
			value: match[1],
			hasComma: match[1].includes(","),
			name: match[0].match(/--([^:]+):/)?.[1] || "",
		});
	}

	if (shadowValues.length === 0) {
		return;
	}

	const orderedNames = ["shadow-2xs", "shadow-xs", "shadow-sm", "shadow"];

	const bestShadow =
		shadowValues
			.filter((s) => !s.hasComma)
			.sort((a, b) => {
				const aIndex = orderedNames.indexOf(a.name);
				const bIndex = orderedNames.indexOf(b.name);

				if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
				if (aIndex !== -1) return -1;
				if (bIndex !== -1) return 1;

				return 0;
			})[0] || shadowValues[0];

	if (!bestShadow) return;

	const parts = (bestShadow.value.split(",")[0] ?? "").trim().split(/\s+/);

	if (parts.length >= 5) {
		target["shadow-offset-x"] = parts[0];
		target["shadow-offset-y"] = parts[1];
		target["shadow-blur"] = parts[2];
		target["shadow-spread"] = parts[3];

		const colorPart = parts.slice(4).join(" ");

		const colorRegex = /(?:hsl|rgb|oklch)\(([^/]+)(?:\/\s*([^)]+))?\)/;
		const colorMatch = colorPart.match(colorRegex);

		if (colorMatch) {
			const [, colorValues, opacity] = colorMatch;
			const colorType = colorPart.substring(0, 3);

			target["shadow-color"] =
				`${colorType}${colorType === "okl" ? "ch" : ""}(${colorValues})`;

			if (opacity) {
				target["shadow-opacity"] = formatOpacity(opacity);
			}
		}
	}
};

/**
 * 按百分号区分比例与百分比：1 表示不透明，12.5% 表示 0.125。
 * @param opacityStr 阴影颜色中斜杠后的透明度文本。
 * @returns 比例字符串；无法解析时使用 0.1，合法范围交给导入校验。
 */
const formatOpacity = (opacityStr: string): string => {
	const value = Number.parseFloat(opacityStr);
	if (!Number.isFinite(value)) return "0.1";
	return String(opacityStr.trim().endsWith("%") ? value / 100 : value);
};
