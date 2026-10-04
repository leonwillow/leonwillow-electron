/**
 * @file 主题草稿的 CSS 导出。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：apps/web/test/custom-themes.test.ts、components/theme-editor/theme-control-panel.tsx。
 * 调用：lib/custom-themes、types/theme、./color-converter、./shadows。
 * 功能：输出浅深色变量、字体、圆角及需要的阴影令牌。
 * 预期结果：复制的文本可供本项目导入，界面缩放规则保持独立。
 */
import { hasCustomShadow } from "@/lib/custom-themes";
import type { ThemeStyles } from "@/types/theme";
import type { ColorFormat } from "./color-converter";
import { colorFormatter } from "./color-converter";
import { getShadowMap } from "./shadows";

const generateShadowVariables = (shadowMap: Record<string, string>): string => {
	return `
  --shadow-2xs: ${shadowMap["shadow-2xs"]};
  --shadow-xs: ${shadowMap["shadow-xs"]};
  --shadow-sm: ${shadowMap["shadow-sm"]};
  --shadow: ${shadowMap.shadow};
  --shadow-md: ${shadowMap["shadow-md"]};
  --shadow-lg: ${shadowMap["shadow-lg"]};
  --shadow-xl: ${shadowMap["shadow-xl"]};
  --shadow-2xl: ${shadowMap["shadow-2xl"]};`;
};

/**
 * 将草稿编码为 :root/.dark 变量块，供复制和再次导入。
 * @param styles 已补齐且校验的浅深色样式；light 提供全局字体和圆角。
 * @param colorFormat 导出颜色格式；不改变字号与界面缩放。
 * @returns CSS 文本；不插入文档、不写入存储。
 */
export const generateThemeCode = (
	styles: ThemeStyles,
	colorFormat: ColorFormat = "oklch",
): string => {
	if (!("light" in styles) || !("dark" in styles)) {
		throw new Error("Invalid theme styles: missing light or dark mode");
	}

	const formatColor = (color: string | undefined) =>
		color ? colorFormatter(color, colorFormat) : "";

	return `:root {
  --background: ${formatColor(styles.light.background)};
  --foreground: ${formatColor(styles.light.foreground)};
  --card: ${formatColor(styles.light.card)};
  --card-foreground: ${formatColor(styles.light["card-foreground"])};
  --popover: ${formatColor(styles.light.popover)};
  --popover-foreground: ${formatColor(styles.light["popover-foreground"])};
  --primary: ${formatColor(styles.light.primary)};
  --primary-foreground: ${formatColor(styles.light["primary-foreground"])};
  --secondary: ${formatColor(styles.light.secondary)};
  --secondary-foreground: ${formatColor(styles.light["secondary-foreground"])};
  --muted: ${formatColor(styles.light.muted)};
  --muted-foreground: ${formatColor(styles.light["muted-foreground"])};
  --accent: ${formatColor(styles.light.accent)};
  --accent-foreground: ${formatColor(styles.light["accent-foreground"])};
  --destructive: ${formatColor(styles.light.destructive)};
  --destructive-foreground: ${formatColor(styles.light["destructive-foreground"])};
  --border: ${formatColor(styles.light.border)};
  --input: ${formatColor(styles.light.input)};
  --ring: ${formatColor(styles.light.ring)};
  --chart-1: ${formatColor(styles.light["chart-1"])};
  --chart-2: ${formatColor(styles.light["chart-2"])};
  --chart-3: ${formatColor(styles.light["chart-3"])};
  --chart-4: ${formatColor(styles.light["chart-4"])};
  --chart-5: ${formatColor(styles.light["chart-5"])};
  --sidebar: ${formatColor(styles.light.sidebar)};
  --sidebar-foreground: ${formatColor(styles.light["sidebar-foreground"])};
  --sidebar-primary: ${formatColor(styles.light["sidebar-primary"])};
  --sidebar-primary-foreground: ${formatColor(styles.light["sidebar-primary-foreground"])};
  --sidebar-accent: ${formatColor(styles.light["sidebar-accent"])};
  --sidebar-accent-foreground: ${formatColor(styles.light["sidebar-accent-foreground"])};
  --sidebar-border: ${formatColor(styles.light["sidebar-border"])};
  --sidebar-ring: ${formatColor(styles.light["sidebar-ring"])};

  --font-sans: ${styles.light["font-sans"]};

  --radius: ${styles.light.radius};
  ${hasCustomShadow(styles.light) ? generateShadowVariables(getShadowMap(styles.light, colorFormat)) : ""}
  ${Object.entries(styles.light)
		.filter(([key]) => key.startsWith("shadow-"))
		.map(
			([key, value]) =>
				`--${key}: ${key === "shadow-color" ? formatColor(value) : value};`,
		)
		.join("\n  ")}
  ${styles.light["letter-spacing"] ? `--letter-spacing: ${styles.light["letter-spacing"]};` : ""}
}

.dark {
  --background: ${formatColor(styles.dark.background)};
  --foreground: ${formatColor(styles.dark.foreground)};
  --card: ${formatColor(styles.dark.card)};
  --card-foreground: ${formatColor(styles.dark["card-foreground"])};
  --popover: ${formatColor(styles.dark.popover)};
  --popover-foreground: ${formatColor(styles.dark["popover-foreground"])};
  --primary: ${formatColor(styles.dark.primary)};
  --primary-foreground: ${formatColor(styles.dark["primary-foreground"])};
  --secondary: ${formatColor(styles.dark.secondary)};
  --secondary-foreground: ${formatColor(styles.dark["secondary-foreground"])};
  --muted: ${formatColor(styles.dark.muted)};
  --muted-foreground: ${formatColor(styles.dark["muted-foreground"])};
  --accent: ${formatColor(styles.dark.accent)};
  --accent-foreground: ${formatColor(styles.dark["accent-foreground"])};
  --destructive: ${formatColor(styles.dark.destructive)};
  --destructive-foreground: ${formatColor(styles.dark["destructive-foreground"])};
  --border: ${formatColor(styles.dark.border)};
  --input: ${formatColor(styles.dark.input)};
  --ring: ${formatColor(styles.dark.ring)};
  --chart-1: ${formatColor(styles.dark["chart-1"])};
  --chart-2: ${formatColor(styles.dark["chart-2"])};
  --chart-3: ${formatColor(styles.dark["chart-3"])};
  --chart-4: ${formatColor(styles.dark["chart-4"])};
  --chart-5: ${formatColor(styles.dark["chart-5"])};
  --sidebar: ${formatColor(styles.dark.sidebar)};
  --sidebar-foreground: ${formatColor(styles.dark["sidebar-foreground"])};
  --sidebar-primary: ${formatColor(styles.dark["sidebar-primary"])};
  --sidebar-primary-foreground: ${formatColor(styles.dark["sidebar-primary-foreground"])};
  --sidebar-accent: ${formatColor(styles.dark["sidebar-accent"])};
  --sidebar-accent-foreground: ${formatColor(styles.dark["sidebar-accent-foreground"])};
  --sidebar-border: ${formatColor(styles.dark["sidebar-border"])};
  --sidebar-ring: ${formatColor(styles.dark["sidebar-ring"])};
  ${styles.dark["letter-spacing"] ? `--letter-spacing: ${styles.dark["letter-spacing"]};` : ""}
  ${hasCustomShadow(styles.dark) ? generateShadowVariables(getShadowMap(styles.dark, colorFormat)) : ""}
  ${Object.entries(styles.dark)
		.filter(([key]) => key.startsWith("shadow-"))
		.map(
			([key, value]) =>
				`--${key}: ${key === "shadow-color" ? formatColor(value) : value};`,
		)
		.join("\n  ")}
}
${styles.light["letter-spacing"] && styles.light["letter-spacing"] !== "0em" ? "\n\nbody {\n  letter-spacing: var(--letter-spacing);\n}" : ""}`;
};
