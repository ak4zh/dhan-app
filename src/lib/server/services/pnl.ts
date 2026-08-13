import { desc, eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { db } from '../db/client';
import { tradeLog } from '../db/schema';
import {
	fetchDhanFundLimit,
	fetchDhanHoldings,
	fetchDhanLtp,
	fetchDhanPositions,
	fetchDhanTodaysTrades,
	fetchDhanTradeHistory,
	type DhanTrade
} from '../brokers/dhan';
import { getStoredDhanToken, getRealizedPnlOffset } from './settings';
import { dhanEnv } from '../config';

export interface PnlItem {
	symbol: string;
	exchange: string;
	productType: string;
	netQty: number;
	avgPrice: number;
	ltp?: number;
	/** false = we couldn't get a live price for this line; unrealized is not meaningful. */
	ltpAvailable: boolean;
	realized: number;
	unrealized: number;
}

export interface PnlSnapshot {
	holdingsPnl: number;
	positionsPnl: number;
	totalUnrealized: number;
	/** Realized P&L covers realizedPeriod.from → realizedPeriod.to (inclusive), not all-time. */
	totalRealized: number;
	realizedPeriod: { from: string; to: string };
	grossNetPnl: number;
	totalCharges: number;
	netPnlAfterCharges: number;
	funds?: {
		availableBalance: number;
		utilizedAmount: number;
		collateralAmount: number;
		sodLimit: number;
	};
	positions: PnlItem[];
	holdings: PnlItem[];
	/** True if any line's unrealized P&L couldn't be computed for lack of a live price. */
	hasIncompleteData: boolean;
	asOf: string;
}

/**
 * Estimated per-fill statutory charges & brokerage (NSE cash, equity delivery/intraday only —
 * see calculateTradeCharges below for the breakdown). Same formulas as the old project;
 * not a bug fix target, just carried over.
 */
export function calculateTradeCharges(
	txnType: 'BUY' | 'SELL',
	productType: string,
	qty: number,
	price: number
): number {
	const turnover = qty * price;
	if (turnover <= 0) return 0;

	const isDelivery = productType.includes('CNC') || productType.includes('HOLDING');
	const isBuy = txnType === 'BUY';

	const brokerage = isDelivery ? 0 : Math.min(20, turnover * 0.0003);

	let stt = 0;
	if (isDelivery) {
		stt = turnover * 0.001;
	} else if (!isBuy) {
		stt = turnover * 0.00025;
	}

	const exchangeFees = turnover * 0.0000297;
	const sebiFees = turnover * 0.000001;

	let stampDuty = 0;
	if (isBuy) {
		stampDuty = isDelivery ? turnover * 0.00015 : turnover * 0.00003;
	}

	const gst = (brokerage + exchangeFees + sebiFees) * 0.18;

	return brokerage + stt + exchangeFees + sebiFees + stampDuty + gst;
}

interface RawTradeInput {
	securityId?: string;
	tradingSymbol?: string;
	customSymbol?: string;
	transactionType: string;
	tradedQuantity: number;
	tradedPrice: number;
	productType?: string;
	exchangeTime?: string;
	createTime?: string;
	updateTime?: string;
	[key: string]: unknown;
}

/** FIFO-matches BUY/SELL fills per symbol into realized P&L + per-fill charges. */
function computeFifoRealized(fills: RawTradeInput[]) {
	// Standardize fills and sort chronologically (oldest first)
	const standardized = fills.map((t) => ({
		securityId: String(t.securityId || ''),
		symbol: (t.tradingSymbol || t.customSymbol || t.securityId || 'UNKNOWN') as string,
		type: (t.transactionType === 'B' || t.transactionType === 'BUY' ? 'BUY' : 'SELL') as 'BUY' | 'SELL',
		qty: Number(t.tradedQuantity) || 0,
		price: Number(t.tradedPrice) || 0,
		time: (t.exchangeTime || t.createTime || t.updateTime || '') as string,
		productType: (t.productType as string) || 'CNC'
	}));

	standardized.sort((a, b) => {
		if (!a.time) return -1;
		if (!b.time) return 1;
		return new Date(a.time).getTime() - new Date(b.time).getTime();
	});

	const buyQueues: Record<string, Array<{ qty: number; price: number }>> = {};
	let realizedPnl = 0;
	let totalCharges = 0;

	for (const t of standardized) {
		const key = t.securityId || t.symbol;
		totalCharges += calculateTradeCharges(t.type, t.productType, t.qty, t.price);

		if (t.type === 'BUY') {
			(buyQueues[key] ??= []).push({ qty: t.qty, price: t.price });
		} else {
			let remaining = t.qty;
			const queue = buyQueues[key] ?? [];
			while (remaining > 0 && queue.length > 0) {
				const head = queue[0];
				const matched = Math.min(remaining, head.qty);
				realizedPnl += (t.price - head.price) * matched;
				remaining -= matched;
				head.qty -= matched;
				if (head.qty <= 0) queue.shift();
			}
		}
	}

	return { realizedPnl, totalCharges };
}

function todayIST(): string {
	return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function daysAgoIST(days: number): string {
	const d = new Date();
	d.setDate(d.getDate() - days);
	return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

/**
 * Pulls live positions, holdings, historical trades (default: trailing 365 days — see
 * `lookbackDays`), today's trades, and fund summary from Dhan, and returns a coherent P&L snapshot.
 */
export async function getPnlSnapshot(lookbackDays = 365): Promise<PnlSnapshot> {
	const stored = await getStoredDhanToken();
	const accessToken = stored?.accessToken ?? dhanEnv.DHAN_ACCESS_TOKEN;
	if (!accessToken) {
		error(400, 'No Dhan access token configured yet — set DHAN_ACCESS_TOKEN or DHAN_PIN/DHAN_TOTP_SECRET, or wait for the daily auto-refresh to run.');
	}
	const clientId = dhanEnv.DHAN_CLIENT_ID;

	const toDate = todayIST();
	const fromDate = daysAgoIST(lookbackDays);

	const [positions, holdings, tradeHistory, todayTrades, fundLimit, pnlOffset] = await Promise.all([
		fetchDhanPositions(clientId, accessToken),
		fetchDhanHoldings(clientId, accessToken),
		fetchDhanTradeHistory(clientId, accessToken, fromDate, toDate),
		fetchDhanTodaysTrades(clientId, accessToken),
		fetchDhanFundLimit(clientId, accessToken),
		getRealizedPnlOffset().catch(() => 0)
	]);

	// Combine historical and today's trades
	let fills: RawTradeInput[] = [...tradeHistory, ...todayTrades];
	if (fills.length === 0) {
		const logged = await db.select().from(tradeLog).where(eq(tradeLog.status, 'TRADED')).catch(() => []);
		fills = logged.map((f) => ({
			tradingSymbol: f.symbol,
			transactionType: f.transactionType === 'BUY' ? 'BUY' : 'SELL',
			tradedQuantity: f.masterQuantity,
			tradedPrice: f.tradedPrice ?? 0,
			productType: f.productType ?? 'INTRADAY',
			createTime: f.createdAt
		}));
	}

	const { realizedPnl: fifoRealized, totalCharges } = computeFifoRealized(fills);

	// Live LTP lookup for any position/holding line that doesn't already have one —
	// batched into a single market-quote call rather than fetched per-symbol.
	const needsLtp: Array<{ exchangeSegment: string; securityId: string }> = [];
	for (const p of positions) {
		if (p.netQty !== 0 && !(Number(p.lastTradedPrice) > 0)) {
			needsLtp.push({ exchangeSegment: p.exchangeSegment, securityId: p.securityId });
		}
	}
	for (const h of holdings) {
		const hQty = h.availableQty ?? h.totalQty ?? 0;
		if (hQty > 0 && h.securityId) {
			needsLtp.push({ exchangeSegment: (h.exchange as string) ?? 'NSE_EQ', securityId: h.securityId });
		}
	}
	const ltpMap = needsLtp.length
		? await fetchDhanLtp(clientId, accessToken, needsLtp)
		: new Map<string, number>();

	let holdingsPnl = 0;
	let positionsPnl = 0;
	let positionsRealized = 0;
	let hasIncompleteData = false;

	const positionItems: PnlItem[] = [];
	const holdingItems: PnlItem[] = [];

	for (const p of positions) {
		// If CNC sell position (selling existing delivery holding), realized P&L is covered via FIFO pass
		if (p.productType === 'CNC' && p.netQty < 0) {
			continue;
		}

		const buyQty = Number(p.buyQty) || 0;
		const sellQty = Number(p.sellQty) || 0;
		const buyAvg = Number(p.buyAvg || p.costPrice) || 0;
		const sellAvg = Number(p.sellAvg) || 0;
		const closedQty = Math.min(buyQty, sellQty);

		let realized = Number((p as any).realizedProfit) || 0;
		if (realized === 0 && closedQty > 0 && sellAvg > 0 && buyAvg > 0) {
			realized = (sellAvg - buyAvg) * closedQty;
		}
		positionsRealized += realized;

		let ltp = Number((p as any).lastTradedPrice) || 0;
		let ltpAvailable = ltp > 0;
		if (!ltpAvailable) {
			const looked = ltpMap.get(`${p.exchangeSegment}:${p.securityId}`);
			if (looked && looked > 0) {
				ltp = looked;
				ltpAvailable = true;
			}
		}

		let unrealized = Number((p as any).unrealizedProfit) || 0;
		if (unrealized === 0 && p.netQty !== 0) {
			if (ltpAvailable) {
				unrealized =
					p.netQty > 0 ? (ltp - buyAvg) * p.netQty : (sellAvg - ltp) * Math.abs(p.netQty);
			} else {
				hasIncompleteData = true;
			}
		}

		// Derive implied LTP from Dhan-reported unrealized profit if LTP lookup was unavailable
		if (!ltpAvailable && p.netQty !== 0 && unrealized !== 0) {
			ltp = p.netQty > 0
				? buyAvg + (unrealized / p.netQty)
				: sellAvg - (unrealized / Math.abs(p.netQty));
			if (ltp > 0) {
				ltpAvailable = true;
			}
		}

		positionsPnl += unrealized;

		if (p.netQty !== 0 || Math.abs(realized) > 0.01) {
			positionItems.push({
				symbol: p.tradingSymbol,
				exchange: p.exchangeSegment || 'NSE',
				productType: p.productType || 'POSITION',
				netQty: p.netQty,
				avgPrice: p.netQty > 0 ? buyAvg || sellAvg : sellAvg || buyAvg,
				ltp: ltpAvailable ? ltp : undefined,
				ltpAvailable,
				realized,
				unrealized
			});
		}
	}

	let holdingsRealized = 0;
	for (const h of holdings) {
		const qty = h.availableQty ?? h.totalQty ?? 0;
		if (qty <= 0) continue;

		const avgPrice = h.avgCostPrice || 0;
		let ltp = Number((h as any).lastTradedPrice) || 0;
		let ltpAvailable = ltp > 0;
		if (!ltpAvailable && h.securityId) {
			const looked = ltpMap.get(`${(h.exchange as string) ?? 'NSE_EQ'}:${h.securityId}`);
			if (looked && looked > 0) {
				ltp = looked;
				ltpAvailable = true;
			}
		}

		const unrealized = ltpAvailable ? (ltp - avgPrice) * qty : 0;
		if (!ltpAvailable) hasIncompleteData = true;
		holdingsPnl += unrealized;

		const realized = Number((h as any).realizedProfit) || 0;
		holdingsRealized += realized;

		holdingItems.push({
			symbol: h.tradingSymbol,
			exchange: (h.exchange as string) || 'NSE',
			productType: 'CNC / HOLDING',
			netQty: qty,
			avgPrice,
			ltp: ltpAvailable ? ltp : undefined,
			ltpAvailable,
			realized,
			unrealized
		});
	}

	const totalRealized = fifoRealized + pnlOffset;

	const totalUnrealized = holdingsPnl + positionsPnl;
	const grossNetPnl = totalRealized + totalUnrealized;
	const netPnlAfterCharges = grossNetPnl - totalCharges;

	const funds = fundLimit
		? {
				availableBalance: Number(fundLimit.availabelBalance) || 0,
				utilizedAmount: Number(fundLimit.utilizedAmount) || 0,
				collateralAmount: Number(fundLimit.collateralAmount) || 0,
				sodLimit: Number(fundLimit.sodLimit) || 0
			}
		: undefined;

	return {
		holdingsPnl,
		positionsPnl,
		totalUnrealized,
		totalRealized,
		realizedPeriod: { from: fromDate, to: toDate },
		grossNetPnl,
		totalCharges,
		netPnlAfterCharges,
		funds,
		positions: positionItems,
		holdings: holdingItems,
		hasIncompleteData,
		asOf: new Date().toISOString()
	};
}

/** Recent fills (TRADED status only) for the dashboard's live trade feed, newest first. */
export async function getRecentTrades(limit = 50) {
	return db
		.select()
		.from(tradeLog)
		.where(eq(tradeLog.status, 'TRADED'))
		.orderBy(desc(tradeLog.id))
		.limit(limit);
}
