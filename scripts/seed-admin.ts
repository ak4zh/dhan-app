/**
 * Bootstrap: creates the first admin user, since public sign-up is disabled
 * (invite-only app — see src/lib/server/auth.ts).
 *
 * Safe to run on every container start (see docker-entrypoint.sh):
 *  - No-ops quietly if an admin already exists — never overwrites or
 *    duplicates.
 *  - No-ops quietly if ADMIN_EMAIL/ADMIN_PASSWORD aren't set, so it doesn't
 *    block startup for anyone who'd rather create the admin manually later.
 *
 * Manual usage (e.g. via `docker exec`):
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='...' ADMIN_NAME='Why' \
 *     npx tsx scripts/seed-admin.ts
 *
 * After the first admin exists, create member accounts from the admin
 * dashboard (authClient.admin.createUser) instead of this script.
 */
import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db } from '../src/lib/server/db/client';
import { user } from '../src/lib/server/db/schema';
import { auth } from '../src/lib/server/auth';

async function main() {
	const email = process.env.ADMIN_EMAIL;
	const password = process.env.ADMIN_PASSWORD;
	const name = process.env.ADMIN_NAME ?? 'Admin';

	const [existingAdmin] = await db.select({ id: user.id }).from(user).where(eq(user.role, 'admin'));
	if (existingAdmin) {
		console.log('[seed-admin] An admin user already exists — skipping.');
		return;
	}

	if (!email || !password) {
		console.log(
			'[seed-admin] No admin exists yet, and ADMIN_EMAIL/ADMIN_PASSWORD are not set — skipping. ' +
				'Set them (and redeploy, or `docker exec` + run this script) to bootstrap the first admin.'
		);
		return;
	}
	if (password.length < 8) {
		console.error('[seed-admin] ADMIN_PASSWORD must be at least 8 characters — skipping.');
		return;
	}

	const [existingByEmail] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
	if (existingByEmail) {
		console.error(
			`[seed-admin] A user with email "${email}" already exists but isn't an admin — not touching it. ` +
				'Promote them from the admin dashboard, or delete the row and re-run.'
		);
		return;
	}

	const result = await auth.api.createUser({
		body: { email, password, name, role: 'admin' }
	});

	console.log(`[seed-admin] Created admin user: ${result.user.email} (id: ${result.user.id})`);
}

main().catch((err) => {
	// Never take the container down over this — the app is still usable
	// without an admin (someone can seed one manually later).
	console.error('[seed-admin] Failed:', err);
});
