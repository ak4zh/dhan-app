export interface RawTradeInput {
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

/**
 * Estimated per-fill statutory charges & brokerage (NSE cash, equity delivery/intraday only).
 * Used only as a fallback when a fill doesn't carry Dhan's own actual charge figures.
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

/** One realized-P&L-changing event (a SELL fill matched against the FIFO buy queue), in chronological order. */
export interface FifoRealizedEvent {
	date: string; // ISO, from the fill's timestamp
	symbol: string;
	realizedDelta: number;
}

export interface FifoResult {
	events: FifoRealizedEvent[];
	realizedPnl: number;
	totalCharges: number;
}

/** FIFO-matches BUY/SELL fills per security into realized P&L events + per-fill charges. */
export function matchFifoTrades(fills: RawTradeInput[]): FifoResult {
	const standardized = fills.map((t) => ({
		securityId: String(t.securityId || ''),
		symbol: (t.tradingSymbol || t.customSymbol || t.securityId || 'UNKNOWN') as string,
		type: (t.transactionType === 'B' || t.transactionType === 'BUY' ? 'BUY' : 'SELL') as 'BUY' | 'SELL',
		qty: Number(t.tradedQuantity) || 0,
		price: Number(t.tradedPrice) || 0,
		time: (t.exchangeTime || t.createTime || t.updateTime || '') as string,
		productType: (t.productType as string) || 'CNC',
		actualCharges:
			(Number(t.stt) || 0) +
			(Number(t.sebiTax) || 0) +
			(Number(t.brokerageCharges) || 0) +
			(Number(t.serviceTax) || 0) +
			(Number(t.exchangeTransactionCharges) || 0) +
			(Number(t.stampDuty) || 0)
	}));

	standardized.sort((a, b) => {
		if (!a.time) return -1;
		if (!b.time) return 1;
		return new Date(a.time).getTime() - new Date(b.time).getTime();
	});

	const buyQueues: Record<string, Array<{ qty: number; price: number }>> = {};
	const events: FifoRealizedEvent[] = [];
	let realizedPnl = 0;
	let totalCharges = 0;

	for (const t of standardized) {
		const key = t.securityId || t.symbol;
		if (t.actualCharges > 0) {
			totalCharges += t.actualCharges;
		} else {
			totalCharges += calculateTradeCharges(t.type, t.productType, t.qty, t.price);
		}

		if (t.type === 'BUY') {
			(buyQueues[key] ??= []).push({ qty: t.qty, price: t.price });
		} else {
			let remaining = t.qty;
			const queue = buyQueues[key] ?? [];
			let deltaForThisFill = 0;
			while (remaining > 0 && queue.length > 0) {
				const head = queue[0];
				const matched = Math.min(remaining, head.qty);
				const delta = (t.price - head.price) * matched;
				deltaForThisFill += delta;
				realizedPnl += delta;
				remaining -= matched;
				head.qty -= matched;
				if (head.qty <= 0) queue.shift();
			}
			if (deltaForThisFill !== 0) {
				events.push({
					date: t.time ? new Date(t.time).toISOString() : new Date().toISOString(),
					symbol: t.symbol,
					realizedDelta: deltaForThisFill
				});
			}
		}
	}

	return { events, realizedPnl, totalCharges };
}
