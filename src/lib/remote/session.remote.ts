import { query } from '$app/server';
import { getRequestEvent } from '$app/server';

/** Current signed-in user (or null), for header/nav display. */
export const me = query(() => {
	const { locals } = getRequestEvent();
	return locals.user;
});
