// Router Imports

// Utils Imports
import { cn } from "@leonwillow-electron/ui/lib/utils";
import { Link } from "@tanstack/react-router";
// SVG Imports
import IconLogo from "@/assets/svg/logo";
// Config Imports
import { appConfig } from "@/lib/app-config";

const Logo = ({
	showName = false,
	className,
}: {
	showName?: boolean;
	className?: string;
}) => {
	return (
		<Link
			to="/inbox"
			className={cn("flex items-center gap-2", className)}
			aria-label={appConfig.name}
		>
			<span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
				<IconLogo />
			</span>
			{showName && (
				<span className="font-semibold text-lg md:text-2xl">
					{appConfig.name}
				</span>
			)}
		</Link>
	);
};

export default Logo;
