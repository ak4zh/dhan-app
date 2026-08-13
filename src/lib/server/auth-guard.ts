import { error } from '@sveltejs/kit';
import { getRequestEvent } from '$app/server';

/**
 * Every remote function (query/command/form) that touches account data, P&L,
 * or admin actions must call one of these at the top — route-group guards in
 * hooks.server.ts protect *pages*, but a remote function is its own HTTP
 * endpoint and is reachable directly regardless of which page called it.
 */
export function requireUser() {
	const { locals } = getRequestEvent();
	if (!locals.user) throw error(401, 'Not signed in');
	return locals.user;
}

export function requireAdmin() {
	const user = requireUser();
	if (user.role !== 'admin') throw error(403, 'Admins only');
	return user;
}
