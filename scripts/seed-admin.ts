/**
 * One-time bootstrap: creates the first admin user, since public sign-up is
 * disabled (invite-only app — see src/lib/server/auth.ts).
 *
 * Usage:
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='...' ADMIN_NAME='Why' \
 *     npx tsx scripts/seed-admin.ts
 *
 * After this, create member accounts from the admin dashboard
 * (authClient.admin.createUser) — no need to run this script again.
 */
import 'dotenv/config';
import { auth } from '../src/lib/server/auth';

async function main() {
	const email = process.env.ADMIN_EMAIL;
	const password = process.env.ADMIN_PASSWORD;
	const name = process.env.ADMIN_NAME ?? 'Admin';

	if (!email || !password) {
		console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD env vars and re-run.');
		process.exit(1);
	}
	if (password.length < 8) {
		console.error('ADMIN_PASSWORD must be at least 8 characters.');
		process.exit(1);
	}

	const result = await auth.api.createUser({
		body: { email, password, name, role: 'admin' }
	});

	console.log(`Created admin user: ${result.user.email} (id: ${result.user.id})`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
