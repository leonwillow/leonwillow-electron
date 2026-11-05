/**
 * @file 人员创建、身份和功能授权弹窗。
 * 创建时间：2026-10-04
 * 修改时间：2026-11-05
 * 版本作用：适配原模板 teammate-form-dialog 的表单与弹窗结构。
 * 被调用：人员管理视图。
 * 调用：共享 UI、React Hook Form、Eden 管理客户端、person-schema。
 * 功能：填写真实人员资料、选择功能并提交原子更新。
 * 预期结果：失败保留表单，成功清空密码并刷新真实数据；不写浏览器存储。
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { isModuleId, modules } from "@leonwillow-electron/access";
import { Button } from "@leonwillow-electron/ui/components/button";
import { Checkbox } from "@leonwillow-electron/ui/components/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@leonwillow-electron/ui/components/dialog";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from "@leonwillow-electron/ui/components/field";
import { Input } from "@leonwillow-electron/ui/components/input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@leonwillow-electron/ui/components/select";
import { LoaderCircleIcon } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import PasswordField from "@/components/auth/password-field";
import {
	accessErrorMessage,
	createManagedUser,
	type ManagedUser,
	updateManagedUser,
} from "@/lib/access";
import { type PersonFormValues, personFormSchema } from "./person-schema";

const roles = [
	{ value: "user", label: "普通人员" },
	{ value: "admin", label: "管理员" },
];

export default function PersonDialog({
	person,
	currentUserId,
	onClose,
	onSaved,
}: {
	person?: ManagedUser;
	currentUserId: string;
	onClose: () => void;
	onSaved: () => Promise<void>;
}) {
	const isSelf = person?.id === currentUserId;
	const {
		register,
		handleSubmit,
		control,
		watch,
		setError,
		resetField,
		formState: { errors, isSubmitting },
	} = useForm<PersonFormValues>({
		resolver: zodResolver(personFormSchema(!!person)),
		defaultValues: {
			name: person?.name ?? "",
			username: person?.username ?? "",
			password: "",
			role: person?.role ?? "user",
			disabled: person?.disabled ?? false,
			moduleIds: person?.moduleIds.filter(isModuleId) ?? [],
		},
	});
	const role = watch("role");
	const onSubmit = async (values: PersonFormValues) => {
		try {
			const profile = {
				name: values.name,
				role: values.role,
				moduleIds: values.role === "admin" ? [] : values.moduleIds,
			};
			if (person)
				await updateManagedUser(person.id, {
					...profile,
					disabled: values.disabled,
				});
			else
				await createManagedUser({
					...profile,
					username: values.username,
					password: values.password,
				});
			resetField("password");
			toast.success(
				person
					? "人员资料与权限已更新。"
					: "账号已创建，可以使用分配的密码登录。",
			);
			onClose();
			await onSaved();
		} catch (error) {
			setError("root", { message: accessErrorMessage(error) });
		}
	};
	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open && !isSubmitting) onClose();
			}}
		>
			<DialogContent
				scrollable
				className="max-h-[calc(100dvh-2rem)] sm:max-w-md"
				scrollContentClassName=""
				showCloseButton={!isSubmitting}
			>
				<DialogHeader>
					<DialogTitle>{person ? "编辑人员与权限" : "添加人员"}</DialogTitle>
					<DialogDescription>
						{person
							? "保存后权限立即生效；停用或变更身份会使该人员退出登录。"
							: "创建内部账号，并选择这个人可以进入的功能。"}
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
					<FieldGroup>
						<Field data-invalid={!!errors.name}>
							<FieldLabel htmlFor="person-name">姓名</FieldLabel>
							<Input
								id="person-name"
								autoComplete="name"
								aria-invalid={!!errors.name}
								aria-describedby={errors.name ? "person-name-error" : undefined}
								{...register("name")}
							/>
							<FieldError id="person-name-error">
								{errors.name?.message}
							</FieldError>
						</Field>
						<Field data-invalid={!!errors.username}>
							<FieldLabel htmlFor="person-username">登录账号</FieldLabel>
							<Input
								id="person-username"
								readOnly={!!person}
								autoComplete="off"
								autoCapitalize="none"
								spellCheck={false}
								aria-invalid={!!errors.username}
								aria-describedby="person-username-help person-username-error"
								{...register("username")}
							/>
							<FieldDescription id="person-username-help">
								{person
									? "登录账号创建后保持不变。"
									: "使用英文字母、数字、点、下划线或短横线。"}
							</FieldDescription>
							<FieldError id="person-username-error">
								{errors.username?.message}
							</FieldError>
						</Field>
						{!person && (
							<PasswordField
								id="person-password"
								label="初始密码"
								autoComplete="new-password"
								placeholder="至少 8 个字符"
								registration={register("password")}
								error={errors.password?.message}
							/>
						)}
						<Field>
							<FieldLabel htmlFor="person-role">系统身份</FieldLabel>
							<Controller
								name="role"
								control={control}
								render={({ field }) => (
									<Select
										items={roles}
										value={field.value}
										onValueChange={field.onChange}
										disabled={isSelf || isSubmitting}
									>
										<SelectTrigger id="person-role" className="w-full">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectGroup>
												{roles.map((item) => (
													<SelectItem key={item.value} value={item.value}>
														{item.label}
													</SelectItem>
												))}
											</SelectGroup>
										</SelectContent>
									</Select>
								)}
							/>
							<FieldDescription>
								{role === "admin"
									? "管理员可以管理人员与权限，并访问全部已启用功能。"
									: "普通人员只能进入下方勾选的功能。"}
								{isSelf && " 当前管理员不能修改自己的身份。"}
							</FieldDescription>
						</Field>
						<FieldSet>
							<FieldLegend variant="label">可访问的功能</FieldLegend>
							<Controller
								name="moduleIds"
								control={control}
								render={({ field }) => (
									<FieldGroup className="grid grid-cols-2 gap-3">
										{modules
											.filter((module) => module.enabled)
											.map((module) => (
												<Field key={module.id} orientation="horizontal">
													<Checkbox
														id={`grant-${module.id}`}
														checked={
															role === "admin" ||
															field.value.includes(module.id)
														}
														disabled={role === "admin" || isSubmitting}
														onCheckedChange={(checked) =>
															field.onChange(
																checked
																	? [...field.value, module.id]
																	: field.value.filter(
																			(id) => id !== module.id,
																		),
															)
														}
													/>
													<FieldLabel htmlFor={`grant-${module.id}`}>
														{module.name}
													</FieldLabel>
												</Field>
											))}
									</FieldGroup>
								)}
							/>
							<FieldDescription>
								{role === "admin"
									? "管理员无需逐项分配。"
									: "未勾选任何功能时，该人员登录后会看到待授权提示。"}
							</FieldDescription>
						</FieldSet>
						{person && (
							<Field orientation="horizontal">
								<Controller
									name="disabled"
									control={control}
									render={({ field }) => (
										<Checkbox
											id="person-disabled"
											checked={field.value}
											disabled={isSelf || isSubmitting}
											onCheckedChange={field.onChange}
										/>
									)}
								/>
								<FieldLabel htmlFor="person-disabled">停用此账号</FieldLabel>
							</Field>
						)}
						<FieldError>{errors.root?.message}</FieldError>
					</FieldGroup>
					<DialogFooter>
						<Button
							variant="outline"
							type="button"
							onClick={onClose}
							disabled={isSubmitting}
						>
							取消
						</Button>
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting && (
								<LoaderCircleIcon className="animate-spin" aria-hidden="true" />
							)}
							{isSubmitting ? "正在保存…" : person ? "保存修改" : "创建账号"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
