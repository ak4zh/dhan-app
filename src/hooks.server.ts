import 'dotenv/config';
import { redirect, type Handle } from '@sveltejs/kit';
import { auth } from '$server/auth';
import { initDhanOrdersWs } from '$server/services/dhan-orders-ws';

// Start Dhan Live Orders WebSocket listener daemon
initDhanOrdersWs();

/**
 * Page-level gate. This is the UX layer (redirect to /login, bounce members
 * away from /admin) — it is NOT the security boundary for data access.
 * Every remote function re-checks via requireUser()/requireAdmin() in
 * src/lib/server/auth-guard.ts, since remote functions are callable directly
 * regardless of which page rendered the link to them.
 */
export const handle: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({ headers: event.request.headers });
	event.locals.session = session?.session ?? null;
	event.locals.user = session?.user ?? null;

	const routeId = event.route.id ?? '';
	const isAdminRoute = routeId.includes('/(admin)');
	const isMemberRoute = routeId.includes('/(member)');

	if ((isAdminRoute || isMemberRoute) && !event.locals.user) {
		throw redirect(303, `/login?next=${encodeURIComponent(event.url.pathname)}`);
	}
	if (isAdminRoute && event.locals.user?.role !== 'admin') {
		throw redirect(303, '/');
	}

	return resolve(event);
};
