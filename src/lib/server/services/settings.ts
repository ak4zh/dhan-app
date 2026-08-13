import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { settings } from '../db/schema';
import { dhanEnv } from '../config';
import { generateDhanAccessToken } from '../brokers/dhan';

const DHAN_TOKEN_KEY = 'dhan_access_token';
const DHAN_TOKEN_EXPIRY_KEY = 'dhan_access_token_expiry';
const DHAN_TOKEN_LAST_ERROR_KEY = 'dhan_token_last_error_time';
const REALIZED_PNL_OFFSET_KEY = 'realized_pnl_offset';

const COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes cooldown on generation failure

let inFlightRefreshPromise: Promise<{ accessToken: string; expiryTime: string } | undefined> | null = null;

async function getSetting(key: string): Promise<string | undefined> {
	const rows = await db.select().from(settings).where(eq(settings.key, key));
	return rows[0]?.value;
}

async function setSetting(key: string, value: string) {
	await db
		.insert(settings)
		.values({ key, value })
		.onConflictDoUpdate({ target: settings.key, set: { value } });
}

export async function setStoredDhanToken(accessToken: string, expiryTime: string) {
	await setSetting(DHAN_TOKEN_KEY, accessToken);
	await setSetting(DHAN_TOKEN_EXPIRY_KEY, expiryTime);
	await setSetting(DHAN_TOKEN_LAST_ERROR_KEY, '0');
}

async function getLastErrorTime(): Promise<number> {
	const val = await getSetting(DHAN_TOKEN_LAST_ERROR_KEY);
	return val ? Number(val) || 0 : 0;
}

async function setLastErrorTime(timestamp: number) {
	await setSetting(DHAN_TOKEN_LAST_ERROR_KEY, String(timestamp));
}

function isTokenExpired(expiryTimeStr: string): boolean {
	if (!expiryTimeStr) return false;
	const expiryMs = Date.parse(expiryTimeStr);
	if (isNaN(expiryMs)) return false;
	return Date.now() >= expiryMs - 60 * 1000;
}

/**
 * Generates a fresh Dhan access token using API credentials from env/config,
 * saves it in DB, and handles a 2-minute cooldown if generation fails.
 */
export async function refreshDhanAccessToken(
	force = false
): Promise<{ accessToken: string; expiryTime: string } | undefined> {
	if (inFlightRefreshPromise) {
		return inFlightRefreshPromise;
	}

	const { DHAN_CLIENT_ID: clientId, DHAN_PIN: pin, DHAN_TOTP_SECRET: totpSecret } = dhanEnv;

	if (!clientId || !pin || !totpSecret) {
		const fallback = dhanEnv.DHAN_ACCESS_TOKEN;
		if (fallback) {
			return { accessToken: fallback, expiryTime: '' };
		}
		throw new Error('Dhan API credentials (DHAN_CLIENT_ID, DHAN_PIN, DHAN_TOTP_SECRET) are not configured.');
	}

	const lastErrorTime = await getLastErrorTime();
	const elapsedSinceError = Date.now() - lastErrorTime;

	if (!force && lastErrorTime > 0 && elapsedSinceError < COOLDOWN_MS) {
		const remainingSec = Math.ceil((COOLDOWN_MS - elapsedSinceError) / 1000);
		console.warn(`Dhan token generation is in 2-minute cooldown (${remainingSec}s remaining).`);

		const existingToken = await getSetting(DHAN_TOKEN_KEY);
		const existingExpiry = await getSetting(DHAN_TOKEN_EXPIRY_KEY);
		if (existingToken) {
			return { accessToken: existingToken, expiryTime: existingExpiry ?? '' };
		}
		if (dhanEnv.DHAN_ACCESS_TOKEN) {
			return { accessToken: dhanEnv.DHAN_ACCESS_TOKEN, expiryTime: '' };
		}
		throw new Error(`Dhan token generation failed recently. Please wait ${remainingSec}s for cooldown before retrying.`);
	}

	inFlightRefreshPromise = (async () => {
		try {
			console.log('Generating fresh Dhan access token via API...');
			const result = await generateDhanAccessToken(clientId, pin, totpSecret);
			await setStoredDhanToken(result.accessToken, result.expiryTime);
			console.log('Successfully generated and saved Dhan access token to DB.');
			return result;
		} catch (err: any) {
			const now = Date.now();
			await setLastErrorTime(now);
			console.error('Failed to generate Dhan access token via API:', err?.message || err);

			const existingToken = await getSetting(DHAN_TOKEN_KEY);
			const existingExpiry = await getSetting(DHAN_TOKEN_EXPIRY_KEY);
			if (existingToken) {
				return { accessToken: existingToken, expiryTime: existingExpiry ?? '' };
			}
			if (dhanEnv.DHAN_ACCESS_TOKEN) {
				return { accessToken: dhanEnv.DHAN_ACCESS_TOKEN, expiryTime: '' };
			}
			throw new Error(`Dhan token generation failed: ${err?.message || err}. 2-minute cooldown initiated.`);
		} finally {
			inFlightRefreshPromise = null;
		}
	})();

	return inFlightRefreshPromise;
}

/**
 * Gets latest Dhan access token from DB, auto-generating via API if missing/expired.
 */
export async function getStoredDhanToken(): Promise<
	{ accessToken: string; expiryTime: string } | undefined
> {
	const accessToken = await getSetting(DHAN_TOKEN_KEY);
	const expiryTime = await getSetting(DHAN_TOKEN_EXPIRY_KEY);

	if (accessToken && !isTokenExpired(expiryTime ?? '')) {
		return { accessToken, expiryTime: expiryTime ?? '' };
	}

	return refreshDhanAccessToken();
}

/**
 * Manual correction added to realized P&L — e.g. to account for a broker
 * charge or corporate action the automatic calculation can't see. Set once
 * from the admin panel, not touched by the daily/live calculation itself.
 */
export async function getRealizedPnlOffset(): Promise<number> {
	const val = await getSetting(REALIZED_PNL_OFFSET_KEY);
	return val !== undefined ? Number(val) || 0 : 0;
}

export async function setRealizedPnlOffset(offset: number) {
	await setSetting(REALIZED_PNL_OFFSET_KEY, String(offset));
}
