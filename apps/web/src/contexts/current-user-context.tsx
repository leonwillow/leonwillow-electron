// React Imports

import type { ReactNode } from "react";
import { createContext, useContext } from "react";

// Type Imports
import type { CurrentUser } from "@/types/user";

// 原模板当前用户的布局种子，后续由前端会话状态替换。
const CurrentUserContext = createContext<CurrentUser | null>(null);

export const CurrentUserProvider = ({
	user,
	children,
}: {
	user: CurrentUser;
	children: ReactNode;
}) => {
	return (
		<CurrentUserContext.Provider value={user}>
			{children}
		</CurrentUserContext.Provider>
	);
};

// 后续接入会话数据时仍通过同一上下文传递。
export const useCurrentUser = (): CurrentUser => {
	const user = useContext(CurrentUserContext);

	if (!user) {
		throw new Error("useCurrentUser must be used within a CurrentUserProvider");
	}

	return user;
};
