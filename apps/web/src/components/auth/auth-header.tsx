// Component Imports
import Logo from "@/components/layout/Logo";

const AuthHeader = ({
	title,
	subtitle,
}: {
	title: string;
	subtitle: string;
}) => (
	<div className="flex flex-col gap-6">
		<Logo showName />
		<div>
			<h1 className="mb-2 font-semibold text-2xl">{title}</h1>
			<p className="text-muted-foreground">{subtitle}</p>
		</div>
	</div>
);

export default AuthHeader;
