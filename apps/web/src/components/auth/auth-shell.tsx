// React Imports
import type { ReactNode } from "react";
import type { AuthShowcaseContent } from "./auth-showcase";
// Component Imports
import AuthShowcase from "./auth-showcase";

const AuthShell = ({
	children,
	showcase,
}: {
	children: ReactNode;
	showcase: AuthShowcaseContent;
}) => (
	<div className="min-h-dvh lg:grid lg:grid-cols-2">
		<div className="flex min-h-dvh items-center justify-center sm:px-6 md:px-8">
			<div className="flex w-full flex-col gap-6 p-6 sm:max-w-lg">
				{children}
			</div>
		</div>
		<AuthShowcase {...showcase} />
	</div>
);

export default AuthShell;
