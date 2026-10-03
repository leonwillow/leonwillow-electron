import avatar from "@/assets/images/avatar-1.webp";
import type { CurrentUser } from "@/types/user";

// 原模板 current-user 的布局种子；接入真实认证后由会话替换。
export const currentUser: CurrentUser = {
	id: "u-aidesk",
	name: "AI Desk",
	email: "ai@shadcnstudio.com",
	initials: "AD",
	avatar,
	presence: "online",
};
export const workspaceName = "工作台";
