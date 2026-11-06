/**
 * @file 二级目录名称及摘要预览卡。
 * 创建时间：2026-11-05；修改时间：2026-11-05。
 * 版本作用：复用 MenuLabel 与 HoverCard，为各目录统一完整名称和已有摘要的预览。
 * 被调用：计算器、笔录、文书类型和资金案件目录；调用：共享 HoverCard、ScrollArea。
 * 预期结果：真实悬停延迟打开，点击后关闭；卡片定位整行外侧，不请求正文、不改动导航。
 */
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@leonwillow-electron/ui/components/hover-card";
import { MenuLabel } from "@leonwillow-electron/ui/components/menu-label";
import { ScrollArea } from "@leonwillow-electron/ui/components/scroll-area";
import type { LucideIcon } from "lucide-react";
import { useRef, useState } from "react";

const dateFormat = new Intl.DateTimeFormat("zh-CN", {
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
});

export function DirectoryItemLabel({
	name,
	icon: Icon,
	category,
	status,
	updatedAt,
	details = [],
}: {
	name: string;
	icon: LucideIcon;
	category: string;
	status?: string;
	updatedAt?: string | Date;
	details?: { label: string; value: string }[];
}) {
	const [open, setOpen] = useState(false);
	const trigger = useRef<HTMLElement>(null);
	const hoverIntent = useRef(false);
	const date = updatedAt ? new Date(updatedAt) : null;
	return (
		<HoverCard
			open={open}
			onOpenChange={(next, event) => {
				if (
					next &&
					!open &&
					(!hoverIntent.current ||
						event.reason !== "trigger-hover" ||
						!event.trigger?.matches(":hover"))
				) {
					event.cancel();
					return;
				}
				setOpen(next);
			}}
		>
			<HoverCardTrigger
				ref={(element) => {
					trigger.current = element;
				}}
				render={<span />}
				tabIndex={-1}
				className="flex min-w-0 flex-1"
				delay={150}
				closeDelay={100}
				onPointerEnter={() => {
					hoverIntent.current = true;
				}}
				onPointerLeave={() => {
					hoverIntent.current = false;
				}}
				onPointerDown={() => {
					hoverIntent.current = false;
					setOpen(false);
				}}
			>
				<MenuLabel>{name}</MenuLabel>
			</HoverCardTrigger>
			<HoverCardContent
				side="right"
				align="start"
				sideOffset={12}
				collisionPadding={12}
				anchor={() =>
					trigger.current?.closest<HTMLElement>("[data-menu-row]") ?? null
				}
				className="directory-item-preview p-0"
				aria-label="目录条目详情"
				onPointerDown={(event) => event.stopPropagation()}
				onClick={(event) => event.stopPropagation()}
			>
				<ScrollArea
					className="max-h-(--available-height) rounded-lg"
					contentClassName="flex w-full min-w-0! flex-col gap-3 p-3"
				>
					<div className="flex items-start gap-2">
						<Icon
							aria-hidden="true"
							className="size-4 shrink-0 text-muted-foreground"
						/>
						<p className="wrap-anywhere min-w-0 whitespace-normal font-semibold text-sm">
							{name}
						</p>
					</div>
					<p className="wrap-anywhere whitespace-normal text-muted-foreground">
						{category}
					</p>
					<dl className="flex flex-col gap-2">
						{status && (
							<div className="flex justify-between gap-3">
								<dt className="shrink-0 text-muted-foreground">状态</dt>
								<dd>{status}</dd>
							</div>
						)}
						{details.map(({ label, value }) => (
							<div key={label} className="flex justify-between gap-3">
								<dt className="shrink-0 text-muted-foreground">{label}</dt>
								<dd className="wrap-anywhere min-w-0 whitespace-normal text-right">
									{value}
								</dd>
							</div>
						))}
						{date && Number.isFinite(date.getTime()) && (
							<div className="flex justify-between gap-3">
								<dt className="shrink-0 text-muted-foreground">更新于</dt>
								<dd>
									<time dateTime={date.toISOString()}>
										{dateFormat.format(date)}
									</time>
								</dd>
							</div>
						)}
					</dl>
				</ScrollArea>
			</HoverCardContent>
		</HoverCard>
	);
}
