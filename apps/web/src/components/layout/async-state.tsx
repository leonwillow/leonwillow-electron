/**
 * @file 工作台路由、视图面板与二级菜单共用的异步加载及错误重试展示组件。
 * 创建时间：2026-11-18
 * 修改时间：2026-11-20
 * 版本作用：统一各处分散的 route-states、InquiryState、工作区空白引导及二级菜单加载/错误状态样板。
 * 被调用：admin.users 路由、各业务工作区视图及二级菜单。
 * 调用：ui Button、@tanstack/react-router。
 * 功能：按紧凑菜单尺寸或工作区常规尺寸呈现 role="status" 加载、role="alert" 错误重试与统一空白引导态。
 * 预期结果：视觉对齐、无障碍角色与重新加载/入口引导交互保持全站一致。
 */
import { Button } from "@leonwillow-electron/ui/components/button";
import { cn } from "@leonwillow-electron/ui/lib/utils";
import { useRouter } from "@tanstack/react-router";
import { CompassIcon } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

/** 面板或二级菜单内联使用的加载与错误重试块；正常且非加载态时返回 null。 */
export function AsyncStatusBlock({
	loading,
	error,
	loadingText = "正在加载…",
	retryLabel = "重新加载",
	compact = false,
	onRetry,
}: {
	loading: boolean;
	error: string;
	loadingText?: string;
	retryLabel?: string;
	compact?: boolean;
	onRetry: () => unknown;
}) {
	if (error) {
		return (
			<div
				className={cn(
					"flex flex-col items-start",
					compact ? "gap-2 p-2" : "gap-3 p-workspace-gutter",
				)}
			>
				<p
					role="alert"
					className={cn("text-destructive", compact ? "text-xs" : "text-sm")}
				>
					{error}
				</p>
				<Button
					variant="outline"
					size={compact ? "sm" : "default"}
					onClick={() => void onRetry()}
				>
					{retryLabel}
				</Button>
			</div>
		);
	}
	if (loading) {
		return (
			<p
				role="status"
				className={cn(
					"text-muted-foreground",
					compact ? "p-2 text-xs" : "p-workspace-gutter text-sm",
				)}
			>
				{loadingText}
			</p>
		);
	}
	return null;
}

/** 路由级加载占位视图。 */
export function WorkspaceRoutePending({ message }: { message: string }) {
	return (
		<div className="p-6 text-muted-foreground text-sm" role="status">
			{message}
		</div>
	);
}

/** 路由级失败重试视图，调用 router.invalidate 重新触发路由加载。 */
export function WorkspaceRouteError({
	title,
	message,
	retryLabel = "重试",
}: {
	title: string;
	message: string;
	retryLabel?: string;
}) {
	const router = useRouter();
	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
			<h1 className="font-semibold text-lg">{title}</h1>
			<p className="max-w-md text-muted-foreground text-sm" role="alert">
				{message}
			</p>
			<Button onClick={() => void router.invalidate()}>{retryLabel}</Button>
		</div>
	);
}

/** 各业务工作区未选择对象时的统一居中空白引导态。 */
export function WorkspaceEmptyState({
	icon: Icon,
	title,
	description,
	actions,
	footer,
}: {
	icon: ComponentType<{ className?: string }>;
	title: string;
	description?: string;
	actions?: ReactNode;
	footer?: ReactNode;
}) {
	return (
		<div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
			<div className="flex size-10 items-center justify-center rounded-xl border bg-muted/40 text-muted-foreground">
				<Icon className="size-5" aria-hidden="true" />
			</div>
			<div className="flex flex-col items-center gap-1">
				<h2 className="font-semibold text-base tracking-tight">{title}</h2>
				{description ? (
					<p className="max-w-sm text-muted-foreground text-sm">
						{description}
					</p>
				) : null}
			</div>
			{actions ? (
				<div className="flex flex-wrap items-center justify-center gap-2">
					{actions}
				</div>
			) : null}
			{footer}
		</div>
	);
}

/** 未匹配任何路由时的全局 404 兜底视图。 */
export function WorkspaceNotFound() {
	const router = useRouter();
	return (
		<main className="flex min-h-dvh w-full flex-col">
			<WorkspaceEmptyState
				icon={CompassIcon}
				title="页面不存在"
				description="你访问的地址无效或已被移除。"
				actions={
					<Button
						onClick={() => void router.navigate({ to: "/", replace: true })}
					>
						返回工作台
					</Button>
				}
			/>
		</main>
	);
}
