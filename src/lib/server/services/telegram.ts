import { dhanEnv } from '../config';

export interface TelegramTradeAlertInput {
	dhanOrderNo: string;
	symbol: string;
	exchange?: string;
	transactionType: string; // BUY / SELL
	status: string; // TRADED / PENDING / REJECTED / CANCELLED
	productType?: string;
	quantity: number;
	price: number;
	reason?: string;
}

/**
 * Sends a message via the Telegram Bot API to the configured TELEGRAM_CHAT_ID.
 */
export async function sendTelegramAlert(
	text: string,
	chatIdOverride?: string
): Promise<boolean> {
	const botToken = dhanEnv.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
	const chatId = chatIdOverride || dhanEnv.TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_ADMIN_USER_IDS;

	if (!botToken || !chatId) {
		console.warn('Telegram alert skipped: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured.');
		return false;
	}

	const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
	const targetChatId = chatId.split(',')[0].trim();

	try {
		const res = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				chat_id: targetChatId,
				text,
				parse_mode: 'Markdown'
			})
		});

		const body = await res.json().catch(() => ({}));
		if (!res.ok || !body.ok) {
			console.error(`Failed to send Telegram alert: ${res.status} ${JSON.stringify(body)}`);
			return false;
		}

		console.log(`Telegram alert successfully sent to chat ${targetChatId}`);
		return true;
	} catch (err: any) {
		console.error('Error sending Telegram alert:', err?.message || err);
		return false;
	}
}

/**
 * Formats a trade event into a clean Telegram Markdown notification.
 */
export function formatTradeAlert(t: TelegramTradeAlertInput): string {
	const isBuy = t.transactionType.toUpperCase() === 'BUY' || t.transactionType.toUpperCase() === 'B';
	const sideEmoji = isBuy ? '🟢 BUY' : '🔴 SELL';
	const statusEmoji = t.status === 'TRADED' ? '✅ TRADED' : t.status === 'REJECTED' ? '❌ REJECTED' : '⏳ ' + t.status;
	const product = t.productType ? ` (${t.productType})` : '';

	const lines = [
		`⚡ *Dhan Trade Alert*`,
		``,
		`*Symbol*: \`${t.symbol}\`${product}`,
		`*Side*: ${sideEmoji}`,
		`*Quantity*: \`${t.quantity}\``,
		`*Price*: \`₹${t.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}\``,
		`*Status*: ${statusEmoji}`,
		`*Order No*: \`${t.dhanOrderNo}\``
	];

	if (t.reason) {
		lines.push(`*Message*: _${t.reason}_`);
	}

	return lines.join('\n');
}
