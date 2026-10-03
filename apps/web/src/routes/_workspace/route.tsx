import { createFileRoute, Outlet } from "@tanstack/react-router";
import WorkspaceLayout from "@/components/layout/WorkspaceLayout";

export const Route = createFileRoute("/_workspace")({
	component: () => (
		<WorkspaceLayout>
			<Outlet />
		</WorkspaceLayout>
	),
});
