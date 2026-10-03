// React Imports
import type { SVGAttributes } from "react";

const Logo = (props: SVGAttributes<SVGElement>) => {
	return (
		<svg
			aria-hidden="true"
			width="512"
			height="512"
			viewBox="0 0 512 512"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			{...props}
		>
			<rect width="512" height="512" rx="65" className="fill-primary" />
			<path
				d="M277.304 141.178L261.493 115L159.933 287.538L178.785 319.665H210.409L191.556 285.753L277.304 141.178Z"
				fill="white"
				className="dark:fill-white"
			/>
			<path
				d="M382.89 373.113L413.966 372.918L312.678 200.199L274.818 199.971L258.908 226.713L298.344 227.839L382.89 373.113Z"
				fill="white"
				className="dark:fill-white"
			/>
			<path
				d="M123.144 347.77L108 374.327L311.479 373.218L330.344 341.092L314.413 314.363L293.972 347.388L123.144 347.77Z"
				fill="white"
				className="dark:fill-white"
			/>
		</svg>
	);
};

export default Logo;
