// Next Imports

import { zodResolver } from "@hookform/resolvers/zod";
// Third-party Imports
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

// Component Imports

import { Button } from "@leonwillow-electron/ui/components/button";
import { Checkbox } from "@leonwillow-electron/ui/components/checkbox";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@leonwillow-electron/ui/components/field";
import { Input } from "@leonwillow-electron/ui/components/input";
import PasswordField from "@/components/auth/password-field";

// Config Imports
import { appConfig } from "@/lib/app-config";

// Schema Imports
import { type RegisterFormValues, registerSchema } from "./register-schema";

const RegisterForm = () => {
	const {
		register,
		handleSubmit,
		control,
		formState: { errors, isSubmitting },
	} = useForm<RegisterFormValues>({
		resolver: zodResolver(registerSchema),
		defaultValues: {
			username: "",
			password: "",
			confirmPassword: "",
			agreeToTerms: false,
		},
	});

	// 当前仅迁移页面；接入认证 API 前不创建账号或模拟注册成功。
	const onSubmit = () => {
		toast.info("注册服务暂未接入，请稍后再试。");
	};

	return (
		<form onSubmit={handleSubmit(onSubmit)}>
			<FieldGroup className="gap-4">
				<Field className="gap-2" data-invalid={Boolean(errors.username)}>
					<FieldLabel htmlFor="registerUsername" className="leading-5">
						账号*
					</FieldLabel>
					<Input
						type="text"
						id="registerUsername"
						size="lg"
						autoComplete="username"
						autoCapitalize="none"
						spellCheck={false}
						placeholder="请输入账号"
						aria-invalid={Boolean(errors.username)}
						aria-describedby={
							errors.username ? "registerUsername-error" : undefined
						}
						{...register("username")}
					/>
					<FieldError id="registerUsername-error">
						{errors.username?.message}
					</FieldError>
				</Field>

				<PasswordField
					id="registerPassword"
					label="密码*"
					autoComplete="new-password"
					registration={register("password")}
					error={errors.password?.message}
				/>

				<PasswordField
					id="confirmPassword"
					label="确认密码*"
					autoComplete="new-password"
					registration={register("confirmPassword")}
					error={errors.confirmPassword?.message}
				/>

				<Field className="gap-1" data-invalid={Boolean(errors.agreeToTerms)}>
					<Field orientation="horizontal" className="flex items-center gap-2">
						<Controller
							name="agreeToTerms"
							control={control}
							render={({ field }) => (
								<Checkbox
									id="agreeToTerms"
									checked={field.value}
									aria-invalid={Boolean(errors.agreeToTerms)}
									aria-describedby={
										errors.agreeToTerms ? "terms-error" : undefined
									}
									onCheckedChange={(checked) =>
										field.onChange(Boolean(checked))
									}
								/>
							)}
						/>
						<FieldLabel
							htmlFor="agreeToTerms"
							className="flex-wrap gap-1 text-muted-foreground"
						>
							我已阅读并同意
							<Button
								type="button"
								variant="link"
								size="xs"
								className="px-0"
								onClick={() => {
									toast.info("隐私政策尚未配置。");
								}}
							>
								隐私政策
							</Button>
							<span>与</span>
							<Button
								type="button"
								variant="link"
								size="xs"
								className="px-0"
								onClick={() => {
									toast.info("服务条款尚未配置。");
								}}
							>
								服务条款
							</Button>
						</FieldLabel>
					</Field>
					<FieldError id="terms-error">
						{errors.agreeToTerms?.message}
					</FieldError>
				</Field>

				<Field>
					<Button
						size="lg"
						className="w-full"
						type="submit"
						disabled={isSubmitting}
					>
						注册 {appConfig.name}
					</Button>
				</Field>
			</FieldGroup>
		</form>
	);
};

export default RegisterForm;
