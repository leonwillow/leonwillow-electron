// Component Imports
import { Button } from "@leonwillow-electron/ui/components/button";
import {
	Field,
	FieldError,
	FieldLabel,
} from "@leonwillow-electron/ui/components/field";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@leonwillow-electron/ui/components/input-group";
import { EyeIcon, EyeOffIcon } from "lucide-react";
// React Imports
import { useState } from "react";
// Third-party Imports
import type { UseFormRegisterReturn } from "react-hook-form";

const PasswordField = ({
	id,
	label,
	placeholder = "••••••••••••••••",
	registration,
	autoComplete,
	error,
}: {
	id: string;
	label: string;
	placeholder?: string;
	registration: UseFormRegisterReturn;
	autoComplete: "current-password" | "new-password";
	error?: string;
}) => {
	const [isVisible, setIsVisible] = useState(false);

	return (
		<Field className="gap-2" data-invalid={Boolean(error)}>
			<FieldLabel htmlFor={id} className="leading-5">
				{label}
			</FieldLabel>
			<InputGroup size="lg">
				<InputGroupInput
					id={id}
					type={isVisible ? "text" : "password"}
					autoComplete={autoComplete}
					placeholder={placeholder}
					aria-invalid={Boolean(error)}
					aria-describedby={error ? `${id}-error` : undefined}
					{...registration}
				/>
				<InputGroupAddon align="inline-end" className="py-0 pr-1.5">
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-pressed={isVisible}
						onClick={() => setIsVisible((prevState) => !prevState)}
						className="rounded-l-none text-muted-foreground hover:bg-transparent"
					>
						{isVisible ? <EyeOffIcon /> : <EyeIcon />}
						<span className="sr-only">
							{isVisible ? "隐藏密码" : "显示密码"}
						</span>
					</Button>
				</InputGroupAddon>
			</InputGroup>
			<FieldError id={`${id}-error`}>{error}</FieldError>
		</Field>
	);
};

export default PasswordField;
