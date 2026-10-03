import { cn } from "@leonwillow-electron/ui/lib/utils";
import type * as React from "react";

function Label({ className, ...props }: React.ComponentProps<"label">) {
	return (
		// biome-ignore lint/a11y/noLabelWithoutControl: htmlFor、children 由原模板组件的调用方传入。
		<label
			data-slot="label"
			className={cn(
				"flex select-none items-center gap-2 font-medium text-control/relaxed leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50 group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50",
				className,
			)}
			{...props}
		/>
	);
}

export { Label };
