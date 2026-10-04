/**
 * @file 账号密码注册表单。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：views/register/index.tsx。
 * 调用：@hookform/resolvers、@tanstack/react-router、react-hook-form、sonner、ui 基础组件/样式、components/auth/password-field、configs/app、lib/auth、./register-schema。
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
import { authErrorMessage, register as registerAccount } from "@/lib/auth";

import { type RegisterFormValues, registerSchema } from "./register-schema";

const RegisterForm = () => {
	const router = useRouter();
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

	const onSubmit = async (values: RegisterFormValues) => {
		try {
			await registerAccount({
				username: values.username,
				password: values.password,
				agreeToTerms: true,
			});
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
						{isSubmitting ? "正在注册…" : `注册 ${appConfig.name}`}
					</Button>
				</Field>
			</FieldGroup>
		</form>
	);
};

export default RegisterForm;
