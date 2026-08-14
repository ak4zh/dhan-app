import { query, command } from '$app/server';
import * as v from 'valibot';
import { eq } from 'drizzle-orm';
import { db } from '$server/db/client';
import { user } from '$server/db/schema';
import { requireAdmin } from '$server/auth-guard';
import { auth } from '$server/auth';

/** Every app user (member or admin) — for the admin's Members page. Never exposes password hashes (not stored on this table anyway; those live in `account`). */
export const listUsers = query(() => {
	requireAdmin();
	return db
		.select({
			id: user.id,
			name: user.name,
			email: user.email,
			role: user.role,
			banned: user.banned,
			createdAt: user.createdAt
		})
		.from(user)
		.orderBy(user.createdAt);
});

const CreateUserInput = v.object({
	email: v.pipe(v.string(), v.email()),
	name: v.pipe(v.string(), v.minLength(1)),
	password: v.pipe(v.string(), v.minLength(8, 'Password must be at least 8 characters')),
	role: v.picklist(['user', 'admin'])
});

/**
 * Invite-only signup: this is the only way a new person gets into the app —
 * there's no public /signup route. The admin sets an initial password here
 * and shares it with the person directly; they can change it after signing in.
 */
export const createUser = command(CreateUserInput, async ({ email, name, password, role }) => {
	requireAdmin();

	const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
	if (existing) {
		throw new Error(`A user with email "${email}" already exists`);
	}

	const result = await auth.api.createUser({ body: { email, password, name, role } });
	await listUsers().refresh();
	return { id: result.user.id };
});

const RemoveUserInput = v.object({ id: v.string() });

export const removeUser = command(RemoveUserInput, async ({ id }) => {
	const admin = requireAdmin();

	if (id === admin.id) {
		throw new Error("You can't remove your own account");
	}

	const target = await db.select({ role: user.role }).from(user).where(eq(user.id, id));
	if (target[0]?.role === 'admin') {
		const admins = await db.select({ id: user.id }).from(user).where(eq(user.role, 'admin'));
		if (admins.length <= 1) {
			throw new Error("Can't remove the last remaining admin");
		}
	}

	// Cascades to that user's sessions/accounts via the FK onDelete rules in schema.ts.
	await db.delete(user).where(eq(user.id, id));
	await listUsers().refresh();
});