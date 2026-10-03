// React Imports
import { useContext } from "react";

// Context Imports
import { SettingsContext } from "@/contexts/settings-context";

export const useSettings = () => {
	const context = useContext(SettingsContext);

	if (!context) {
		throw new Error("useSettings must be used within a SettingsProvider");
	}

	return context;
};
