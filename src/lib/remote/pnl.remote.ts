import { query } from '$app/server';
import { requireUser } from '$server/auth-guard';
import { getPnlSnapshot } from '$server/services/pnl';

/** Portfolio P&L for the signed-in user's view — same data for member and admin. */
export const portfolio = query(() => {
	requireUser();
	return getPnlSnapshot();
});
