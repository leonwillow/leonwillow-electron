import { createFileRoute } from "@tanstack/react-router";
import RegisterView from "@/views/register";

export const Route = createFileRoute("/register")({
	component: RegisterView,
});
