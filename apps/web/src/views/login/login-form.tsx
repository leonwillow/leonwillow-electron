/**
 * @file 账号密码登录表单。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：views/login/index.tsx。
 * 调用：@hookform/resolvers、ui 基础组件/样式、@tanstack/react-router、react-hook-form、sonner、components/auth/password-field、configs/app、lib/auth、./login-schema。
 * 功能：通过 React Hook Form 校验输入，调用账号接口并展示提交状态。
 * 预期结果：成功后刷新会话进入工作台；错误保留在当前页面。
 */
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
import { useRouter } from "@tanstack/react-router";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import PasswordField from "@/components/auth/password-field";

import { appConfig } from "@/configs/app";
import { authErrorMessage, login } from "@/lib/auth";

import { type LoginFormValues, loginSchema } from "./login-schema";

const LoginForm = () => {
	const router = useRouter();
	const {
		register,
		handleSubmit,
		control,
		formState: { errors, isSubmitting },
	} = useForm<LoginFormValues>({
		resolver: zodResolver(loginSchema),
		defaultValues: { username: "", password: "", rememberMe: false },
	});

	const onSubmit = async (values: LoginFormValues) => {
		try {
			await login(values);
			await router.invalidate();
			await router.navigate({ to: "/inbox", replace: true });
		} catch (error) {
			toast.error(authErrorMessage(error));
		}
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
						{isSubmitting ? "正在登录…" : `登录 ${appConfig.name}`}
					</Button>
				</Field>
			</FieldGroup>
		</form>
	);
};

export default LoginForm;
