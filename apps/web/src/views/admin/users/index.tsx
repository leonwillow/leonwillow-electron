/**
 * @file 人员与权限管理页面。
 * 创建时间：2026-10-04
 * 修改时间：2026-10-04
 * 版本作用：复用原模板 teammates 的页头、表格和弹窗组织方式。
 * 被调用：admin.users 路由。
 * 调用：共享 UI、路由加载数据、人员编辑和密码弹窗。
 * 功能：管理真实账号、查看功能授权与最近管理操作。
 * 预期结果：管理员在同一工作台完成管理，普通人员没有该入口。
 */
import { modules } from "@leonwillow-electron/access";
import {
	Avatar,
	AvatarFallback,
} from "@leonwillow-electron/ui/components/avatar";
import { Badge } from "@leonwillow-electron/ui/components/badge";
import { Button } from "@leonwillow-electron/ui/components/button";
import { Card } from "@leonwillow-electron/ui/components/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@leonwillow-electron/ui/components/dropdown-menu";
import { Input } from "@leonwillow-electron/ui/components/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@leonwillow-electron/ui/components/table";
import { getRouteApi, useRouter } from "@tanstack/react-router";
import {
	KeyRoundIcon,
	MoreHorizontalIcon,
	PencilIcon,
	PlusIcon,
	RefreshCwIcon,
} from "lucide-react";
import { useState } from "react";
import type { AuditEvent, ManagedUser } from "@/lib/access";
import PasswordDialog from "./password-dialog";
import PersonDialog from "./person-dialog";

const moduleNames = (ids: string[]) =>
	modules
		.filter((module) => ids.includes(module.id))
		.map((module) => module.name)
		.join("、") || "未分配";
const eventLabels = {
	"user.create": "创建账号",
	"user.update": "修改资料与权限",
	"user.password-reset": "重置密码",
};

function EventDetails({ event }: { event: AuditEvent }) {
	const describe = (value: AuditEvent["after"]) =>
		`${value.name} · ${value.role === "admin" ? "管理员（全部功能）" : `普通人员（${moduleNames(value.moduleIds)}）`} · ${value.disabled ? "已停用" : "正常"}`;
	return (
		<div className="space-y-1 text-muted-foreground text-xs">
			{event.before && (
				<p className="break-words">修改前：{describe(event.before)}</p>
			)}
			<p className="break-words">
				{event.before ? "修改后" : "创建结果"}：{describe(event.after)}
			</p>
		</div>
	);
}

export default function UsersView() {
	const { users, events } = getRouteApi(
		"/_workspace/admin/users",
	).useLoaderData();
	const { user } = getRouteApi("/_workspace").useRouteContext();
	const router = useRouter();
	const [query, setQuery] = useState("");
	const [dialog, setDialog] = useState<
		| { kind: "create" }
		| { kind: "edit" | "password"; person: ManagedUser }
		| null
	>(null);
	const filtered = users.filter((person) =>
		`${person.name} ${person.username}`
			.toLowerCase()
			.includes(query.trim().toLowerCase()),
	);
	const refresh = async () => {
		await router.invalidate();
	};
	return (
		<div className="flex h-full min-h-0 flex-col">
			<header className="shrink-0 border-b">
				<div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 p-4 sm:px-6">
					<div>
						<h1 className="font-semibold text-lg">人员与权限</h1>
						<p className="mt-1 text-muted-foreground text-xs">
							统一管理内部账号，以及每个人可以进入的功能。
						</p>
					</div>
					<Button onClick={() => setDialog({ kind: "create" })}>
						<PlusIcon />
						添加人员
					</Button>
				</div>
			</header>
			<div className="flex-1 overflow-auto">
				<div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
					<section aria-label="人员列表" className="space-y-3">
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div className="w-full sm:max-w-xs">
								<label htmlFor="people-search" className="sr-only">
									搜索姓名或账号
								</label>
								<Input
									id="people-search"
									placeholder="搜索姓名或账号"
									value={query}
									onChange={(event) => setQuery(event.target.value)}
								/>
							</div>
							<div className="flex items-center gap-3">
								<span
									className="text-muted-foreground text-xs"
									aria-live="polite"
								>
									{query ? `${filtered.length} / ` : ""}
									{users.length} 人
								</span>
								<Button variant="outline" onClick={refresh}>
									<RefreshCwIcon />
									刷新
								</Button>
							</div>
						</div>
						<Card className="overflow-hidden py-0 shadow-none">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className="px-4">人员</TableHead>
										<TableHead>系统身份</TableHead>
										<TableHead>可访问功能</TableHead>
										<TableHead>账号状态</TableHead>
										<TableHead className="px-4 text-right">操作</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{filtered.map((person) => (
										<TableRow key={person.id}>
											<TableCell className="px-4 py-3">
												<div className="flex items-center gap-3">
													<Avatar>
														<AvatarFallback>
															{Array.from(person.name).slice(0, 2).join("")}
														</AvatarFallback>
													</Avatar>
													<div className="min-w-0">
														<p className="font-medium">
															{person.name}
															{person.id === user.id && (
																<span className="ml-1 text-muted-foreground">
																	（你）
																</span>
															)}
														</p>
														<p className="text-muted-foreground">
															{person.username}
														</p>
													</div>
												</div>
											</TableCell>
											<TableCell>
												<Badge variant="outline">
													{person.role === "admin" ? "管理员" : "普通人员"}
												</Badge>
											</TableCell>
											<TableCell className="max-w-xs whitespace-normal">
												{person.role === "admin"
													? "全部已启用功能"
													: moduleNames(person.moduleIds)}
											</TableCell>
											<TableCell>
												<Badge
													variant={person.disabled ? "secondary" : "outline"}
												>
													{person.disabled ? "已停用" : "正常"}
												</Badge>
											</TableCell>
											<TableCell className="px-4 text-right">
												<DropdownMenu>
													<DropdownMenuTrigger
														render={
															<Button
																variant="ghost"
																size="icon-sm"
																aria-label={`管理${person.name}（${person.username}）`}
															/>
														}
													>
														<MoreHorizontalIcon />
													</DropdownMenuTrigger>
													<DropdownMenuContent align="end">
														<DropdownMenuGroup>
															<DropdownMenuItem
																onClick={() =>
																	setDialog({ kind: "edit", person })
																}
															>
																<PencilIcon />
																编辑人员与权限
															</DropdownMenuItem>
															<DropdownMenuItem
																onClick={() =>
																	setDialog({ kind: "password", person })
																}
															>
																<KeyRoundIcon />
																重置密码
															</DropdownMenuItem>
														</DropdownMenuGroup>
													</DropdownMenuContent>
												</DropdownMenu>
											</TableCell>
										</TableRow>
									))}
									{filtered.length === 0 && (
										<TableRow>
											<TableCell
												colSpan={5}
												className="p-8 text-center text-muted-foreground"
											>
												{query
													? "没有匹配的人员，请尝试其他姓名或账号。"
													: "暂无人员。添加人员后，可在这里分配功能权限。"}
											</TableCell>
										</TableRow>
									)}
								</TableBody>
							</Table>
						</Card>
						<p className="text-muted-foreground text-xs">
							普通人员按功能授权，功能内的数据由有权限的成员共享。管理员可访问全部已启用功能。
						</p>
					</section>
					<section aria-labelledby="audit-heading" className="space-y-3">
						<div>
							<h2 id="audit-heading" className="font-medium text-sm">
								最近管理操作
							</h2>
							<p className="mt-1 text-muted-foreground text-xs">
								显示最近 100 条记录，时间按本机时区显示。
							</p>
						</div>
						<Card className="gap-0 overflow-hidden py-0 shadow-none">
							{events.length ? (
								<ul className="divide-y">
									{events.map((event) => (
										<li key={event.id} className="space-y-2 p-4">
											<div className="flex flex-wrap items-center justify-between gap-2 text-xs">
												<p>
													<span className="font-medium">{event.actorName}</span>{" "}
													· {eventLabels[event.action]} · {event.targetName}
												</p>
												<time
													className="text-muted-foreground"
													dateTime={event.createdAt}
												>
													{new Date(event.createdAt).toLocaleString("zh-CN", {
														hour12: false,
													})}
												</time>
											</div>
											<EventDetails event={event} />
										</li>
									))}
								</ul>
							) : (
								<p className="p-6 text-muted-foreground text-xs">
									暂无管理记录。创建账号、修改权限和重置密码后，会在这里留下记录。
								</p>
							)}
						</Card>
					</section>
				</div>
			</div>
			{dialog?.kind === "create" && (
				<PersonDialog
					currentUserId={user.id}
					onClose={() => setDialog(null)}
					onSaved={refresh}
				/>
			)}
			{dialog?.kind === "edit" && (
				<PersonDialog
					person={dialog.person}
					currentUserId={user.id}
					onClose={() => setDialog(null)}
					onSaved={refresh}
				/>
			)}
			{dialog?.kind === "password" && (
				<PasswordDialog
					person={dialog.person}
					currentUserId={user.id}
					onClose={() => setDialog(null)}
					onSaved={refresh}
				/>
			)}
		</div>
	);
}
