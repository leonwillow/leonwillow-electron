import type { LinkProps } from "@tanstack/react-router";
// Third-party Imports
import type { LucideIcon } from "lucide-react";

export type NavItem = {
	title: string;
	href: NonNullable<LinkProps["to"]>;
	icon: LucideIcon;
	badge?: string | number;
};

export type NavGroup = {
	title: string;
	items: NavItem[];
};
