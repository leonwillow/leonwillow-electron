import { createFileRoute } from "@tanstack/react-router";
import LoginView from "@/views/login";

export const Route = createFileRoute("/login")({
	component: LoginView,
});
