// Next Imports
import { Link } from "@tanstack/react-router";

const AuthAltLink = ({
	prompt,
	linkText,
	href,
}: {
	prompt: string;
	linkText: string;
	href: "/login" | "/register";
}) => (
	<p className="text-center text-muted-foreground text-sm">
		{prompt}{" "}
		<Link to={href} className="text-foreground hover:underline">
			{linkText}
		</Link>
	</p>
);

export default AuthAltLink;
