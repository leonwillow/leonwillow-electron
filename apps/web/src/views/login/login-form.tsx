// Next Imports

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@leonwillow-electron/ui/components/button";
import { Checkbox } from "@leonwillow-electron/ui/components/checkbox";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@leonwillow-electron/ui/components/field";
import { Input } from "@leonwillow-electron/ui/components/input";
// Third-party Imports
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
// Component Imports
import PasswordField from "@/components/auth/password-field";

// Config Imports
import { appConfig } from "@/lib/app-config";

// Schema Imports
import { type LoginFormValues, loginSchema } from "./login-schema";

const LoginForm = () => {
	const {
		register,
		handleSubmit,
		control,
		formState: { errors, isSubmitting },
	} = useForm<LoginFormValues>({
		resolver: zodResolver(loginSchema),
		defaultValues: { username: "", password: "", rememberMe: false },
	});

	// 当前仅迁移页面；接入认证 API 前不创建会话或模拟登录成功。
	const onSubmit = () => {
		toast.info("登录服务暂未接入，请稍后再试。");
	};

	return (
		<form onSubmit={handleSubmit(onSubmit)}>
			<FieldGroup className="gap-4">
				<Field className="gap-2" data-invalid={Boolean(errors.username)}>
					<FieldLabel htmlFor="username" className="leading-5">
						账号*
					</FieldLabel>
					<Input
						type="text"
						id="username"
						size="lg"
						autoComplete="username"
						autoCapitalize="none"
						spellCheck={false}
						placeholder="请输入账号"
						aria-invalid={Boolean(errors.username)}
						aria-describedby={errors.username ? "username-error" : undefined}
						{...register("username")}
					/>
					<FieldError id="username-error">
						{errors.username?.message}
					</FieldError>
				</Field>

				<PasswordField
					id="password"
					label="密码*"
					autoComplete="current-password"
					registration={register("password")}
					error={errors.password?.message}
				/>

				<div className="flex items-center justify-between gap-2">
					<Field orientation="horizontal" className="flex items-center gap-2">
						<Controller
							name="rememberMe"
							control={control}
							render={({ field }) => (
								<Checkbox
									id="rememberMe"
									checked={field.value}
									onCheckedChange={(checked) =>
										field.onChange(Boolean(checked))
									}
								/>
							)}
						/>
						<FieldLabel htmlFor="rememberMe" className="text-muted-foreground">
							记住我
						</FieldLabel>
					</Field>
					<Button
						variant="link"
						type="button"
						className="p-0"
						onClick={() => toast.info("密码找回功能将在后续接入。")}
					>
						忘记密码？
					</Button>
				</div>

				<Field>
					<Button
						size="lg"
						className="w-full"
						type="submit"
						disabled={isSubmitting}
					>
						登录 {appConfig.name}
					</Button>
				</Field>
			</FieldGroup>
		</form>
	);
};

export default LoginForm;
