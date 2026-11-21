/**
 * @file 认证页面宽屏展示区域。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-11-20
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：components/auth/auth-shell.tsx。
 * 调用：ui 基础组件/样式、assets/svg/logo-vector、hooks/use-theme-color、next-themes、utils/theme/color-converter。
 * 功能：组合品牌文案、核心能力摘要卡片与经明暗和中性色校准的丝绸背景。
 * 预期结果：浅深色与任意圆角下均保持高对比度与沉稳色调，窄屏隐藏装饰区域。
 */
import Silk from "@leonwillow-electron/ui/components/bg-silk";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@leonwillow-electron/ui/components/card";
import { useTheme } from "next-themes";
import LogoVector from "@/assets/svg/logo-vector";
import { useThemeColorHex } from "@/hooks/use-theme-color";
import { resolveSilkColor } from "@/utils/theme/color-converter";

export type AuthShowcaseContent = {
	title: string;
	description: string;
	panelTitle: string;
	panelDescription: string;
};

const capabilities = ["资金分析", "文书取号", "询问笔录", "税款测算"] as const;

export default function AuthShowcase({
	title,
	description,
	panelTitle,
	panelDescription,
}: AuthShowcaseContent) {
	const primary = useThemeColorHex("--primary", "#007595");
	const { forcedTheme, resolvedTheme } = useTheme();
	const silkColor = resolveSilkColor(
		primary,
		(forcedTheme ?? resolvedTheme) === "dark",
	);

	return (
		<div className="h-dvh bg-primary/15 p-5 max-lg:hidden">
			<Card className="relative h-full justify-between overflow-hidden border-none py-8">
				<div className="pointer-events-none absolute inset-0 z-0">
					<Silk
						speed={10}
						scale={1}
						color={silkColor}
						noiseIntensity={0}
						rotation={8}
					/>
					<div className="absolute inset-x-0 top-0 h-3/5 bg-gradient-to-b from-card/92 via-card/65 to-transparent" />
				</div>

				<CardHeader className="relative z-10 gap-4 px-8">
					<CardTitle className="font-bold text-4xl text-card-foreground tracking-tight xl:text-5xl/15.5">
						{title}
					</CardTitle>
					<p className="max-w-lg text-card-foreground/80 text-lg leading-relaxed">
						{description}
					</p>
				</CardHeader>

				<CardContent className="relative z-10 mx-8 rounded-2xl border border-border/50 bg-card/90 p-6 text-card-foreground shadow-lg backdrop-blur-md dark:bg-card/85">
					<div className="flex items-start justify-between gap-4">
						<div className="flex flex-col gap-2">
							<p className="font-semibold text-2xl tracking-tight">
								{panelTitle}
							</p>
							<p className="text-muted-foreground text-sm leading-relaxed">
								{panelDescription}
							</p>
						</div>
						<div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background/80 p-2">
							<LogoVector className="size-full" />
						</div>
					</div>
					<div className="mt-5 flex flex-wrap gap-2">
						{capabilities.map((item) => (
							<span
								key={item}
								className="rounded-full border border-border/60 bg-muted/70 px-3 py-1 font-medium text-foreground text-xs"
							>
								{item}
							</span>
						))}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
