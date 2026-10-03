import { Toaster } from "@leonwillow-electron/ui/components/sonner";
import { Outlet } from "@tanstack/react-router";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { SettingsProvider } from "@/contexts/settings-context";
import { savedSettings } from "@/lib/theme-settings";

// 迁移自原项目 src/app/layout.tsx；HTML 和字体由 Vite 入口负责。
export default function RootLayout() {
	return (
		<ThemeProvider
			attribute="class"
			defaultTheme={savedSettings.mode}
			enableSystem
			disableTransitionOnChange
			// CSR 首屏初始化已在 main.tsx 执行；用原库公开属性保留惰性脚本。
			scriptProps={{ type: "text/plain" }}
		>
			<SettingsProvider savedSettings={savedSettings}>
				<Outlet />
			</SettingsProvider>
			<Toaster />
		</ThemeProvider>
	);
}
