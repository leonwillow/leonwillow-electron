import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Keep the source clsx + tailwind-merge flow, registering only our shared UI tokens.
const twMerge = extendTailwindMerge({
	extend: {
		theme: {
			text: ["control", "caption"],
			spacing: ["control-xs", "control-sm", "control-md", "control-lg"],
		},
	},
});

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}
