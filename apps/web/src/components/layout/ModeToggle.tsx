// Third-party Imports

// Component Imports
import { Button } from "@leonwillow-electron/ui/components/button";
import { MoonStarIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";

// Hook Imports
import { useSettings } from "@/hooks/use-settings";

const ModeToggle = () => {
	const { resolvedTheme } = useTheme();
	const { updateSettings } = useSettings();

	return (
		<Button
			variant="ghost"
			size="icon-lg"
			className="relative hover:bg-primary/10 hover:text-primary"
			onClick={() =>
				updateSettings({ mode: resolvedTheme === "light" ? "dark" : "light" })
			}
		>
			<MoonStarIcon className="scale-100 dark:scale-0" />
			<SunIcon className="absolute scale-0 dark:scale-100" />
			<span className="sr-only">切换明暗模式</span>
		</Button>
	);
};

export default ModeToggle;
