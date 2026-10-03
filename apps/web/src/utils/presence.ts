import type { PresenceStatus } from "@/types/user";

// 从原 inbox-utils 提取布局使用的状态映射，颜色改为统一语义变量。
export const presenceLabel: Record<PresenceStatus, string> = {
	online: "在线",
	away: "离开",
	offline: "离线",
};
export const presenceDotClass = (status: PresenceStatus): string => {
	switch (status) {
		case "online":
			return "bg-presence-online";
		case "away":
			return "bg-presence-away";
		default:
			return "bg-muted-foreground";
	}
};
