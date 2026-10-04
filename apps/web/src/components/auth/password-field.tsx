/**
 * @file 认证表单共用的密码输入。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：views/register/register-form.tsx、views/login/login-form.tsx。
 * 调用：ui 基础组件/样式、lucide-react、react、react-hook-form。
 * 功能：组合注册字段、显隐切换、标签与错误提示。
 * 预期结果：密码值仍由表单管理；切换显隐不会提交表单。
 */
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
import { useState } from "react";
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
