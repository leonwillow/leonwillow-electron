import { Input as InputPrimitive } from "@base-ui/react/input";
import { cn } from "@leonwillow-electron/ui/lib/utils";
import type * as React from "react";

const inputSizes = {
	sm: "h-control-sm",
	default: "h-control-md",
	lg: "h-control-lg",
} as const;

function Input({
	className,
	type,
	size = "default",
	htmlSize,
	...props
}: Omit<React.ComponentProps<"input">, "size"> & {
	size?: keyof typeof inputSizes;
	htmlSize?: number;
}) {
	return (
		<InputPrimitive
			type={type}
			size={htmlSize}
			data-slot="input"
			data-size={size}
			className={cn(
				"w-full min-w-0 rounded-md border border-input bg-input/20 px-2 py-0.5 text-control/relaxed outline-none transition-colors file:inline-flex file:h-control-sm file:border-0 file:bg-transparent file:font-medium file:text-control/relaxed file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
				inputSizes[size],
				className,
			)}
			{...props}
		/>
	);
}

export { Input };
