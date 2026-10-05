/**
 * @file 人员账号与功能授权的事务服务。
 * 创建时间：2026-10-04
 * 修改时间：2026-10-05
 * 版本作用：管理员操作闭环；共享锁串行化权限变更。
 * 被调用：admin 路由。
 * 调用：server-resources、Better Auth 事务实例、Drizzle、认证与授权表。
 * 功能：创建人员、更新身份/授权、停用、重置密码并写审计。
 * 预期结果：账号与审计原子提交，撤销会话，保留至少一名有效管理员。
 */
import { isModuleId, modules } from "@leonwillow-electron/access";
import { authInTransaction } from "@leonwillow-electron/auth";
import type { DatabaseTransaction } from "@leonwillow-electron/db";
import {
	type AccessSnapshot,
	accessAudit,
	session,
	user,
	userModuleAccess,
} from "@leonwillow-electron/db/schema";
import { and, asc, desc, eq, gt, sql } from "drizzle-orm";
import { getServerResources } from "../../server-resources";
import { AccessError, type AccessSession } from "../access/service";
import type { CreateUserInput, UpdateUserInput } from "./model";

function snapshot(
	record: typeof user.$inferSelect,
	moduleIds: string[],
): AccessSnapshot {
	return {
		username: record.displayUsername ?? record.username ?? "",
		name: record.name,
		role: record.role === "admin" ? "admin" : "user",
		disabled:
			!!record.banned && (!record.banExpires || record.banExpires > new Date()),
		moduleIds,
	};
}

async function readUser(tx: DatabaseTransaction, id: string) {
	const [record] = await tx.select().from(user).where(eq(user.id, id));
	if (!record)
		throw new AccessError(
			404,
			"USER_NOT_FOUND",
			"该人员账号不存在，请刷新列表。",
		);
	const grants = await tx
		.select()
		.from(userModuleAccess)
		.where(eq(userModuleAccess.userId, id));
	return {
		...snapshot(
			record,
			grants.map((grant) => grant.moduleId).filter(isModuleId),
		),
		id: record.id,
		createdAt: record.createdAt.toISOString(),
	};
}

/** 等待管理锁后再读当前会话和角色，阻止已撤权的并发请求继续修改数据。 */
async function lockAdmin(tx: DatabaseTransaction, access: AccessSession) {
	await tx.execute(sql`select pg_advisory_xact_lock(1279607119, 2)`);
	const [actor] = await tx
		.select({
			role: user.role,
			banned: user.banned,
			banExpires: user.banExpires,
		})
		.from(user)
		.innerJoin(session, eq(session.userId, user.id))
		.where(
			and(
				eq(user.id, access.user.id),
				eq(session.id, access.sessionId),
				gt(session.expiresAt, new Date()),
			),
		);
	if (
		actor?.role !== "admin" ||
		(actor.banned && (!actor.banExpires || actor.banExpires > new Date()))
	) {
		throw new AccessError(
			403,
			"ADMIN_REQUIRED",
			"管理员权限已失效，请重新登录。",
		);
	}
}

async function writeGrants(
	tx: DatabaseTransaction,
	id: string,
	role: "admin" | "user",
	ids: string[],
) {
	if (
		ids.some(
			(id) => !modules.some((module) => module.id === id && module.enabled),
		)
	)
		throw new AccessError(400, "INVALID_MODULE", "所选功能不存在或已停用。");
	await tx.delete(userModuleAccess).where(eq(userModuleAccess.userId, id));
	if (role === "user" && ids.length)
		await tx
			.insert(userModuleAccess)
			.values(ids.map((moduleId) => ({ userId: id, moduleId })));
}

async function audit(
	tx: DatabaseTransaction,
	access: AccessSession,
	targetId: string,
	action: typeof accessAudit.$inferInsert.action,
	before: AccessSnapshot | null,
) {
	const after = await readUser(tx, targetId);
	const clean = ({
		username,
		name,
		role,
		disabled,
		moduleIds,
	}: AccessSnapshot): AccessSnapshot => ({
		username,
		name,
		role,
		disabled,
		moduleIds,
	});
	await tx.insert(accessAudit).values({
		id: crypto.randomUUID(),
		actorId: access.user.id,
		actorName: access.user.name,
		targetId,
		targetName: after.name,
		action,
		before: before && clean(before),
		after: clean(after),
	});
	return after;
}

export async function listUsers() {
	const { db } = getServerResources();
	const [people, grants] = await Promise.all([
		db.select().from(user).orderBy(asc(user.createdAt)),
		db.select().from(userModuleAccess),
	]);
	return people.map((person) => ({
		...snapshot(
			person,
			grants
				.filter((grant) => grant.userId === person.id)
				.map((grant) => grant.moduleId)
				.filter(isModuleId),
		),
		id: person.id,
		createdAt: person.createdAt.toISOString(),
	}));
}

export async function listAudit() {
	const { db } = getServerResources();
	return (
		await db
			.select()
			.from(accessAudit)
			.orderBy(desc(accessAudit.createdAt), desc(accessAudit.id))
			.limit(100)
	).map((event) => ({ ...event, createdAt: event.createdAt.toISOString() }));
}

/** 创建账号、密码哈希、功能授权和审计共用事务；账号重复 409，失败全部回滚。 */
export async function createUser(
	access: AccessSession,
	input: CreateUserInput,
) {
	const { db, auth } = getServerResources();
	return db.transaction(async (tx) => {
		await lockAdmin(tx, access);
		const username = input.username.toLowerCase();
		const [existing] = await tx
			.select({ id: user.id })
			.from(user)
			.where(eq(user.username, username));
		if (existing)
			throw new AccessError(
				409,
				"USERNAME_TAKEN",
				"该账号已存在，请使用其他账号。",
			);
		const result = await authInTransaction(auth, tx).api.createUser({
			body: {
				email: `${crypto.randomUUID()}@accounts.invalid`,
				name: input.name.trim(),
				password: input.password,
				role: input.role,
				data: { username, displayUsername: input.username },
			},
		});
		await writeGrants(tx, result.user.id, input.role, input.moduleIds);
		return audit(tx, access, result.user.id, "user.create", null);
	});
}

/** 更新资料和授权；不能停用/降级当前管理员或最后一位管理员；身份变更撤销旧会话。 */
export async function updateUser(
	access: AccessSession,
	headers: Headers,
	id: string,
	input: UpdateUserInput,
) {
	const { db, auth } = getServerResources();
	return db.transaction(async (tx) => {
		await lockAdmin(tx, access);
		const before = await readUser(tx, id);
		if (id === access.user.id && (input.disabled || input.role !== "admin"))
			throw new AccessError(
				409,
				"SELF_PROTECTION",
				"不能停用或降低当前管理员的身份，请由另一位管理员操作。",
			);
		if (
			before.role === "admin" &&
			!before.disabled &&
			(input.disabled || input.role !== "admin")
		) {
			const admins = await tx.select().from(user).where(eq(user.role, "admin"));
			if (admins.filter((person) => !snapshot(person, []).disabled).length <= 1)
				throw new AccessError(
					409,
					"LAST_ADMIN",
					"系统至少需要保留一位可用的管理员。",
				);
		}
		await authInTransaction(auth, tx).api.adminUpdateUser({
			headers,
			body: {
				userId: id,
				data: {
					name: input.name.trim(),
					role: input.role,
					banned: input.disabled,
					banReason: input.disabled ? "管理员停用账号" : null,
					banExpires: null,
				},
			},
		});
		await writeGrants(tx, id, input.role, input.moduleIds);
		if (input.disabled || before.role !== input.role)
			await tx.delete(session).where(eq(session.userId, id));
		return audit(tx, access, id, "user.update", before);
	});
}

/** 使用认证库重置密码并撤销目标全部会话；审计只记录动作，不包含密码或哈希。 */
export async function resetPassword(
	access: AccessSession,
	headers: Headers,
	id: string,
	password: string,
) {
	const { db, auth } = getServerResources();
	return db.transaction(async (tx) => {
		await lockAdmin(tx, access);
		const before = await readUser(tx, id);
		await authInTransaction(auth, tx).api.setUserPassword({
			headers,
			body: { userId: id, newPassword: password },
		});
		await tx.delete(session).where(eq(session.userId, id));
		await audit(tx, access, id, "user.password-reset", before);
		return { success: true } as const;
	});
}
