/*
 * Default theme settings for the Theme Customizer.
 *
 * These are the fallback values used when no settings localStorage exists. The localStorage takes
 * priority, so changing a value here only takes effect after the localStorage is reset
 * (use the reset button in the customizer, or clear the `settingsStorageKey` localStorage).
 *
 * `font` accepts any key from FONT_CONFIG in ./fonts.ts.
 * `themePreset` accepts 'default' or any key from ./theme-presets.ts.
 */

const themeConfig = {
	settingsStorageKey: "aidesk-theme-settings",
	mode: "system", // 'system' | 'light' | 'dark'
	themePreset: "default", // 'default' | any key from ./theme-presets.ts
	font: "public-sans", // any key from FONT_CONFIG in ./fonts.ts
	radius: "md", // 'none' | 'sm' | 'md' | 'lg'
	scale: "md", // 'sm' | 'md' | 'lg' | 'xl'
} as const;

export default themeConfig;
