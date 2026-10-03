// 迁移原 Teammate 中布局需要的字段；业务角色和团队数据后续再迁移。
export type PresenceStatus = "online" | "away" | "offline";
export type CurrentUser = {
	id: string;
	name: string;
	email: string;
	initials: string;
	avatar?: string;
	presence: PresenceStatus;
};
