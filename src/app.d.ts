import type { Session } from '$server/auth';

declare global {
	namespace App {
		interface Locals {
			session: Session['session'] | null;
			user: Session['user'] | null;
		}
		// interface Error {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
