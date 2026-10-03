// Component Imports
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@leonwillow-electron/ui/components/avatar";
import Silk from "@leonwillow-electron/ui/components/bg-silk";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@leonwillow-electron/ui/components/card";
import avatar1 from "@/assets/images/avatar-1.webp";
import avatar5 from "@/assets/images/avatar-5.webp";
import avatar6 from "@/assets/images/avatar-6.webp";
// SVG Imports
import LogoVector from "@/assets/svg/logo-vector";
// Hook Imports
import { useThemeColorHex } from "@/hooks/use-theme-color";

export type AuthShowcaseContent = {
	title: string;
	description: string;
	panelTitle: string;
	panelDescription: string;
};

const avatars = [
	{ src: avatar1, fallback: "OS", name: "Olivia Sparks" },
	{ src: avatar5, fallback: "HL", name: "Howard Lloyd" },
	{ src: avatar6, fallback: "HR", name: "Hallie Richards" },
];

// The Silk backdrop derives its colour from the theme `--primary`.
const AuthShowcase = ({
	title,
	description,
	panelTitle,
	panelDescription,
}: AuthShowcaseContent) => {
	const primary = useThemeColorHex("--primary", "#007595");

	return (
		<div className="h-dvh bg-primary/15 p-5 max-lg:hidden">
			<Card className="relative h-full justify-between overflow-hidden border-none py-8">
				<div className="pointer-events-none absolute inset-0 z-0">
					<Silk
						speed={10}
						scale={1}
						color={primary}
						noiseIntensity={0}
						rotation={8}
					/>
				</div>

				<CardHeader className="relative z-10 gap-6 px-8">
					<CardTitle className="font-bold text-4xl text-primary-foreground xl:text-5xl/15.5">
						{title}
					</CardTitle>
					<p className="text-primary-foreground text-xl">{description}</p>
				</CardHeader>

				<CardContent className="relative z-10 mx-8 h-62 overflow-hidden rounded-2xl px-0">
					<svg
						width="1094"
						height="249"
						viewBox="0 0 1094 249"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
						aria-hidden="true"
						className="pointer-events-none absolute right-0 -z-1 select-none"
					>
						<path
							d="M0.263672 16.8809C0.263672 8.0443 7.42712 0.880859 16.2637 0.880859H786.394H999.115C1012.37 0.880859 1023.12 11.626 1023.12 24.8808L1023.12 47.3809C1023.12 60.6357 1033.86 71.3809 1047.12 71.3809H1069.6C1082.85 71.3809 1093.6 82.126 1093.6 95.3809L1093.6 232.881C1093.6 241.717 1086.43 248.881 1077.6 248.881H16.2637C7.42716 248.881 0.263672 241.717 0.263672 232.881V16.8809Z"
							className="fill-primary-foreground/70 dark:fill-primary-foreground/30"
						/>
					</svg>

					<div className="absolute top-0 right-0 flex size-15 items-center justify-center rounded-2xl bg-primary-foreground/70 p-2">
						<LogoVector className="size-full" />
					</div>

					<div className="flex flex-col gap-5 p-6 text-foreground">
						<p className="line-clamp-2 pr-12 font-bold text-3xl">
							{panelTitle}
						</p>
						<p className="line-clamp-2 text-lg">{panelDescription}</p>

						<div className="flex self-end [&>*+*]:-ml-4">
							{avatars.map((avatar) => (
								<Avatar
									key={avatar.name}
									className="size-12 ring ring-primary-foreground/70"
								>
									<AvatarImage src={avatar.src} alt={avatar.name} />
									<AvatarFallback className="text-xs">
										{avatar.fallback}
									</AvatarFallback>
								</Avatar>
							))}
							<Avatar className="size-12 ring ring-primary-foreground/70">
								<AvatarFallback className="bg-primary-foreground text-xs">
									+3695
								</AvatarFallback>
							</Avatar>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
};

export default AuthShowcase;
