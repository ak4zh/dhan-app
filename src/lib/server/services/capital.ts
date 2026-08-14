import { eq, asc } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { db } from '../db/client';
import { ledgerEntries } from '../db/schema';
import { fetchDhanLedger, fetchDhanTradeHistory } from '../brokers/dhan';
import { getStoredDhanToken, getRealizedPnlOffset } from './settings';
import { dhanEnv } from '../config';
import { matchFifoTrades } from './fifo';
import { getPnlSnapshot } from './pnl';

const MONTHS: Record<string, string> = {
	Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
	Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'
};

/** Dhan's ledger returns dates like "Jun 22, 2022" — parsed manually (not via `new Date(...)`) to avoid timezone-dependent off-by-one-day parsing on a date that has no time component. */
export function parseDhanVoucherDate(raw: string): string {
	const m = raw.match(/^(\w{3})\s+(\d{1,2}),\s+(\d{4})$/);
	if (!m) throw new Error(`Unrecognized Dhan voucher date format: "${raw}"`);
	const [, mon, day, year] = m;
	const mm = MONTHS[mon];
	if (!mm) throw new Error(`Unknown month abbreviation in Dhan voucher date: "${mon}"`);
	return `${year}-${mm}-${day.padStart(2, '0')}`;
}

/**
 * Best-effort classification from the narration/voucherdesc text — deliberately
 * conservative (defaults to 'other' unless it looks like a bank-level fund
 * movement) since a false positive here would misclassify a trade settlement
 * or charge as capital moving in/out. Always admin-reviewable afterwards; see
 * ledgerEntries.includeInCapitalFlow in schema.ts.
 */
export function classifyLedgerEntry(
	narration: string,
	voucherDesc: string | undefined,
	debit: number,
	credit: number
): 'deposit' | 'withdrawal' | 'other' {
	const text = `${narration} ${voucherDesc ?? ''}`.toUpperCase();
	const looksLikeFundMovement = /FUND|PAYIN|PAYOUT|PAYBNK|\bNEFT\b|\bIMPS\b|\bUPI\b|BANK TRANSFER/.test(text);
	if (!looksLikeFundMovement) return 'other';
	if (credit > 0 && debit === 0) return 'deposit';
	if (debit > 0 && credit === 0) return 'withdrawal';
	return 'other';
}

async function getDhanCredentials() {
	const stored = await getStoredDhanToken();
	const accessToken = stored?.accessToken ?? dhanEnv.DHAN_ACCESS_TOKEN;
	if (!accessToken) {
		error(400, 'No Dhan access token configured yet — see DHAN_ACCESS_TOKEN / DHAN_PIN+DHAN_TOTP_SECRET.');
	}
	return { clientId: dhanEnv.DHAN_CLIENT_ID, accessToken };
}

/**
 * Fetches the ledger for [fromDate, toDate] and upserts into ledger_entries.
 * Re-syncing a date range you've already synced is safe: `vouchernumber` is
 * the dedup key, and any admin correction to cashFlowType/includeInCapitalFlow
 * on an existing row is preserved (only the raw Dhan fields get refreshed).
 */
export async function syncLedgerFromDhan(fromDate: string, toDate: string): Promise<{ synced: number; skipped: number }> {
	const { clientId, accessToken } = await getDhanCredentials();
	const rawEntries = await fetchDhanLedger(clientId, accessToken, fromDate, toDate);
	const now = new Date().toISOString();

	let synced = 0;
	let skipped = 0;

	for (const e of rawEntries) {
		let voucherDateIso: string;
		try {
			voucherDateIso = parseDhanVoucherDate(e.voucherdate);
		} catch (err) {
			console.error('Skipping unparseable ledger entry:', err);
			skipped++;
			continue;
		}

		const debit = Number(e.debit) || 0;
		const credit = Number(e.credit) || 0;
		const autoType = classifyLedgerEntry(e.narration, e.voucherdesc, debit, credit);

		const [existing] = await db
			.select()
			.from(ledgerEntries)
			.where(eq(ledgerEntries.voucherNumber, e.vouchernumber));

		if (existing) {
			await db
				.update(ledgerEntries)
				.set({
					voucherDate: voucherDateIso,
					narration: e.narration,
					voucherDesc: e.voucherdesc ?? null,
					debit,
					credit,
					runningBalance: Number(e.runbal) || null,
					fetchedAt: now
					// cashFlowType / includeInCapitalFlow intentionally left untouched — admin edits win.
				})
				.where(eq(ledgerEntries.voucherNumber, e.vouchernumber));
		} else {
			await db.insert(ledgerEntries).values({
				voucherNumber: e.vouchernumber,
				voucherDate: voucherDateIso,
				narration: e.narration,
				voucherDesc: e.voucherdesc ?? null,
				debit,
				credit,
				runningBalance: Number(e.runbal) || null,
				cashFlowType: autoType,
				includeInCapitalFlow: autoType !== 'other',
				fetchedAt: now
			});
		}
		synced++;
	}

	return { synced, skipped };
}

/** Daily-compounded value of `annualRatePercent` applied to a chronological series of cash flows, evaluated as of `asOf`. Positive amount = money added, negative = money removed. */
export function simulateSavingsAccount(
	cashFlows: Array<{ date: string; amount: number }>,
	annualRatePercent: number,
	asOf: Date
): number {
	const sorted = [...cashFlows].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
	const rate = annualRatePercent / 100;

	let balance = 0;
	let lastDate = sorted.length > 0 ? new Date(sorted[0].date) : asOf;

	for (const cf of sorted) {
		const cfDate = new Date(cf.date);
		const days = Math.max(0, (cfDate.getTime() - lastDate.getTime()) / 86_400_000);
		balance *= Math.pow(1 + rate, days / 365);
		balance += cf.amount;
		lastDate = cfDate;
	}

	const remainingDays = Math.max(0, (asOf.getTime() - lastDate.getTime()) / 86_400_000);
	balance *= Math.pow(1 + rate, remainingDays / 365);
	return balance;
}

/**
 * High-water-mark performance fee: walks the chronological realized-P&L
 * events and only charges `feePercent` on the portion of cumulative realized
 * profit that sets a NEW high — a drawdown followed by a recovery back to the
 * old peak accrues no fee on the recovery itself, matching what the manager
 * actually described ("no fee if just recovering a prior loss").
 */
export function computeHighWaterMarkFee(
	events: Array<{ date: string; realizedDelta: number }>,
	feePercent: number
): { totalFeeOwed: number; finalCumulativeRealized: number; finalHighWaterMark: number } {
	const sorted = [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

	let cumulative = 0;
	let highWaterMark = 0;
	let totalFeeOwed = 0;

	for (const ev of sorted) {
		cumulative += ev.realizedDelta;
		if (cumulative > highWaterMark) {
			totalFeeOwed += (feePercent / 100) * (cumulative - highWaterMark);
			highWaterMark = cumulative;
		}
	}

	return { totalFeeOwed, finalCumulativeRealized: cumulative, finalHighWaterMark: highWaterMark };
}

export interface ManagerPerformanceResult {
	totalDeposited: number;
	totalWithdrawn: number;
	netCapitalContributed: number;
	currentPortfolioValue: number;
	cumulativeRealizedProfit: number;
	estimatedFeeOwed: number;
	feePercent: number;
	yourValueAfterEstimatedFee: number;
	savingsAccountRate: number;
	savingsAccountBenchmarkValue: number;
	benefit: number; // yourValueAfterEstimatedFee - savingsAccountBenchmarkValue
	capitalFlowCount: number;
	asOf: string;
	warnings: string[];
}

/**
 * The actual "is this manager worth it" comparison. Two numbers are the point:
 * `yourValueAfterEstimatedFee` (what you actually have, net of the fee this
 * calculation estimates) vs `savingsAccountBenchmarkValue` (what the exact
 * same deposit/withdrawal timeline would be worth sitting in a savings
 * account at `savingsRate`% instead). `benefit` > 0 means the manager beat
 * the savings-account alternative net of their cut; < 0 means you'd have
 * been better off not hiring them.
 *
 * `estimatedFeeOwed` is calculated purely from realized-P&L trajectory via
 * the high-water mark (see computeHighWaterMarkFee) — it does NOT try to
 * detect fee payments already made from the ledger, since a withdrawal for
 * "paid the manager" and a withdrawal for "personal spending" look identical
 * in Dhan's ledger without manual tagging. If the fee has already been paid
 * out (reducing the live Dhan balance already reflected in
 * currentPortfolioValue), this slightly under-counts your true position —
 * see `warnings`.
 */
export async function getManagerPerformance(feePercent = 15, savingsRate = 7): Promise<ManagerPerformanceResult> {
	const warnings: string[] = [];

	const flows = await db
		.select({
			voucherDate: ledgerEntries.voucherDate,
			cashFlowType: ledgerEntries.cashFlowType,
			debit: ledgerEntries.debit,
			credit: ledgerEntries.credit
		})
		.from(ledgerEntries)
		.where(eq(ledgerEntries.includeInCapitalFlow, true))
		.orderBy(asc(ledgerEntries.voucherDate));

	if (flows.length === 0) {
		warnings.push(
			'No capital-flow ledger entries found — sync the ledger from Dhan and confirm which rows are deposits/withdrawals first.'
		);
	}

	let totalDeposited = 0;
	let totalWithdrawn = 0;
	const cashFlowSeries: Array<{ date: string; amount: number }> = [];

	for (const f of flows) {
		if (f.cashFlowType === 'deposit') {
			totalDeposited += f.credit;
			cashFlowSeries.push({ date: f.voucherDate, amount: f.credit });
		} else if (f.cashFlowType === 'withdrawal') {
			totalWithdrawn += f.debit;
			cashFlowSeries.push({ date: f.voucherDate, amount: -f.debit });
		}
	}

	const [snapshot, tradeHistory, pnlOffset] = await Promise.all([
		getPnlSnapshot().catch((err) => {
			warnings.push(`Couldn't fetch live portfolio value from Dhan: ${err instanceof Error ? err.message : err}`);
			return null;
		}),
		(async () => {
			try {
				const { clientId, accessToken } = await getDhanCredentials();
				const toDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
				const fromDate = flows[0]?.voucherDate ?? new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10);
				return await fetchDhanTradeHistory(clientId, accessToken, fromDate, toDate);
			} catch (err) {
				warnings.push(`Couldn't fetch trade history from Dhan: ${err instanceof Error ? err.message : err}`);
				return [];
			}
		})(),
		getRealizedPnlOffset().catch(() => 0)
	]);

	const { events } = matchFifoTrades(tradeHistory);
	const cumulativeRealizedProfit = events.reduce((sum, e) => sum + e.realizedDelta, 0) + pnlOffset;
	const { totalFeeOwed } = computeHighWaterMarkFee(events, feePercent);

	// Live cash + holdings/positions market value, straight from the P&L snapshot.
	const liveValue = snapshot
		? (snapshot.funds?.availableBalance ?? 0) +
			snapshot.positions.reduce((s, p) => s + (p.ltpAvailable ? (p.ltp ?? 0) * Math.abs(p.netQty) : 0), 0) +
			snapshot.holdings.reduce((s, h) => s + (h.ltpAvailable ? (h.ltp ?? 0) * h.netQty : 0), 0)
		: 0;

	if (snapshot?.hasIncompleteData) {
		warnings.push('Some positions/holdings are missing a live price, so currentPortfolioValue may be understated.');
	}

	const yourValueAfterEstimatedFee = liveValue - Math.max(0, totalFeeOwed);
	const asOfDate = new Date();
	const savingsAccountBenchmarkValue = simulateSavingsAccount(cashFlowSeries, savingsRate, asOfDate);

	return {
		totalDeposited,
		totalWithdrawn,
		netCapitalContributed: totalDeposited - totalWithdrawn,
		currentPortfolioValue: liveValue,
		cumulativeRealizedProfit,
		estimatedFeeOwed: totalFeeOwed,
		feePercent,
		yourValueAfterEstimatedFee,
		savingsAccountRate: savingsRate,
		savingsAccountBenchmarkValue,
		benefit: yourValueAfterEstimatedFee - savingsAccountBenchmarkValue,
		capitalFlowCount: cashFlowSeries.length,
		asOf: asOfDate.toISOString(),
		warnings
	};
}
