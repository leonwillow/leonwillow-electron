// 迁移自 shadcnstudio/shadcn-studio，来源与适配见 docs/custom-theme-migration.md。
// Type Imports

// Config Imports
import { hasCustomShadow } from "@/lib/custom-themes";
import type { ThemeStyleProps, ThemeStyles } from "@/types/theme";
import type { ColorFormat } from "./color-converter";
// Component Imports
import { colorFormatter } from "./color-converter";
import { getShadowMap } from "./shadows";

type ThemeType = {
	light: ThemeStyleProps;
	dark: ThemeStyleProps;
};

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

export const generateThemeCode = (
	styles: ThemeStyles,
	colorFormat: ColorFormat = "oklch",
): string => {
	if (!("light" in styles) || !("dark" in styles)) {
		throw new Error("Invalid theme styles: missing light or dark mode");
	}

	const formatColor = (color: string | undefined) =>
		color ? colorFormatter(color, colorFormat) : "";

	const themeStyles = styles as ThemeType;

	return `:root {
  --background: ${formatColor(themeStyles.light.background)};
  --foreground: ${formatColor(themeStyles.light.foreground)};
  --card: ${formatColor(themeStyles.light.card)};
  --card-foreground: ${formatColor(themeStyles.light["card-foreground"])};
  --popover: ${formatColor(themeStyles.light.popover)};
  --popover-foreground: ${formatColor(themeStyles.light["popover-foreground"])};
  --primary: ${formatColor(themeStyles.light.primary)};
  --primary-foreground: ${formatColor(themeStyles.light["primary-foreground"])};
  --secondary: ${formatColor(themeStyles.light.secondary)};
  --secondary-foreground: ${formatColor(themeStyles.light["secondary-foreground"])};
  --muted: ${formatColor(themeStyles.light.muted)};
  --muted-foreground: ${formatColor(themeStyles.light["muted-foreground"])};
  --accent: ${formatColor(themeStyles.light.accent)};
  --accent-foreground: ${formatColor(themeStyles.light["accent-foreground"])};
  --destructive: ${formatColor(themeStyles.light.destructive)};
  --destructive-foreground: ${formatColor(themeStyles.light["destructive-foreground"])};
  --border: ${formatColor(themeStyles.light.border)};
  --input: ${formatColor(themeStyles.light.input)};
  --ring: ${formatColor(themeStyles.light.ring)};
  --chart-1: ${formatColor(themeStyles.light["chart-1"])};
  --chart-2: ${formatColor(themeStyles.light["chart-2"])};
  --chart-3: ${formatColor(themeStyles.light["chart-3"])};
  --chart-4: ${formatColor(themeStyles.light["chart-4"])};
  --chart-5: ${formatColor(themeStyles.light["chart-5"])};
  --sidebar: ${formatColor(themeStyles.light.sidebar)};
  --sidebar-foreground: ${formatColor(themeStyles.light["sidebar-foreground"])};
  --sidebar-primary: ${formatColor(themeStyles.light["sidebar-primary"])};
  --sidebar-primary-foreground: ${formatColor(themeStyles.light["sidebar-primary-foreground"])};
  --sidebar-accent: ${formatColor(themeStyles.light["sidebar-accent"])};
  --sidebar-accent-foreground: ${formatColor(themeStyles.light["sidebar-accent-foreground"])};
  --sidebar-border: ${formatColor(themeStyles.light["sidebar-border"])};
  --sidebar-ring: ${formatColor(themeStyles.light["sidebar-ring"])};

  --font-sans: ${themeStyles.light["font-sans"]};

  --radius: ${themeStyles.light.radius};
  ${hasCustomShadow(themeStyles.light) ? generateShadowVariables(getShadowMap(themeStyles.light, colorFormat)) : ""}
  ${Object.entries(themeStyles.light)
		.filter(([key]) => key.startsWith("shadow-"))
		.map(
			([key, value]) =>
				`--${key}: ${key === "shadow-color" ? formatColor(value) : value};`,
		)
		.join("\n  ")}
  ${themeStyles.light["letter-spacing"] ? `--letter-spacing: ${themeStyles.light["letter-spacing"]};` : ""}
}

.dark {
  --background: ${formatColor(themeStyles.dark.background)};
  --foreground: ${formatColor(themeStyles.dark.foreground)};
  --card: ${formatColor(themeStyles.dark.card)};
  --card-foreground: ${formatColor(themeStyles.dark["card-foreground"])};
  --popover: ${formatColor(themeStyles.dark.popover)};
  --popover-foreground: ${formatColor(themeStyles.dark["popover-foreground"])};
  --primary: ${formatColor(themeStyles.dark.primary)};
  --primary-foreground: ${formatColor(themeStyles.dark["primary-foreground"])};
  --secondary: ${formatColor(themeStyles.dark.secondary)};
  --secondary-foreground: ${formatColor(themeStyles.dark["secondary-foreground"])};
  --muted: ${formatColor(themeStyles.dark.muted)};
  --muted-foreground: ${formatColor(themeStyles.dark["muted-foreground"])};
  --accent: ${formatColor(themeStyles.dark.accent)};
  --accent-foreground: ${formatColor(themeStyles.dark["accent-foreground"])};
  --destructive: ${formatColor(themeStyles.dark.destructive)};
  --destructive-foreground: ${formatColor(themeStyles.dark["destructive-foreground"])};
  --border: ${formatColor(themeStyles.dark.border)};
  --input: ${formatColor(themeStyles.dark.input)};
  --ring: ${formatColor(themeStyles.dark.ring)};
  --chart-1: ${formatColor(themeStyles.dark["chart-1"])};
  --chart-2: ${formatColor(themeStyles.dark["chart-2"])};
  --chart-3: ${formatColor(themeStyles.dark["chart-3"])};
  --chart-4: ${formatColor(themeStyles.dark["chart-4"])};
  --chart-5: ${formatColor(themeStyles.dark["chart-5"])};
  --sidebar: ${formatColor(themeStyles.dark.sidebar)};
  --sidebar-foreground: ${formatColor(themeStyles.dark["sidebar-foreground"])};
  --sidebar-primary: ${formatColor(themeStyles.dark["sidebar-primary"])};
  --sidebar-primary-foreground: ${formatColor(themeStyles.dark["sidebar-primary-foreground"])};
  --sidebar-accent: ${formatColor(themeStyles.dark["sidebar-accent"])};
  --sidebar-accent-foreground: ${formatColor(themeStyles.dark["sidebar-accent-foreground"])};
  --sidebar-border: ${formatColor(themeStyles.dark["sidebar-border"])};
  --sidebar-ring: ${formatColor(themeStyles.dark["sidebar-ring"])};
  ${themeStyles.dark["letter-spacing"] ? `--letter-spacing: ${themeStyles.dark["letter-spacing"]};` : ""}
  ${hasCustomShadow(themeStyles.dark) ? generateShadowVariables(getShadowMap(themeStyles.dark, colorFormat)) : ""}
  ${Object.entries(themeStyles.dark)
		.filter(([key]) => key.startsWith("shadow-"))
		.map(
			([key, value]) =>
				`--${key}: ${key === "shadow-color" ? formatColor(value) : value};`,
		)
		.join("\n  ")}
}
${themeStyles.light["letter-spacing"] && themeStyles.light["letter-spacing"] !== "0em" ? "\n\nbody {\n  letter-spacing: var(--letter-spacing);\n}" : ""}`;
};
