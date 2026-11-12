/**
 * @file 账号密码登录表单。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-11-10
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：views/login/index.tsx。
 * 调用：@hookform/resolvers、ui 基础组件/样式、@tanstack/react-router、react-hook-form、sonner、components/auth/password-field、configs/app、lib/auth、./login-schema。
 * 功能：通过 React Hook Form 校验输入；桌面连接设置与登录提交互斥，防止提交途中切换服务器。
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
import { useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import PasswordField from "@/components/auth/password-field";

import { appConfig } from "@/configs/app";
import { authErrorMessage, login } from "@/lib/auth";

import { type LoginFormValues, loginSchema } from "./login-schema";
import ServerConnectionSettings from "./server-connection-settings";

const LoginForm = () => {
	const router = useRouter();
	const [settingsOpen, setSettingsOpen] = useState(false);
	const settingsOpenRef = useRef(false);
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
		// RHF 的异步校验可能晚于设置窗口打开；读取即时值避免把密码发往刚切换的服务器。
		if (settingsOpenRef.current) return;
		try {
			await login(values);
			await router.invalidate();
			await router.navigate({ to: "/", replace: true });
		} catch (error) {
			toast.error(authErrorMessage(error));
		}
	};

	return (
		<div className="flex flex-col gap-3">
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
							<FieldLabel
								htmlFor="rememberMe"
								className="text-muted-foreground"
							>
								记住我
							</FieldLabel>
						</Field>
						<Button
							variant="link"
							type="button"
							className="p-0"
							onClick={() => toast.info("请联系管理员重置密码。")}
						>
							忘记密码？
						</Button>
					</div>

					<Field>
						<Button
							size="lg"
							className="w-full"
							type="submit"
							disabled={isSubmitting || settingsOpen}
						>
							{isSubmitting ? "正在登录…" : `登录 ${appConfig.name}`}
						</Button>
					</Field>
				</FieldGroup>
			</form>
			<ServerConnectionSettings
				disabled={isSubmitting}
				open={settingsOpen}
				onOpenChange={(open) => {
					settingsOpenRef.current = open;
					setSettingsOpen(open);
				}}
			/>
		</div>
	);
};

export default LoginForm;
