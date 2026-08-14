import { authenticator } from 'otplib';
import { dhanEnv } from '../config';
import { refreshDhanAccessToken } from '../services/settings';

const DHAN_AUTH_URL = 'https://auth.dhan.co/app/generateAccessToken';
const DHAN_API_BASE = 'https://api.dhan.co/v2';

export interface DhanPosition {
	tradingSymbol: string;
	securityId: string;
	positionType: 'LONG' | 'SHORT' | 'CLOSED';
	exchangeSegment: string;
	productType: string;
	buyAvg: number;
	buyQty: number;
	costPrice: number;
	sellAvg: number;
	sellQty: number;
	netQty: number;
	realizedProfit: number;
	unrealizedProfit: number;
	multiplier: number;
	[key: string]: unknown;
}

export interface DhanHolding {
	tradingSymbol: string;
	securityId?: string;
	exchange?: string;
	totalQty: number;
	dpQty?: number;
	t1Qty?: number;
	availableQty?: number;
	avgCostPrice: number;
	[key: string]: unknown;
}

export interface DhanTrade {
	dhanClientId?: string;
	orderId?: string;
	exchangeSegment?: string;
	transactionType: 'BUY' | 'SELL' | 'B' | 'S';
	tradingSymbol: string;
	securityId?: string;
	tradedQuantity: number;
	tradedPrice: number;
	createTime?: string;
	productType?: string;
	[key: string]: unknown;
}

export interface DhanFundLimit {
	dhanClientId?: string;
	availabelBalance: number;
	sodLimit?: number;
	collateralAmount?: number;
	utilizedAmount?: number;
	[key: string]: unknown;
}

export interface DhanTokenResult {
	accessToken: string;
	expiryTime: string;
}

// ---------------------------------------------------------------------------
// Token refresh (shared by every fetch* function below via 401 retry)
// ---------------------------------------------------------------------------

/**
 * Generates a fresh 24h access token via Dhan's official API-key login endpoint —
 * documented, no scraping. Requires "TOTP for API access" set up once in Dhan Web.
 * https://dhanhq.co/docs/v2/authentication/
 */
export async function generateDhanAccessToken(
	clientId: string,
	pin: string,
	totpSecret: string
): Promise<DhanTokenResult> {
	const totp = authenticator.generate(totpSecret);
	const url = `${DHAN_AUTH_URL}?dhanClientId=${encodeURIComponent(clientId)}&pin=${encodeURIComponent(pin)}&totp=${encodeURIComponent(totp)}`;
	const res = await fetch(url, { method: 'POST' });
	const body: any = await res.json().catch(() => ({}));
	if (!res.ok || !body.accessToken) {
		throw new Error(`Dhan token generation failed: ${res.status} ${JSON.stringify(body)}`);
	}
	return { accessToken: body.accessToken, expiryTime: body.expiryTime };
}

async function refreshTokenOnAuthError(): Promise<string | null> {
	try {
		const res = await refreshDhanAccessToken(true);
		return res?.accessToken ?? null;
	} catch (err) {
		console.error('Failed to auto-refresh Dhan token on auth error:', err);
		return null;
	}
}

function isAuthError(status: number, bodyText: string): boolean {
	if (bodyText.includes('806') || bodyText.includes('Not Subscribed')) return false;
	if (status === 401) return true;
	if (
		status === 400 &&
		(bodyText.includes('Invalid Token') ||
			bodyText.includes('DH-906') ||
			bodyText.includes('Token Expired'))
	) {
		return true;
	}
	return false;
}

/** Shared fetch-with-retry: retries once with a freshly-refreshed token on auth failure. */
async function dhanFetch(
	path: string,
	clientId: string,
	accessToken: string,
	init: RequestInit = {}
): Promise<any> {
	const url = `${DHAN_API_BASE}${path}`;
	const headers = {
		Accept: 'application/json',
		'Content-Type': 'application/json',
		'access-token': accessToken,
		'client-id': clientId,
		...(init.headers ?? {})
	};

	let res = await fetch(url, { ...init, headers });
	let text = await res.text().catch(() => '');

	if (!res.ok && isAuthError(res.status, text)) {
		const newToken = await refreshTokenOnAuthError();
		if (newToken) {
			res = await fetch(url, { ...init, headers: { ...headers, 'access-token': newToken } });
			text = await res.text().catch(() => '');
		}
	}

	if (!res.ok) {
		throw new Error(`Dhan ${path} failed (${res.status}): ${text}`);
	}
	return text ? JSON.parse(text) : null;
}

// ---------------------------------------------------------------------------
// Portfolio / funds
// ---------------------------------------------------------------------------

export async function fetchDhanPositions(clientId: string, accessToken: string): Promise<DhanPosition[]> {
	try {
		return (await dhanFetch('/positions', clientId, accessToken)) ?? [];
	} catch (err) {
		console.error('Error fetching Dhan positions:', err);
		return [];
	}
}

export async function fetchDhanHoldings(clientId: string, accessToken: string): Promise<DhanHolding[]> {
	try {
		return (await dhanFetch('/holdings', clientId, accessToken)) ?? [];
	} catch (err) {
		console.error('Error fetching Dhan holdings:', err);
		return [];
	}
}

export async function fetchDhanFundLimit(
	clientId: string,
	accessToken: string
): Promise<DhanFundLimit | null> {
	try {
		return await dhanFetch('/fundlimit', clientId, accessToken);
	} catch (err) {
		console.error('Error fetching Dhan fund limit:', err);
		return null;
	}
}

/**
 * Today's trade book only — GET /v2/trades, no date range. This is NOT the
 * historical endpoint (see fetchDhanTradeHistory below); the old project
 * called this one with from_date/to_date query params that Dhan silently
 * ignores, which is why "historical" realized P&L was actually always
 * today-only. Kept separate on purpose so that mistake can't happen again.
 */
export async function fetchDhanTodaysTrades(clientId: string, accessToken: string): Promise<DhanTrade[]> {
	try {
		const body = await dhanFetch('/trades', clientId, accessToken);
		return Array.isArray(body) ? body : (body?.data ?? []);
	} catch (err) {
		console.error('Error fetching Dhan trade book:', err);
		return [];
	}
}

/**
 * Historical trade book for a date range, via the correct paginated endpoint:
 * GET /v2/trades/{from-date}/{to-date}/{page}. https://dhanhq.co/docs/v2/statements/
 * Walks pages until an empty page comes back or `maxPages` is hit (safety cap —
 * an account with a very long history should raise this or narrow the date range
 * rather than pull unboundedly on every P&L request).
 */
export async function fetchDhanTradeHistory(
	clientId: string,
	accessToken: string,
	fromDate: string,
	toDate: string,
	maxPages = 20
): Promise<DhanTrade[]> {
	const all: DhanTrade[] = [];
	for (let page = 0; page < maxPages; page++) {
		try {
			const body = await dhanFetch(`/trades/${fromDate}/${toDate}/${page}`, clientId, accessToken);
			const pageTrades: DhanTrade[] = Array.isArray(body) ? body : (body?.data ?? []);
			if (pageTrades.length === 0) break;
			all.push(...pageTrades);
			if (pageTrades.length < 1000) break; // short page = last page
		} catch (err) {
			console.error(`Error fetching Dhan trade history page ${page}:`, err);
			break;
		}
	}
	return all;
}


export interface DhanLedgerEntry {
	dhanClientId?: string;
	narration: string;
	voucherdate: string; // e.g. "Jun 22, 2022"
	exchange?: string;
	voucherdesc?: string;
	vouchernumber: string;
	debit: string;
	credit: string;
	runbal: string;
	[key: string]: unknown;
}

/**
 * GET /v2/ledger — every credit/debit on the trading account (bank
 * deposits/withdrawals, trade settlements, charges, all mixed together).
 * https://dhanhq.co/docs/v2/statements/
 * No pagination documented for this endpoint (unlike /v2/trades), so a
 * single call per date range is all it takes.
 */
export async function fetchDhanLedger(
	clientId: string,
	accessToken: string,
	fromDate: string,
	toDate: string
): Promise<DhanLedgerEntry[]> {
	try {
		const body = await dhanFetch(`/ledger?from-date=${fromDate}&to-date=${toDate}`, clientId, accessToken);
		return Array.isArray(body) ? body : (body?.data ?? []);
	} catch (err) {
		console.error('Error fetching Dhan ledger:', err);
		return [];
	}
}
