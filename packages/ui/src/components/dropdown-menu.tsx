/**
 * @file 下拉菜单、分组、子菜单与选择项的基础组件。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-11-21
 * 版本作用：共享 UI 基础层，随工作区维护。
 * 被调用：components/layout/profile-menu.tsx、components/layout/auth-links-menu.tsx。
 * 调用：@base-ui/react、ui/lib/utils、lucide-react、react。
 * 功能：组合底层控件和语义样式，透传对应属性并提供稳定 data-slot。
 * 预期结果：业务调用方负责内容与事件，基础层不依赖应用路由或账号接口。
 */
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { ScrollArea } from "@leonwillow-electron/ui/components/scroll-area";
import { cn } from "@leonwillow-electron/ui/lib/utils";

import { CheckIcon, ChevronRightIcon } from "lucide-react";
import type * as React from "react";

function DropdownMenu({ ...props }: MenuPrimitive.Root.Props) {
	return <MenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuPortal({ ...props }: MenuPrimitive.Portal.Props) {
	return <MenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />;
}

function DropdownMenuTrigger({ ...props }: MenuPrimitive.Trigger.Props) {
	return <MenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

function DropdownMenuContent({
	align = "start",
	alignOffset = 0,
	anchor,
	side = "bottom",
	sideOffset = 4,
	className,
	children,
	...props
}: MenuPrimitive.Popup.Props &
	Pick<
		MenuPrimitive.Positioner.Props,
		"align" | "alignOffset" | "side" | "sideOffset" | "anchor"
	>) {
	return (
		<MenuPrimitive.Portal>
			<MenuPrimitive.Positioner
				className="isolate z-(--z-popover) outline-none"
				anchor={anchor}
				align={align}
				alignOffset={alignOffset}
				side={side}
				sideOffset={sideOffset}
			>
				<MenuPrimitive.Popup
					data-slot="dropdown-menu-content"
					className={cn(
						"data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:fade-in-0 data-open:zoom-in-95 data-closed:fade-out-0 data-closed:zoom-out-95 ring-(length:--ui-border-width) z-(--z-popover) flex max-h-(--available-height) w-(--anchor-width) min-w-32 origin-(--transform-origin) flex-col overflow-hidden rounded-lg bg-popover p-0 text-popover-foreground shadow-md outline-none ring-ui-outline duration-100 data-closed:animate-out data-open:animate-in data-closed:overflow-hidden",
						className,
					)}
					{...props}
				>
					<ScrollArea
						className="min-h-0"
						contentClassName="flex flex-col gap-0.5 p-1"
					>
						{children}
					</ScrollArea>
				</MenuPrimitive.Popup>
			</MenuPrimitive.Positioner>
		</MenuPrimitive.Portal>
	);
}

function DropdownMenuGroup({ className, ...props }: MenuPrimitive.Group.Props) {
	return (
		<MenuPrimitive.Group
			data-slot="dropdown-menu-group"
			className={cn("flex flex-col gap-0.5", className)}
			{...props}
		/>
	);
}

function DropdownMenuLabel({
	className,
	inset,
	...props
}: MenuPrimitive.GroupLabel.Props & {
	inset?: boolean;
}) {
	return (
		<MenuPrimitive.GroupLabel
			data-slot="dropdown-menu-label"
			data-inset={inset}
			className={cn(
				"px-2 py-1.5 text-muted-foreground text-xs data-inset:pl-7.5",
				className,
			)}
			{...props}
		/>
	);
}

function DropdownMenuItem({
	className,
	inset,
	variant = "default",
	...props
}: MenuPrimitive.Item.Props & {
	inset?: boolean;
	variant?: "default" | "destructive";
}) {
	return (
		<MenuPrimitive.Item
			data-slot="dropdown-menu-item"
			data-inset={inset}
			data-variant={variant}
			className={cn(
				"group/dropdown-menu-item relative flex min-h-control-md cursor-default select-none items-center gap-2 rounded-md px-2 py-1 text-xs/relaxed outline-hidden focus:bg-muted focus:text-foreground not-data-[variant=destructive]:focus:**:text-foreground aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground aria-[current=page]:focus:bg-accent aria-[current=page]:focus:text-accent-foreground data-disabled:pointer-events-none data-inset:pl-7.5 data-[variant=destructive]:text-destructive-foreground data-disabled:opacity-50 data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive-foreground dark:data-[variant=destructive]:focus:bg-destructive/20 [&_svg:not([class*='size-'])]:size-3.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 data-[variant=destructive]:*:[svg]:text-destructive-foreground",
				className,
			)}
			{...props}
		/>
	);
}

function DropdownMenuSub({ ...props }: MenuPrimitive.SubmenuRoot.Props) {
	return <MenuPrimitive.SubmenuRoot data-slot="dropdown-menu-sub" {...props} />;
}

function DropdownMenuSubTrigger({
	className,
	inset,
	children,
	...props
}: MenuPrimitive.SubmenuTrigger.Props & {
	inset?: boolean;
}) {
	return (
		<MenuPrimitive.SubmenuTrigger
			data-slot="dropdown-menu-sub-trigger"
			data-inset={inset}
			className={cn(
				"flex min-h-control-md cursor-default select-none items-center gap-2 rounded-md px-2 py-1 text-xs outline-hidden focus:bg-muted focus:text-foreground not-data-[variant=destructive]:focus:**:text-foreground data-open:bg-accent data-popup-open:bg-accent data-inset:pl-7.5 data-open:text-accent-foreground data-popup-open:text-accent-foreground [&_svg:not([class*='size-'])]:size-3.5 [&_svg]:pointer-events-none [&_svg]:shrink-0",
				className,
			)}
			{...props}
		>
			{children}
			<ChevronRightIcon className="ml-auto" />
		</MenuPrimitive.SubmenuTrigger>
	);
}

function DropdownMenuSubContent({
	align = "start",
	alignOffset = -3,
	side = "right",
	sideOffset = 0,
	className,
	...props
}: React.ComponentProps<typeof DropdownMenuContent>) {
	return (
		<DropdownMenuContent
			data-slot="dropdown-menu-sub-content"
			className={cn(
				"data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:fade-in-0 data-open:zoom-in-95 data-closed:fade-out-0 data-closed:zoom-out-95 ring-(length:--ui-border-width) w-auto min-w-32 rounded-lg bg-popover p-0 text-popover-foreground shadow-md ring-ui-outline duration-100 data-closed:animate-out data-open:animate-in",
				className,
			)}
			align={align}
			alignOffset={alignOffset}
			side={side}
			sideOffset={sideOffset}
			{...props}
		/>
	);
}

function DropdownMenuCheckboxItem({
	className,
	children,
	checked,
	inset,
	...props
}: MenuPrimitive.CheckboxItem.Props & {
	inset?: boolean;
}) {
	return (
		<MenuPrimitive.CheckboxItem
			data-slot="dropdown-menu-checkbox-item"
			data-inset={inset}
			className={cn(
				"relative flex min-h-control-md cursor-default select-none items-center gap-2 rounded-md py-1.5 pr-8 pl-2 text-xs outline-hidden focus:bg-muted focus:text-foreground focus:**:text-foreground data-disabled:pointer-events-none data-checked:bg-accent data-inset:pl-7.5 data-checked:text-accent-foreground data-disabled:opacity-50 data-checked:focus:bg-accent data-checked:focus:text-accent-foreground [&_svg:not([class*='size-'])]:size-3.5 [&_svg]:pointer-events-none [&_svg]:shrink-0",
				className,
			)}
			checked={checked}
			{...props}
		>
			<span
				className="pointer-events-none absolute right-2 flex items-center justify-center"
				data-slot="dropdown-menu-checkbox-item-indicator"
			>
				<MenuPrimitive.CheckboxItemIndicator>
					<CheckIcon />
				</MenuPrimitive.CheckboxItemIndicator>
			</span>
			{children}
		</MenuPrimitive.CheckboxItem>
	);
}

function DropdownMenuRadioGroup({ ...props }: MenuPrimitive.RadioGroup.Props) {
	return (
		<MenuPrimitive.RadioGroup
			data-slot="dropdown-menu-radio-group"
			{...props}
		/>
	);
}

function DropdownMenuRadioItem({
	className,
	children,
	inset,
	...props
}: MenuPrimitive.RadioItem.Props & {
	inset?: boolean;
}) {
	return (
		<MenuPrimitive.RadioItem
			data-slot="dropdown-menu-radio-item"
			data-inset={inset}
			className={cn(
				"relative flex min-h-control-md cursor-default select-none items-center gap-2 rounded-md py-1.5 pr-8 pl-2 text-xs outline-hidden focus:bg-muted focus:text-foreground focus:**:text-foreground data-disabled:pointer-events-none data-checked:bg-accent data-inset:pl-7.5 data-checked:text-accent-foreground data-disabled:opacity-50 data-checked:focus:bg-accent data-checked:focus:text-accent-foreground [&_svg:not([class*='size-'])]:size-3.5 [&_svg]:pointer-events-none [&_svg]:shrink-0",
				className,
			)}
			{...props}
		>
			<span
				className="pointer-events-none absolute right-2 flex items-center justify-center"
				data-slot="dropdown-menu-radio-item-indicator"
			>
				<MenuPrimitive.RadioItemIndicator>
					<CheckIcon />
				</MenuPrimitive.RadioItemIndicator>
			</span>
			{children}
		</MenuPrimitive.RadioItem>
	);
}

function DropdownMenuSeparator({
	className,
	...props
}: MenuPrimitive.Separator.Props) {
	return (
		<MenuPrimitive.Separator
			data-slot="dropdown-menu-separator"
			className={cn(
				"-mx-1 my-0.5 h-(--ui-border-width) bg-border/50",
				className,
			)}
			{...props}
		/>
	);
}

function DropdownMenuShortcut({
	className,
	...props
}: React.ComponentProps<"span">) {
	return (
		<span
			data-slot="dropdown-menu-shortcut"
			className={cn(
				"ml-auto text-caption text-muted-foreground tracking-widest group-focus/dropdown-menu-item:text-foreground",
				className,
			)}
			{...props}
		/>
	);
}

export {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuPortal,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
};
