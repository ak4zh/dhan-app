import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin } from 'better-auth/plugins';
import { db } from './db/client';
import * as schema from './db/schema';

/**
 * Invite-only app: there is no public sign-up route. The admin (you) creates
 * member accounts from the admin dashboard via the `admin` plugin's
 * createUser API, which is also what gives us `user.role` ("admin" | "member")
 * without hand-rolling a roles table.
 */
export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: 'sqlite',
		schema
	}),
	emailAndPassword: {
		enabled: true,
		// Admin sets the initial password when creating the account; the member
		// can change it after logging in. No self-serve reset flow for v1 since
		// there's no email sending configured — reset happens via admin panel.
		disableSignUp: true
	},
	plugins: [
		admin({
			defaultRole: 'member',
			adminRoles: ['admin']
		})
	],
	session: {
		expiresIn: 60 * 60 * 24 * 30, // 30 days
		updateAge: 60 * 60 * 24 // refresh once/day
	}
});

export type Session = typeof auth.$Infer.Session;
