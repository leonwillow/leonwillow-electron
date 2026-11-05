/**
 * @file 管理员重置人员密码的弹窗。
 * 创建时间：2026-10-04
 * 修改时间：2026-11-05
 * 版本作用：独立于资料编辑的凭据操作。
 * 被调用：人员管理视图。
 * 调用：共享 UI、React Hook Form、管理 API。
 * 功能：确认两次新密码并提交，说明撤销全部登录的效果。
 * 预期结果：密码不进入列表或审计，重置自身密码后返回登录页。
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@leonwillow-electron/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@leonwillow-electron/ui/components/dialog";
import {
	FieldError,
	FieldGroup,
} from "@leonwillow-electron/ui/components/field";
import { useRouter } from "@tanstack/react-router";
import { LoaderCircleIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import PasswordField from "@/components/auth/password-field";
import {
	accessErrorMessage,
	type ManagedUser,
	resetManagedPassword,
} from "@/lib/access";
import { managedPasswordSchema } from "./person-schema";

const schema = z
	.object({ password: managedPasswordSchema, confirmPassword: z.string() })
	.refine((value) => value.password === value.confirmPassword, {
		path: ["confirmPassword"],
		message: "两次输入的密码不一致。",
	});

export default function PasswordDialog({
	person,
	currentUserId,
	onClose,
	onSaved,
}: {
	person: ManagedUser;
	currentUserId: string;
	onClose: () => void;
	onSaved: () => Promise<void>;
}) {
	const router = useRouter();
	const {
		register,
		handleSubmit,
		setError,
		reset,
		formState: { errors, isSubmitting },
	} = useForm<z.infer<typeof schema>>({
		resolver: zodResolver(schema),
		defaultValues: { password: "", confirmPassword: "" },
	});
	const submit = async ({ password }: z.infer<typeof schema>) => {
		try {
			await resetManagedPassword(person.id, password);
			reset();
			toast.success("密码已重置，原有登录已全部失效。");
			onClose();
			if (person.id === currentUserId) {
				await router.invalidate();
				await router.navigate({ to: "/login", replace: true });
			} else await onSaved();
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
				className="max-h-[calc(100dvh-2rem)]"
				scrollContentClassName=""
				showCloseButton={!isSubmitting}
			>
				<DialogHeader>
					<DialogTitle>重置密码</DialogTitle>
					<DialogDescription>
						将为 {person.name}（{person.username}
						）设置新密码，并使其所有设备退出登录。
						{person.id === currentUserId &&
							" 这是你的账号，完成后需要重新登录。"}
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit(submit)} className="space-y-4">
					<FieldGroup>
						<PasswordField
							id="reset-new-password"
							label="新密码"
							autoComplete="new-password"
							registration={register("password")}
							error={errors.password?.message}
						/>
						<PasswordField
							id="reset-confirm-password"
							label="再次输入新密码"
							autoComplete="new-password"
							registration={register("confirmPassword")}
							error={errors.confirmPassword?.message}
						/>
						<FieldError>{errors.root?.message}</FieldError>
					</FieldGroup>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={onClose}
							disabled={isSubmitting}
						>
							取消
						</Button>
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting && (
								<LoaderCircleIcon className="animate-spin" aria-hidden="true" />
							)}
							{isSubmitting ? "正在重置…" : "重置并退出所有设备"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
