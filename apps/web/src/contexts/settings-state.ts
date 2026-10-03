// Context 独立于 Provider，热更新 Provider 时保留同一个 Context 身份。
import { createContext } from "react";
import type {
	CustomTheme,
	CustomThemeId,
	Settings,
	ThemeDraft,
	ThemePreview,
} from "@/types/theme";

type SettingsContextProps = {
	settings: Settings;
	updateSettings: (settings: Partial<Settings>) => void;
	customThemes: CustomTheme[];
	setThemePreview: (preview: ThemePreview | null) => void;
	saveTheme: (draft: ThemeDraft, id?: CustomThemeId) => void;
	deleteTheme: (id: CustomThemeId) => void;
};

export const SettingsContext = createContext<SettingsContextProps | null>(null);
